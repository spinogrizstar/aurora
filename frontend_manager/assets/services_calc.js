import { getDataSync } from './data.js';
import { PACKAGE_DEFAULTS } from './state.js';

export const PACKAGE_IDS = ['retail_only', 'wholesale_only', 'producer_only', 'producer_retail'];

export const SERVICE_GROUPS = ['Регистрация ЧЗ', 'Интеграция/учёт', 'Оборудование/ККТ', 'Обучение'];

const SERVICE_MATRIX = [
  {
    serviceId: 'reg_chz',
    title: 'Регистрация в ЧЗ',
    categoryId: 'registration',
    categoryTitle: 'Регистрация ЧЗ',
    autoDriver: 'none',
    defaultQtyInPreset: { retail_only: 1, wholesale_only: 1, producer_only: 1, producer_retail: 1 },
    unitHoursByPackage: { retail_only: 1, wholesale_only: 1, producer_only: 1, producer_retail: 1 },
  },
  {
    serviceId: 'reg_gs1',
    title: 'Регистрация GS1rus',
    categoryId: 'registration',
    categoryTitle: 'Регистрация ЧЗ',
    autoDriver: 'none',
    defaultQtyInPreset: { retail_only: 0, wholesale_only: 0, producer_only: 1, producer_retail: 1 },
    unitHoursByPackage: { retail_only: 1, wholesale_only: 1, producer_only: 1, producer_retail: 1 },
  },
  { serviceId: 'edo', title: 'Настройка ЭДО', categoryId: 'integration', categoryTitle: 'Интеграция/учёт', autoDriver: 'none', defaultQtyInPreset: { retail_only: 1, wholesale_only: 1, producer_only: 1, producer_retail: 1 }, unitHoursByPackage: { retail_only: 1, wholesale_only: 2, producer_only: 2, producer_retail: 2 } },
  { serviceId: 'integration', title: 'Интеграция с товароучёткой', categoryId: 'integration', categoryTitle: 'Интеграция/учёт', autoDriver: 'none', defaultQtyInPreset: { retail_only: 1, wholesale_only: 1, producer_only: 1, producer_retail: 1 }, unitHoursByPackage: { retail_only: 1, wholesale_only: 2, producer_only: 3, producer_retail: 3 } },
  { serviceId: 'ts_piot', title: 'ТС ПИОТ', categoryId: 'integration', categoryTitle: 'Интеграция/учёт', autoDriver: 'kkt', autoQtySource: 'kkt_physical', defaultQtyInPreset: { retail_only: 0, wholesale_only: 0, producer_only: 0, producer_retail: 1 }, unitHoursByPackage: { retail_only: 1, wholesale_only: 1, producer_only: 1, producer_retail: 1 } },
  { serviceId: 'lm_chz', title: 'ЛМ ЧЗ', categoryId: 'integration', categoryTitle: 'Интеграция/учёт', autoDriver: 'kkt', autoQtySource: 'kkt_physical', defaultQtyInPreset: { retail_only: 0, wholesale_only: 0, producer_only: 0, producer_retail: 1 }, unitHoursByPackage: { retail_only: 2, wholesale_only: 2, producer_only: 2, producer_retail: 2 } },
  {
    serviceId: 'firmware_kkt_package',
    title: 'Прошивка ККТ (в пакете)',
    categoryId: 'equipment',
    categoryTitle: 'Оборудование/ККТ',
    autoDriver: 'kkt_first',
    autoQtySource: 'kkt_work_units',
    defaultQtyInPreset: { retail_only: 1, wholesale_only: 0, producer_only: 0, producer_retail: 1 },
    unitHoursByPackage: { retail_only: 0.5, wholesale_only: 1, producer_only: 1, producer_retail: 1 },
  },
  {
    serviceId: 'firmware_kkt_extra',
    title: 'Прошивка ККТ (доп.)',
    categoryId: 'equipment',
    categoryTitle: 'Оборудование/ККТ',
    autoDriver: 'kkt_extra',
    autoQtySource: 'kkt_work_units',
    defaultQtyInPreset: { retail_only: 0, wholesale_only: 0, producer_only: 0, producer_retail: 0 },
    unitHoursByPackage: { retail_only: 1, wholesale_only: 1, producer_only: 1, producer_retail: 1 },
  },
  {
    serviceId: 'replace_fn_package',
    title: 'Замена ФН (в пакете)',
    categoryId: 'equipment',
    categoryTitle: 'Оборудование/ККТ',
    autoDriver: 'kkt_first',
    autoQtySource: 'kkt_work_units',
    defaultQtyInPreset: { retail_only: 1, wholesale_only: 0, producer_only: 0, producer_retail: 1 },
    unitHoursByPackage: { retail_only: 0.5, wholesale_only: 1, producer_only: 1, producer_retail: 1 },
  },
  {
    serviceId: 'replace_fn_extra',
    title: 'Замена ФН (доп.)',
    categoryId: 'equipment',
    categoryTitle: 'Оборудование/ККТ',
    autoDriver: 'kkt_extra',
    autoQtySource: 'kkt_work_units',
    defaultQtyInPreset: { retail_only: 0, wholesale_only: 0, producer_only: 0, producer_retail: 0 },
    unitHoursByPackage: { retail_only: 1, wholesale_only: 1, producer_only: 1, producer_retail: 1 },
  },
  {
    serviceId: 'connect_scanner_package',
    title: 'Подключение сканера (в пакете)',
    categoryId: 'equipment',
    categoryTitle: 'Оборудование/ККТ',
    autoDriver: 'scanner_first',
    autoQtySource: 'scanners',
    defaultQtyInPreset: { retail_only: 1, wholesale_only: 0, producer_only: 1, producer_retail: 1 },
    unitHoursByPackage: { retail_only: 0.5, wholesale_only: 1, producer_only: 1, producer_retail: 1 },
  },
  {
    serviceId: 'connect_scanner_extra',
    title: 'Подключение сканера (доп.)',
    categoryId: 'equipment',
    categoryTitle: 'Оборудование/ККТ',
    autoDriver: 'scanner_extra',
    autoQtySource: 'scanners',
    defaultQtyInPreset: { retail_only: 0, wholesale_only: 0, producer_only: 0, producer_retail: 0 },
    unitHoursByPackage: { retail_only: 1, wholesale_only: 1, producer_only: 1, producer_retail: 1 },
  },
  {
    serviceId: 'connect_kkt_to_package',
    title: 'Подключение ККТ к товароучётке (в пакете)',
    categoryId: 'equipment',
    categoryTitle: 'Оборудование/ККТ',
    autoDriver: 'kkt_first',
    autoQtySource: 'kkt_work_units',
    defaultQtyInPreset: { retail_only: 1, wholesale_only: 0, producer_only: 0, producer_retail: 1 },
    unitHoursByPackage: { retail_only: 0.5, wholesale_only: 1, producer_only: 1, producer_retail: 1 },
  },
  {
    serviceId: 'connect_kkt_to_extra',
    title: 'Подключение ККТ к товароучётке (доп.)',
    categoryId: 'equipment',
    categoryTitle: 'Оборудование/ККТ',
    autoDriver: 'kkt_extra',
    autoQtySource: 'kkt_work_units',
    defaultQtyInPreset: { retail_only: 0, wholesale_only: 0, producer_only: 0, producer_retail: 0 },
    unitHoursByPackage: { retail_only: 1, wholesale_only: 1, producer_only: 1, producer_retail: 1 },
  },
  { serviceId: 'printer_setup', title: 'Настройка принтера', categoryId: 'equipment', categoryTitle: 'Оборудование/ККТ', autoDriver: 'printer', autoQtySource: 'printers', defaultQtyInPreset: { retail_only: 0, wholesale_only: 0, producer_only: 1, producer_retail: 1 }, unitHoursByPackage: { retail_only: 3, wholesale_only: 3, producer_only: 3, producer_retail: 3 } },
  { serviceId: 'training', title: 'Обучение', categoryId: 'training', categoryTitle: 'Обучение', autoDriver: 'none', defaultQtyInPreset: { retail_only: 1, wholesale_only: 1, producer_only: 1, producer_retail: 1 }, unitHoursByPackage: { retail_only: 1, wholesale_only: 1, producer_only: 1, producer_retail: 1 } },
];

const KKT_INCLUDED_FALLBACK = {
  retail_only: 1,
  wholesale_only: 0,
  producer_only: 0,
  producer_retail: 0,
};

function getKktIncludedWorkUnits(packageId) {
  const normalizedPackageId = String(packageId || '').trim() || 'wholesale_only';
  const kktInPackageService = SERVICE_MATRIX.find((service) => {
    const autoBasis = service.autoDriver === 'none' ? '' : service.autoDriver;
    const source = service.autoQtySource || mapAutoQtySource(autoBasis);
    return autoBasis === 'kkt_first' && source === 'kkt_work_units';
  });
  const derivedQty = Number(kktInPackageService?.defaultQtyInPreset?.[normalizedPackageId]);
  if (Number.isFinite(derivedQty) && derivedQty >= 0) return Math.trunc(derivedQty);
  return Number(KKT_INCLUDED_FALLBACK[normalizedPackageId] ?? 0);
}

function normalizeEquipment(equipment) {
  return {
    regularCount: Number(equipment?.regularCount || 0),
    smartCount: Number(equipment?.smartCount || 0),
    otherCount: Number(equipment?.otherCount || 0),
    scannersCount: Number(equipment?.scannersCount || 0),
    printersCount: Number(equipment?.printersCount || 0),
  };
}

function normalizeServiceLine(matrixService, packageId) {
  const kktIncludedWorkUnits = getKktIncludedWorkUnits(packageId);
  const qty = Number(matrixService.defaultQtyInPreset?.[packageId] ?? 0);
  const unit = Number(matrixService.unitHoursByPackage?.[packageId] ?? 0);
  const autoBasis = matrixService.autoDriver === 'none' ? '' : matrixService.autoDriver;
  const autoQtySource = matrixService.autoQtySource || mapAutoQtySource(autoBasis);
  const autoFrom = autoBasis ? `${autoBasis}_total` : '';
  return {
    id: matrixService.serviceId,
    title: matrixService.title,
    group: matrixService.categoryTitle,
    group_id: matrixService.categoryId,
    hours_per_unit: unit,
    unit_hours: unit,
    qty,
    qty_current: qty,
    qty_mode: autoBasis ? 'auto' : 'manual',
    auto_from: autoFrom,
    auto_multiplier: 1,
    preset_qty: qty,
    preset_qty_mode: autoBasis ? 'auto' : 'manual',
    manual_qty_override: false,
    qty_auto: autoBasis ? qty : null,
    auto_basis: autoBasis,
    auto_qty_source: autoQtySource,
    kkt_included_work_units: kktIncludedWorkUnits,
    unit_hours_source: `matrix:${packageId}`,
  };
}

function mapAutoQtySource(autoBasis) {
  if (autoBasis === 'kkt' || autoBasis === 'kkt_first' || autoBasis === 'kkt_extra') return 'kkt_work_units';
  if (autoBasis === 'kkt_physical') return 'kkt_physical';
  if (autoBasis === 'scanner' || autoBasis === 'scanner_first' || autoBasis === 'scanner_extra') return 'scanners';
  if (autoBasis === 'printer') return 'printers';
  return '';
}

export function getPackagePreset(packageId, isDetailed = false) {
  const selectedId = String(packageId || '').trim() || 'wholesale_only';
  const services = SERVICE_MATRIX.map((service) => normalizeServiceLine(service, selectedId));
  return {
    services,
    diagnostics: {
      selectedPackageId: String(packageId || ''),
      isDetailed: !!isDetailed,
      source: 'service_matrix_v5',
      hasServices: services.length > 0,
      serviceCatalogIds: SERVICE_MATRIX.map((entry) => entry.serviceId),
    },
  };
}

export function buildServiceMapFromPreset(services) { const m = new Map(); (services || []).forEach((s) => s?.id && m.set(String(s.id), s)); return m; }

function getAutoQtyBySource(source, basis, equipment, multiplier = 1, kktIncludedWorkUnits = 0) {
  const eq = normalizeEquipment(equipment);
  const kktPhysicalCount = eq.regularCount + eq.smartCount + eq.otherCount;
  const kktWorkUnits = eq.regularCount + (eq.smartCount * 2) + (eq.otherCount * 2);
  const includedWorkUnits = Math.max(0, Math.trunc(Number(kktIncludedWorkUnits) || 0));
  const safeMultiplier = Number.isFinite(Number(multiplier)) && Number(multiplier) > 0 ? Number(multiplier) : 1;
  if (source === 'scanners' && basis === 'scanner') return Math.max(0, Math.trunc(eq.scannersCount * safeMultiplier));
  if (source === 'scanners' && basis === 'scanner_first') return eq.scannersCount > 0 ? 1 : 0;
  if (source === 'scanners' && basis === 'scanner_extra') return Math.max(0, eq.scannersCount - 1);
  if (source === 'printers') return Math.max(0, Math.trunc(eq.printersCount * safeMultiplier));
  if (source === 'kkt_physical') return Math.max(0, Math.trunc(kktPhysicalCount * safeMultiplier));
  if (basis === 'kkt_first') return Math.min(kktWorkUnits, includedWorkUnits);
  if (basis === 'kkt_extra') return Math.max(kktWorkUnits - includedWorkUnits, 0);
  if (source === 'scanners') return Math.max(0, Math.trunc(eq.scannersCount * safeMultiplier));
  if (source === 'printers') return Math.max(0, Math.trunc(eq.printersCount * safeMultiplier));
  if (source === 'kkt_physical') return Math.max(0, Math.trunc(kktPhysicalCount * safeMultiplier));
  return Math.max(0, Math.trunc(kktWorkUnits * safeMultiplier));
}

export function applyEquipmentToServices(services, equipment) {
  const list = services || [];
  list.forEach((service) => {
    const basis = String(service?.auto_basis || '').trim();
    if (!basis) return;
    const source = String(service?.auto_qty_source || mapAutoQtySource(basis)).trim();
    const autoQty = getAutoQtyBySource(
      source,
      basis,
      equipment,
      service.auto_multiplier,
      service.kkt_included_work_units,
    );
    service.qty_auto = autoQty;
    if (service.manual_qty_override) {
      const m = Number(service.qty_current ?? service.qty ?? 0);
      service.qty = Number.isFinite(m) ? Math.max(0, Math.trunc(m)) : 0;
      service.qty_current = service.qty;
      service.qty_mode = 'manual';
      return;
    }
    service.qty = autoQty;
    service.qty_current = autoQty;
    service.qty_mode = 'auto';
  });
  return list;
}

export function isEquipmentAvailable() { return true; }
export function isKktAvailable() { return true; }
export function isScannerAvailable() { return true; }

const EQUIPMENT_DEFAULTS_BY_PACKAGE = PACKAGE_DEFAULTS;
export function getEquipmentDefaults(packageId) {
  const defaults = EQUIPMENT_DEFAULTS_BY_PACKAGE[String(packageId || '')] || EQUIPMENT_DEFAULTS_BY_PACKAGE.wholesale_only;
  return {
    kkt: {
      regularCount: Number(defaults.kkt?.regularCount || 0),
      smartCount: Number(defaults.kkt?.smartCount || 0),
      otherCount: Number(defaults.kkt?.otherCount || 0),
    },
    scannersCount: Number(defaults.scannersCount || 0),
    printersCount: Number(defaults.printersCount || 0),
  };
}

export const buildDefaultEquipment = getEquipmentDefaults;
export const buildPresetServices = getPackagePreset;
export function applyAutoFromEquipment(services, equipment) { return applyEquipmentToServices(services, equipment); }
export function computeTotals(services, rateOverride) { return calcServiceTotalsFromServices(services, rateOverride); }
export const calcServiceTotals = computeTotals;

export function getPackagePresetTotals(packageId, detailed = false) {
  const { services } = getPackagePreset(packageId, detailed);
  const defaults = getEquipmentDefaults(packageId);
  applyEquipmentToServices(services, {
    regularCount: defaults.kkt.regularCount,
    smartCount: defaults.kkt.smartCount,
    otherCount: defaults.kkt.otherCount,
    scannersCount: defaults.scannersCount,
    printersCount: defaults.printersCount,
  });
  return computeTotals(services);
}

function calcRowHours(service) {
  const qty = Number(service?.qty_current ?? service?.qty ?? 0);
  const unit = Number(service?.unit_hours ?? service?.hours_per_unit ?? 0);
  return unit * qty;
}

export function calcServiceTotalsFromServices(services, rateOverride) {
  const list = Array.isArray(services) ? services : Object.values(services || {});
  const matrixRate = Number(getDataSync()?.manager_matrix_v5?.rate_per_hour ?? 4950);
  const rate = Number(rateOverride ?? matrixRate);
  const safeRate = Number.isFinite(rate) && rate > 0 ? rate : 4950;
  const totalHours = list.reduce((sum, svc) => sum + calcRowHours(svc), 0);
  const totalRub = Math.round(totalHours * safeRate);
  return { totalHours, totalRub };
}

export function validatePackagePresets() {
  const issues = [];
  PACKAGE_IDS.forEach((packageId) => {
    const { services } = getPackagePreset(packageId, false);
    if (!Array.isArray(services) || !services.length) issues.push({ packageId });
  });
  return issues;
}
