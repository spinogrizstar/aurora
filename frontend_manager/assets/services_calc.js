// ФАЙЛ: frontend/assets/services_calc.js
// ------------------------------------------------------------
// Сборка пресетов услуг + расчет + автологика оборудования.
// ------------------------------------------------------------

import { getDataSync } from './data.js';

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

const KKT_PACKAGES = new Set(['retail_only', 'producer_retail']);
const SCANNER_PACKAGES = new Set(['retail_only', 'producer_retail']);

const EQUIPMENT_DEFAULTS_BY_PACKAGE = {
  retail_only: {
    kkt: { regularCount: 1, smartCount: 0, otherCount: 0 },
    scannersCount: 1,
  },
  producer_retail: {
    kkt: { regularCount: 1, smartCount: 0, otherCount: 0 },
    scannersCount: 1,
  },
  wholesale_only: {
    kkt: { regularCount: 0, smartCount: 0, otherCount: 0 },
    scannersCount: 0,
  },
  producer_only: {
    kkt: { regularCount: 0, smartCount: 0, otherCount: 0 },
    scannersCount: 0,
  },
};

// ------------------------------------------------------------
// Чек‑лист контрольных сценариев (ручная проверка):
// 1) retail_only: дефолты пресета + оборудование → часы/₽ = матрица.
// 2) wholesale_only: дефолты пресета → часы/₽ = матрица, касс нет.
// 3) producer_only: дефолты пресета → часы/₽ = матрица.
// 4) producer_retail: касса=1, сканер=1 → 18ч / 89100₽ (rate 4950),
//    список услуг не пустой.
// 5) Изменение касс/сканеров:
//    - рост касс → растут auto‑услуги, manual не трогаем,
//    - сканеры могут быть меньше касс, расчёт корректный.
// ------------------------------------------------------------

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
  const qtyMode = rawMode === 'auto' ? 'auto' : 'manual';
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
  };
}

export function isEquipmentAvailable(packageId) {
  return isKktAvailable(packageId) || isScannerAvailable(packageId);
}

export function isKktAvailable(packageId) {
  return KKT_PACKAGES.has(String(packageId || ''));
}

export function isScannerAvailable(packageId) {
  return SCANNER_PACKAGES.has(String(packageId || ''));
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
  const matrix = _matrixData();
  const groupMap = _matrixGroupMap(matrix);
  const rawPreset = _servicesForPackage(matrix, packageId);
  const source = rawPreset.length ? 'matrix' : 'empty';
  const normalized = (rawPreset || []).map((service) => normalizeServiceLine(service, groupMap)).filter((svc) => svc.id);

  const hasServices = normalized.length > 0;
  const diagnostics = {
    selectedPackageId: String(packageId || ''),
    isDetailed: !!detailed,
    source,
    hasServices,
    serviceCatalogIds: _matrixServices(matrix).map((service) => String(service?.service_id || service?.id || '').trim()).filter(Boolean),
  };

  if (!hasServices) {
    normalized.push({
      id: 'matrix_placeholder',
      title: 'Проверка матрицы услуг',
      group: 'Прочее',
      hours_per_unit: 1,
      qty: 1,
      qty_mode: 'manual',
      auto_from: '',
      auto_multiplier: 1,
      preset_qty: 1,
      preset_qty_mode: 'manual',
    });
    diagnostics.source = 'placeholder';
  }

  return { services: normalized, diagnostics };
}

export function applyAutoFromEquipment(
  services,
  equipment,
  packageId,
  { allowEquipmentOverride = false, forceEquipmentAuto = false } = {},
) {
  const list = services || [];
  const scanners = Number(equipment?.scannersCount || 0);
  const regular = Number(equipment?.regularCount || 0);
  const smart = Number(equipment?.smartCount || 0);
  const other = Number(equipment?.otherCount || 0);
  const kktTotal = regular + smart + other;

  const allowKktAuto = isKktAvailable(packageId) || allowEquipmentOverride || forceEquipmentAuto;
  const allowScannerAuto = isScannerAvailable(packageId) || allowEquipmentOverride || forceEquipmentAuto;

  list.forEach((service) => {
    if (!service || service.qty_mode !== 'auto' || service.manual_qty_override) return;
    const autoFrom = String(service.auto_from || '').trim();
    const multiplier = Number(service.auto_multiplier || 1);
    let base = null;

    if (autoFrom === 'kkt_total' && allowKktAuto) base = kktTotal;
    if ((autoFrom === 'scanner_total' || autoFrom === 'scanners_count') && allowScannerAuto) base = scanners;
    if (autoFrom === 'kkt_standard' && allowKktAuto) base = regular;
    if (autoFrom === 'kkt_smart' && allowKktAuto) base = smart;
    if (autoFrom === 'kkt_other' && allowKktAuto) base = other;

    if (base === null) return;
    const next = Math.max(0, Math.trunc(Number(base) * multiplier));
    service.qty = next;
    service.qty_current = next;
  });

  return list;
}

export function calcServiceTotals(services) {
  return calcServiceTotalsFromServices(services);
}

export function getPackagePresetTotals(packageId, detailed = false) {
  const { services } = buildPresetServices(packageId, detailed);
  const defaults = getEquipmentDefaults(packageId);
  applyAutoFromEquipment(
    services,
    {
      regularCount: defaults.kkt.regularCount,
      smartCount: defaults.kkt.smartCount,
      otherCount: defaults.kkt.otherCount,
      scannersCount: defaults.scannersCount,
    },
    packageId,
  );
  return calcServiceTotals(services);
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
    { id: 'wholesale_only', hours: 7, rub: 34650 },
    { id: 'producer_only', hours: 12, rub: 59400 },
    { id: 'producer_retail', hours: 18, rub: 89100 },
  ];
  const issues = [];
  expectations.forEach((exp) => {
    const { services } = buildPresetServices(exp.id, false);
    const defaults = getEquipmentDefaults(exp.id);
    applyAutoFromEquipment(
      services,
      {
        regularCount: defaults.kkt.regularCount,
        smartCount: defaults.kkt.smartCount,
        otherCount: defaults.kkt.otherCount,
        scannersCount: defaults.scannersCount,
      },
      exp.id,
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
    [false, true].forEach((isDetailed) => {
      const { services, diagnostics } = buildPresetServices(packageId, isDetailed);
      if (!Array.isArray(services) || !services.length || diagnostics.source === 'placeholder') {
        issues.push({ packageId, isDetailed, diagnostics });
      }
    });
  });
  if (issues.length) {
    console.error('[Aurora][manager_v5] Empty package presets detected', issues);
  }
  return issues;
}
