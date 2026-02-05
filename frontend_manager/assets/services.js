// ФАЙЛ: frontend/assets/services.js
// ------------------------------------------------------------
// Слой действий для state + прокси в модуль расчёта.
// ------------------------------------------------------------

import { state } from './state.js';
import {
  SERVICE_GROUPS,
  applyAutoFromEquipment,
  getEquipmentDefaults,
  buildPresetServices,
  calcServiceTotals,
  getPackagePresetTotals,
  isEquipmentAvailable,
  isKktAvailable,
  isScannerAvailable,
  validatePackagePresets,
} from './services_calc.js';

export {
  SERVICE_GROUPS,
  calcServiceTotals,
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

  if (!Array.isArray(state.services) || !state.services.length || diagnostics?.source === 'placeholder') {
    state.servicesPresetError = `Пустой пресет услуг для пакета ${normalized} (isDetailed=${!!state.servicesDetailed}). Проверь матрицу/ID.`;
    console.error('[Aurora][manager_v5] Empty services preset', {
      packageId: normalized,
      isDetailed: !!state.servicesDetailed,
      source: diagnostics?.source,
      diagnostics,
    });
  }

  if (resetEquipment) {
    const equipmentDefault = getEquipmentDefaults(normalized);
    state.kkt = {
      regularCount: equipmentDefault.kkt.regularCount,
      smartCount: equipmentDefault.kkt.smartCount,
      otherCount: equipmentDefault.kkt.otherCount,
    };
    state.equipment = {
      scannersCount: equipmentDefault.scannersCount,
    };
    state.equipmentEnabled = false;
    state.scannersManuallySet = false;
  }

  syncAutoServiceQuantities();
}

export function applyPackagePreset(packageId, options) {
  applyPreset(packageId, options);
}

export function resetPackageDefaults(packageId) {
  const normalized = String(packageId || state.selectedPackageId || '');
  if (!normalized) return;
  applyPreset(normalized, { resetEquipment: true });
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
  const equipmentAllowed = isEquipmentAvailable(state.selectedPackageId);
  const baseEquipment = {
    regularCount: Number(state.kkt?.regularCount || 0),
    smartCount: Number(state.kkt?.smartCount || 0),
    otherCount: Number(state.kkt?.otherCount || 0),
    scannersCount: Number(state.equipment?.scannersCount || 0),
  };
  const equipment = (!equipmentAllowed && !state.equipmentEnabled)
    ? { regularCount: 0, smartCount: 0, otherCount: 0, scannersCount: 0 }
    : baseEquipment;
  state.services = applyAutoFromEquipment(
    state.services || [],
    equipment,
    state.selectedPackageId,
    {
      allowEquipmentOverride: !!state.equipmentEnabled,
      forceEquipmentAuto: !equipmentAllowed && !state.equipmentEnabled,
    },
  );
}
