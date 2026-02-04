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

const DEFAULT_EQUIPMENT = {
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
    qty: normalizedQty,
    qty_mode: qtyMode,
    auto_from: String(autoFrom || '').trim(),
    auto_multiplier: Number.isFinite(autoMultiplier) && autoMultiplier > 0 ? autoMultiplier : 1,
    preset_qty: normalizedQty,
    preset_qty_mode: qtyMode === 'auto' ? 'auto' : 'manual',
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

export function buildDefaultEquipment(packageId) {
  const defaults = DEFAULT_EQUIPMENT[String(packageId || '')] || DEFAULT_EQUIPMENT.wholesale_only;
  return {
    kkt: {
      regularCount: Number(defaults.kkt?.regularCount || 0),
      smartCount: Number(defaults.kkt?.smartCount || 0),
      otherCount: Number(defaults.kkt?.otherCount || 0),
    },
    scannersCount: Number(defaults.scannersCount || 0),
  };
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
    if (!service || service.qty_mode !== 'auto') return;
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
  });

  return list;
}

export function calcServiceTotals(services) {
  const list = services || [];
  const totalHours = list.reduce((sum, svc) => {
    return sum + Number(svc.hours_per_unit || 0) * Number(svc.qty || 0);
  }, 0);
  const matrix = _matrixData();
  const rate = Number(matrix.rate_per_hour || 4950);
  const totalRub = totalHours * rate;
  return { totalHours, totalRub };
}

export function getPackagePresetTotals(packageId, detailed = false) {
  const { services } = buildPresetServices(packageId, detailed);
  const defaults = buildDefaultEquipment(packageId);
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

export function validatePackagePresets() {
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
