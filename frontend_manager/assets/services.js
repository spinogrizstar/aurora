// ФАЙЛ: frontend/assets/services.js
// ------------------------------------------------------------
// Слой действий для state + прокси в модуль расчёта.
// ------------------------------------------------------------

import { applyPackageDefaults, state } from './state.js';
import {
  SERVICE_GROUPS,
  applyAutoFromEquipment,
  getEquipmentDefaults,
  buildPresetServices,
  calcServiceTotals,
  getPackagePreset,
  buildServiceMapFromPreset,
  applyEquipmentToServices,
  computeTotals,
  getPackagePresetTotals,
  isEquipmentAvailable,
  isKktAvailable,
  isScannerAvailable,
  validatePackagePresets,
} from './services_calc.js';

export {
  SERVICE_GROUPS,
  calcServiceTotals,
  getPackagePreset,
  buildServiceMapFromPreset,
  applyEquipmentToServices,
  computeTotals,
  getPackagePresetTotals,
  isEquipmentAvailable,
  isKktAvailable,
  isScannerAvailable,
  validatePackagePresets,
  getEquipmentDefaults,
};

export function applyPreset(packageId, { resetEquipment = true } = {}) {
  if (!packageId) return;
  const normalized = String(packageId || '');
  state.selectedPackageId = normalized;
  const { services, diagnostics } = buildPresetServices(normalized, state.servicesDetailed);
  state.services = services;
  state.servicesPackageId = normalized;
  state.serviceOverrides = {};
  state.servicesPresetError = '';

  if (!Array.isArray(state.services) || !state.services.length) {
    state.servicesPresetError = `Нет услуг для пакета ${normalized}. Проверь матрицу/ID.`;
    console.error('[Aurora][manager_v5] Empty services preset', {
      packageId: normalized,
      isDetailed: !!state.servicesDetailed,
      source: diagnostics?.source,
      diagnostics,
    });
  }

  if (resetEquipment) {
    applyPackageDefaults(normalized);
  }

  syncAutoServiceQuantities();
}

export function applyPackagePreset(packageId, options) {
  applyPreset(packageId, options);
}

export function resetPackageDefaults(packageId) {
  const normalized = String(packageId || state.selectedPackageId || '');
  if (!normalized) return;
  state.selectedPackageId = normalized;
  applyPackageDefaults(normalized);
  (state.services || []).forEach((svc) => {
    if (!svc) return;
    svc.manual_qty_override = false;
    svc.qty_mode = svc.preset_qty_mode || (svc.auto_from ? 'auto' : 'manual');
    const baseQty = Number(svc.preset_qty ?? 0);
    svc.qty = Number.isFinite(baseQty) ? Math.max(0, Math.trunc(baseQty)) : 0;
    svc.qty_current = svc.qty;
  });
  syncAutoServiceQuantities();
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
  state.services = applyAutoFromEquipment(
    state.services || [],
    equipment,
    state.selectedPackageId,
  );
}
