// ФАЙЛ: frontend/assets/services_calc.js
// ------------------------------------------------------------
// Сборка пресетов услуг + расчет + автологика оборудования.
// ------------------------------------------------------------

import { getDataSync } from './data.js';
import { PACKAGE_DEFAULTS } from './state.js';

export const PACKAGE_IDS = [
  'retail_only',
  'wholesale_only',
  'producer_only',
  'producer_retail',
];

export const SERVICE_GROUPS = [
  'Регистрация ЧЗ',
  'Интеграция/учёт',
  'Оборудование/ККТ',
  'Обучение',
  'Прочее',
];

const EQUIPMENT_BASIS_BY_SERVICE_ID = {
  kkt_firmware: 'kkt',
  fn_replace: 'kkt',
  kkt_connect: 'kkt',
  ts_piot: 'kkt',
  lm_chz: 'kkt',
  scanner_connect: 'scanner',
};

const EQUIPMENT_DEFAULTS_BY_PACKAGE = PACKAGE_DEFAULTS;

function _matrixData() {
  const DATA = getDataSync();
  return DATA?.manager_matrix_v5 || { rate_per_hour: 4950, packages: [], groups: [], services: [] };
}

function _matrixPackages(matrix) {
  return Array.isArray(matrix?.packages) ? matrix.packages : [];
}

function _matrixGroups(matrix) {
  return Array.isArray(matrix?.groups) ? matrix.groups : [];
}

function _matrixGroupMap(matrix) {
  const map = new Map();
  _matrixGroups(matrix).forEach((group) => {
    const id = String(group?.id || group?.key || '').trim();
    if (!id) return;
    const title = String(group?.title || group?.name || id).trim();
    map.set(id, title || id);
  });
  return map;
}

function _matrixServices(matrix) {
  return Array.isArray(matrix?.services) ? matrix.services : [];
}

function _servicesForPackage(matrix, packageId) {
  const normalized = String(packageId || '').trim();
  return _matrixServices(matrix).filter((service) => String(service?.package_id || service?.packageId || '').trim() === normalized);
}

function normalizeEquipment(equipment) {
  return {
    regularCount: Number(equipment?.regularCount || 0),
    smartCount: Number(equipment?.smartCount || 0),
    otherCount: Number(equipment?.otherCount || 0),
    scannersCount: Number(equipment?.scannersCount || 0),
  };
}

function normalizeServiceLine(rawService, groupMap) {
  const base = rawService || {};
  const id = String(base.service_id || base.id || base.key || '').trim();
  const title = base.title || id;
  const groupId = String(base.group_id || base.group || '').trim();
  const group = groupMap.get(groupId) || base.group || groupId || 'Прочее';
  const hoursPerUnit = base.unit_hours ?? base.hours_per_unit ?? base.hoursPerUnit ?? 0;
  const qtyValue = base.qty_default ?? base.qty ?? 0;
  const autoDep = base.auto_dep || base.autoDep || {};
  const autoFrom = (typeof autoDep === 'string' ? autoDep : autoDep?.source) ?? base.auto_from ?? base.autoFrom ?? '';
  const autoMultiplier = Number(
    (typeof autoDep === 'object' && autoDep !== null ? autoDep.multiplier : undefined)
      ?? base.auto_multiplier
      ?? base.autoMultiplier
      ?? 1,
  );
  const rawMode = String(base.qty_mode || base.qtyMode || (autoFrom ? 'auto' : 'manual')).toLowerCase();
  const qtyMode = (rawMode === 'auto' || rawMode === 'preset_auto') ? 'auto' : 'manual';
  const normalizedQty = Number.isFinite(Number(qtyValue)) ? Math.max(0, Math.trunc(Number(qtyValue))) : 0;

  return {
    id,
    title,
    group,
    hours_per_unit: Number(hoursPerUnit) || 0,
    unit_hours: Number(hoursPerUnit) || 0,
    qty: normalizedQty,
    qty_current: normalizedQty,
    qty_mode: qtyMode,
    auto_from: String(autoFrom || '').trim(),
    auto_multiplier: Number.isFinite(autoMultiplier) && autoMultiplier > 0 ? autoMultiplier : 1,
    preset_qty: normalizedQty,
    preset_qty_mode: qtyMode === 'auto' ? 'auto' : 'manual',
    manual_qty_override: false,
    qty_auto: qtyMode === 'auto' ? normalizedQty : null,
    auto_basis: '',
  };
}

export function getPackagePreset(packageId, isDetailed = false) {
  const matrix = _matrixData();
  const groupMap = _matrixGroupMap(matrix);
  const rawPreset = _servicesForPackage(matrix, packageId);
  const normalizedServices = (rawPreset || []).map((service) => normalizeServiceLine(service, groupMap)).filter((svc) => svc.id);
  return {
    services: normalizedServices,
    diagnostics: {
      selectedPackageId: String(packageId || ''),
      isDetailed: !!isDetailed,
      source: rawPreset.length ? 'matrix' : 'empty',
      hasServices: normalizedServices.length > 0,
      serviceCatalogIds: _matrixServices(matrix).map((service) => String(service?.service_id || service?.id || '').trim()).filter(Boolean),
    },
  };
}

export function buildServiceMapFromPreset(services) {
  const serviceMap = new Map();
  (services || []).forEach((svc) => {
    if (!svc?.id) return;
    serviceMap.set(String(svc.id), svc);
  });
  return serviceMap;
}

function resolveServiceEquipmentBasis(service) {
  const serviceId = String(service?.id || '').trim();
  if (serviceId && EQUIPMENT_BASIS_BY_SERVICE_ID[serviceId]) {
    return EQUIPMENT_BASIS_BY_SERVICE_ID[serviceId];
  }
  const autoFrom = String(service?.auto_from || '').trim();
  if (['kkt_total', 'kkt_standard', 'kkt_smart', 'kkt_other', 'kkt_count'].includes(autoFrom)) return 'kkt';
  if (['scanner_total', 'scanners_count', 'scanner_count'].includes(autoFrom)) return 'scanner';
  return '';
}

function getAutoQtyByBasis(basis, equipment, multiplier = 1) {
  const normalizedEquipment = normalizeEquipment(equipment);
  const safeMultiplier = Number.isFinite(Number(multiplier)) && Number(multiplier) > 0 ? Number(multiplier) : 1;
  const regular = normalizedEquipment.regularCount;
  const smart = normalizedEquipment.smartCount;
  const other = normalizedEquipment.otherCount;
  const scanners = normalizedEquipment.scannersCount;
  const kktTotal = regular + smart + other;
  const baseQty = basis === 'scanner' ? scanners : kktTotal;
  return Math.max(0, Math.trunc(baseQty * safeMultiplier));
}

export function applyEquipmentToServices(services, equipment) {
  const list = services || [];
  const normalizedEquipment = normalizeEquipment(equipment);
  list.forEach((service) => {
    if (!service) return;
    const basis = resolveServiceEquipmentBasis(service);
    if (!basis) return;

    const autoQty = getAutoQtyByBasis(basis, normalizedEquipment, service.auto_multiplier);
    service.auto_basis = basis;
    service.qty_auto = autoQty;

    if (service.manual_qty_override) {
      const manualQty = Number(service.qty_current ?? service.qty ?? 0);
      const normalizedManualQty = Number.isFinite(manualQty) ? Math.max(0, Math.trunc(manualQty)) : 0;
      service.qty = normalizedManualQty;
      service.qty_current = normalizedManualQty;
      service.qty_mode = 'manual';
      return;
    }

    service.qty = autoQty;
    service.qty_current = autoQty;
    service.qty_mode = 'auto';
  });
  return list;
}

export function isEquipmentAvailable(packageId) {
  const { services } = getPackagePreset(packageId, false);
  return (services || []).some((svc) => !!resolveServiceEquipmentBasis(svc));
}

export function isKktAvailable(packageId) {
  const { services } = getPackagePreset(packageId, false);
  return (services || []).some((svc) => resolveServiceEquipmentBasis(svc) === 'kkt');
}

export function isScannerAvailable(packageId) {
  const { services } = getPackagePreset(packageId, false);
  return (services || []).some((svc) => resolveServiceEquipmentBasis(svc) === 'scanner');
}

export function getEquipmentDefaults(packageId) {
  const defaults = EQUIPMENT_DEFAULTS_BY_PACKAGE[String(packageId || '')] || EQUIPMENT_DEFAULTS_BY_PACKAGE.wholesale_only;
  return {
    kkt: {
      regularCount: Number(defaults.kkt?.regularCount || 0),
      smartCount: Number(defaults.kkt?.smartCount || 0),
      otherCount: Number(defaults.kkt?.otherCount || 0),
    },
    scannersCount: Number(defaults.scannersCount || 0),
  };
}

export function buildDefaultEquipment(packageId) {
  return getEquipmentDefaults(packageId);
}

export function buildPresetServices(packageId, detailed) {
  return getPackagePreset(packageId, detailed);
}

export function applyAutoFromEquipment(
  services,
  equipment,
  packageId,
  { allowEquipmentOverride = false, forceEquipmentAuto = false } = {},
) {
  return applyEquipmentToServices(services, equipment);
}

export function computeTotals(services, rateOverride) {
  return calcServiceTotalsFromServices(services, rateOverride);
}

export function calcServiceTotals(services) {
  return computeTotals(services);
}

export function getPackagePresetTotals(packageId, detailed = false) {
  const { services } = getPackagePreset(packageId, detailed);
  const defaults = getEquipmentDefaults(packageId);
  applyEquipmentToServices(
    services,
    {
      regularCount: defaults.kkt.regularCount,
      smartCount: defaults.kkt.smartCount,
      otherCount: defaults.kkt.otherCount,
      scannersCount: defaults.scannersCount,
    },
  );
  return computeTotals(services);
}

export function calcServiceTotalsFromServices(services, rateOverride) {
  const list = Array.isArray(services) ? services : Object.values(services || {});
  const matrix = _matrixData();
  const rate = Number(rateOverride ?? matrix.rate_per_hour ?? 4950);
  const safeRate = Number.isFinite(rate) && rate > 0 ? rate : 4950;
  const totalHours = list.reduce((sum, svc) => {
    const hoursPerUnit = Number(svc?.unit_hours ?? svc?.hours_per_unit ?? svc?.hoursPerUnit ?? 0);
    const qty = Number(svc?.qty_current ?? svc?.qty ?? 0);
    return sum + hoursPerUnit * qty;
  }, 0);
  const totalRub = Math.round(totalHours * safeRate);
  return { totalHours, totalRub };
}

let _matrixSelfChecked = false;

function isDevEnv() {
  if (typeof process !== 'undefined' && process?.env?.NODE_ENV) {
    return process.env.NODE_ENV !== 'production';
  }
  if (typeof location !== 'undefined') {
    return location.hostname === 'localhost' || location.protocol === 'file:';
  }
  return false;
}

function runMatrixSelfCheck() {
  if (_matrixSelfChecked || !isDevEnv()) return;
  _matrixSelfChecked = true;
  const expectations = [
    { id: 'retail_only', hours: 9, rub: 44550 },
    { id: 'wholesale_only', hours: 6, rub: 29700 },
    { id: 'producer_only', hours: 11, rub: 54450 },
    { id: 'producer_retail', hours: 18, rub: 89100 },
  ];
  const issues = [];
  expectations.forEach((exp) => {
    const { services } = getPackagePreset(exp.id, false);
    const defaults = getEquipmentDefaults(exp.id);
    applyEquipmentToServices(
      services,
      {
        regularCount: defaults.kkt.regularCount,
        smartCount: defaults.kkt.smartCount,
        otherCount: defaults.kkt.otherCount,
        scannersCount: defaults.scannersCount,
      },
    );
    const totals = calcServiceTotalsFromServices(services);
    if (Math.abs(totals.totalHours - exp.hours) > 0.001 || totals.totalRub !== exp.rub) {
      issues.push({
        packageId: exp.id,
        expected: exp,
        got: totals,
      });
    }
  });
  if (issues.length) {
    const data = _matrixData();
    data.__matrixError = 'Матрица услуг сломана';
    console.error('[Aurora][manager_v5] matrix self-check failed', issues);
  }
}

export function validatePackagePresets() {
  runMatrixSelfCheck();
  const issues = [];
  const matrix = _matrixData();
  const packageIds = _matrixPackages(matrix).map((pkg) => String(pkg?.id || '').trim()).filter(Boolean);
  (packageIds.length ? packageIds : PACKAGE_IDS).forEach((packageId) => {
    const { services, diagnostics } = getPackagePreset(packageId, false);
    if (!Array.isArray(services) || !services.length) {
      issues.push({ packageId, diagnostics });
    }
  });
  if (issues.length) {
    console.error('[Aurora][manager_v5] Empty package presets detected', issues);
  }
  return issues;
}
