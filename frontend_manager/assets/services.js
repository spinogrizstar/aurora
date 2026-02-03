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

const AUTO_BY_SCANNER = new Set(['scanner_connect']);
const KKT_PACKAGES = new Set(['retail_only', 'producer_retail']);
const SCANNER_PACKAGES = new Set(['retail_only', 'producer_retail', 'wholesale_only']);

function _matrixData() {
  const DATA = getDataSync();
  return DATA?.manager_matrix_v5 || { rate_per_hour: 4950, packages: {} };
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

export function isEquipmentAvailable(packageId) {
  return isKktAvailable(packageId) || isScannerAvailable(packageId);
}

export function isKktAvailable(packageId) {
  return KKT_PACKAGES.has(String(packageId || ''));
}

export function isScannerAvailable(packageId) {
  return SCANNER_PACKAGES.has(String(packageId || ''));
}

export function getPresetServices(packageId, detailed) {
  const pkg = _matrixPackage(packageId);
  const presets = detailed ? pkg.detailed : pkg.summary;
  return _serviceDefaults(presets || []);
}

export function getDefaultEquipment(packageId) {
  return {
    regularCount: 0,
    smartCount: 0,
    otherCount: 0,
    scannersCount: 0,
  };
}

export function applyAutoFromEquipment(services, equipment, packageId) {
  const list = services || [];
  const scanners = Number(equipment?.scannersCount || 0);
  const autoEnabled = isScannerAvailable(packageId) || !!state.equipmentEnabled;
  list.forEach((service) => {
    if (service.manuallySet) return;
    if (AUTO_BY_SCANNER.has(service.id) && autoEnabled) {
      service.qty = scanners;
      service.isAuto = scanners > 0;
    }
  });
  return list;
}

export function applyPackagePreset(packageId, { resetEquipment = true } = {}) {
  if (!packageId) return;
  const normalized = String(packageId || '');
  state.selectedPackageId = normalized;
  state.services = getPresetServices(normalized, state.servicesDetailed);
  state.servicesPackageId = normalized;
  if (resetEquipment) {
    const equipmentDefault = getDefaultEquipment(normalized);
    state.kkt = {
      regularCount: equipmentDefault.regularCount,
      smartCount: equipmentDefault.smartCount,
      otherCount: equipmentDefault.otherCount,
    };
    state.device_scanner = equipmentDefault.scannersCount;
    state.scannersManuallySet = false;
    state.equipmentEnabled = false;
  }
}

export function onPackageChange(packageId) {
  applyPackagePreset(packageId);
}

export function ensureServicesForPackage(packageId) {
  if (!packageId) return;
  if (state.servicesPackageId !== packageId || !Array.isArray(state.services) || !state.services.length) {
    applyPackagePreset(packageId);
  }
}

export function syncAutoServiceQuantities() {
  const equipment = {
    regularCount: Number(state.kkt?.regularCount || 0),
    smartCount: Number(state.kkt?.smartCount || 0),
    otherCount: Number(state.kkt?.otherCount || 0),
    scannersCount: Number(state.device_scanner || 0),
  };
  state.services = applyAutoFromEquipment(state.services || [], equipment, state.selectedPackageId);
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
