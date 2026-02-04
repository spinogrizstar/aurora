// ФАЙЛ: frontend/assets/services.js
// ------------------------------------------------------------
// Единый источник истины для услуг и их автологики.
// ------------------------------------------------------------

import { state } from './state.js';
import { getDataSync } from './data.js';

export const SERVICE_GROUPS = [
  'Регистрация ЧЗ',
  'Интеграция/учёт',
  'Оборудование/ККТ',
  'Обучение',
  'Прочее',
];

const KKT_PACKAGES = new Set(['retail_only', 'producer_retail']);
const SCANNER_PACKAGES = new Set(['retail_only', 'producer_retail', 'wholesale_only']);

function _matrixData() {
  const DATA = getDataSync();
  return DATA?.manager_matrix_v5 || { rate_per_hour: 4950, packages: {} };
}

function _hasMatrixData() {
  const DATA = getDataSync();
  return !!DATA?.manager_matrix_v5;
}

function _matrixPackage(packageId) {
  const matrix = _matrixData();
  return matrix.packages?.[packageId] || { summary: [], detailed: [] };
}

function _serviceDefaults(preset) {
  return (preset || []).map((service) => {
    const qty = Number(service.qty ?? 0);
    return {
      ...service,
      qty,
      isAuto: false,
      manuallySet: false,
    };
  });
}

function _buildServiceCatalog(matrix) {
  const catalog = new Map();
  const packages = matrix?.packages || {};
  Object.values(packages || {}).forEach((pkg) => {
    ['summary', 'detailed'].forEach((key) => {
      const list = Array.isArray(pkg?.[key]) ? pkg[key] : [];
      list.forEach((service) => {
        const id = String(service?.id || '').trim();
        if (!id) return;
        if (!catalog.has(id)) {
          catalog.set(id, {
            ...service,
            id,
          });
        }
      });
    });
  });
  return catalog;
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

export function buildPresetServices(packageId, detailed) {
  const matrix = _matrixData();
  const pkg = _matrixPackage(packageId);
  const detailedList = Array.isArray(pkg.detailed) ? pkg.detailed : [];
  const summaryList = Array.isArray(pkg.summary) ? pkg.summary : [];
  let rawPreset = detailed ? detailedList : summaryList;
  if (!rawPreset.length) {
    rawPreset = detailedList.length ? detailedList : summaryList;
  }
  const rawWithDefaults = _serviceDefaults(rawPreset || []);
  const catalog = _buildServiceCatalog(matrix);
  const rawFiltered = rawWithDefaults.filter((service) => {
    const id = String(service?.id || '').trim();
    return id ? catalog.has(id) : false;
  });
  const normalized = (rawFiltered.length ? rawFiltered : rawWithDefaults).map((service) => {
    const id = String(service?.id || '').trim();
    const catalogEntry = id ? catalog.get(id) : null;
    if (!catalogEntry) return service;
    return {
      ...catalogEntry,
      ...service,
      id,
      title: service.title || catalogEntry.title,
      group: service.group || catalogEntry.group,
      hoursPerUnit: Number(service.hoursPerUnit ?? catalogEntry.hoursPerUnit ?? 0),
      qty: Number(service.qty ?? catalogEntry.qty ?? 0),
      autoFrom: service.autoFrom ?? catalogEntry.autoFrom ?? null,
    };
  });
  return {
    services: normalized,
    diagnostics: {
      selectedPackageId: String(packageId || ''),
      isDetailed: !!detailed,
      presetBeforeFilter: rawWithDefaults,
      presetAfterFilter: rawFiltered,
      serviceCatalogIds: Array.from(catalog.keys()),
    },
  };
}

export function buildDefaultEquipment(packageId) {
  return {
    kkt: {
      regularCount: 0,
      smartCount: 0,
      otherCount: 0,
    },
    scannersCount: 0,
  };
}

export function applyAutoFromEquipment(services, equipment, packageId) {
  const list = services || [];
  const scanners = Number(equipment?.scannersCount || 0);
  const kktTotal =
    Number(equipment?.regularCount || 0)
    + Number(equipment?.smartCount || 0)
    + Number(equipment?.otherCount || 0);
  const autoEnabled = isScannerAvailable(packageId) || isKktAvailable(packageId) || !!state.equipmentEnabled;
  list.forEach((service) => {
    if (service.manuallySet) return;
    const override = state.serviceOverrides?.[service.id];
    if (override && override.qtyOverride !== null && override.qtyOverride !== undefined) return;
    const autoFrom = service.autoFrom;
    if (!autoFrom || !autoEnabled) {
      service.isAuto = false;
      return;
    }
    if (autoFrom === 'scanner_total') {
      service.qty = scanners;
      service.isAuto = true;
      return;
    }
    if (autoFrom === 'kkt_total') {
      service.qty = kktTotal;
      service.isAuto = true;
    }
  });
  return list;
}

export function applyPreset(packageId, { resetEquipment = true } = {}) {
  if (!packageId) return;
  const normalized = String(packageId || '');
  const DATA = getDataSync();
  if (DATA?.__matrixLoadError || !_hasMatrixData()) {
    state.selectedPackageId = normalized;
    state.services = [];
    state.servicesPackageId = normalized;
    state.serviceOverrides = {};
    state.servicesPresetError = DATA?.__matrixLoadError || 'Не удалось загрузить /data/manager_matrix_v5.json';
    return;
  }
  state.selectedPackageId = normalized;
  const { services, diagnostics } = buildPresetServices(normalized, state.servicesDetailed);
  state.services = services;
  state.servicesPackageId = normalized;
  state.serviceOverrides = {};
  state.servicesPresetError = '';
  state.services.forEach((service) => {
    service.manuallySet = false;
    service.isAuto = false;
  });
  state.scannersManuallySet = false;
  if (!Array.isArray(state.services) || !state.services.length) {
    state.servicesPresetError = `Пустой пресет услуг для пакета ${normalized} (isDetailed=${!!state.servicesDetailed}). Проверь матрицу/ID.`;
    console.error('[Aurora][manager_v5] Empty services preset', diagnostics);
  }
  if (resetEquipment) {
    const equipmentDefault = buildDefaultEquipment(normalized);
    state.kkt = {
      regularCount: equipmentDefault.kkt.regularCount,
      smartCount: equipmentDefault.kkt.smartCount,
      otherCount: equipmentDefault.kkt.otherCount,
    };
    state.equipment = {
      scannersCount: equipmentDefault.scannersCount,
    };
    state.equipmentEnabled = false;
  }
  syncAutoServiceQuantities();
}

export function applyPackagePreset(packageId, options) {
  applyPreset(packageId, options);
}

export function onPackageChange(packageId) {
  applyPreset(packageId);
}

export function ensureServicesForPackage(packageId) {
  if (!packageId) return;
  if (state.servicesPackageId !== packageId || !Array.isArray(state.services) || !state.services.length) {
    applyPreset(packageId);
  }
}

export function syncAutoServiceQuantities() {
  if (!state.equipment) state.equipment = { scannersCount: 0 };
  const equipment = {
    regularCount: Number(state.kkt?.regularCount || 0),
    smartCount: Number(state.kkt?.smartCount || 0),
    otherCount: Number(state.kkt?.otherCount || 0),
    scannersCount: Number(state.equipment?.scannersCount || 0),
  };
  state.services = applyAutoFromEquipment(state.services || [], equipment, state.selectedPackageId);
}

export function getPackageMatrixTotals(packageId, detailed) {
  const matrix = _matrixData();
  const pkg = _matrixPackage(packageId);
  if (!pkg || (!Array.isArray(pkg.summary) && !Array.isArray(pkg.detailed))) {
    return { hours: 0, price: 0, hasMatrix: false };
  }
  const detailedList = Array.isArray(pkg.detailed) ? pkg.detailed : [];
  const summaryList = Array.isArray(pkg.summary) ? pkg.summary : [];
  let rawPreset = detailed ? detailedList : summaryList;
  if (!rawPreset.length) rawPreset = detailedList.length ? detailedList : summaryList;
  const totals = calcServiceTotals(rawPreset);
  return { hours: totals.totalHours, price: totals.totalRub, hasMatrix: true };
}

export function calcServiceTotals(services) {
  const list = services || [];
  const totalHours = list.reduce((sum, svc) => {
    return sum + Number(svc.hoursPerUnit || 0) * Number(svc.qty || 0);
  }, 0);
  const matrix = _matrixData();
  const rate = Number(matrix.rate_per_hour || 4950);
  const totalRub = totalHours * rate;
  return { totalHours, totalRub };
}
