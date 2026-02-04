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

const SUMMARY_FALLBACK = {
  retail_only: [
    { id: 'reg_chz', title: 'Регистрация в ЧЗ', hours_per_unit: 1, qty: 1, group: 'Регистрация ЧЗ' },
    { id: 'accounting_integration', title: 'Интеграция с товароучёткой', hours_per_unit: 5, qty: 1, group: 'Интеграция/учёт' },
    { id: 'equipment_prep', title: 'Подготовка оборудования', hours_per_unit: 2, qty: 1, group: 'Оборудование/ККТ' },
    { id: 'training', title: 'Обучение', hours_per_unit: 1, qty: 1, group: 'Обучение' },
  ],
  wholesale_only: [
    { id: 'reg_chz', title: 'Регистрация в ЧЗ', hours_per_unit: 1, qty: 1, group: 'Регистрация ЧЗ' },
    { id: 'accounting_integration', title: 'Интеграция с товароучёткой', hours_per_unit: 4, qty: 1, group: 'Интеграция/учёт' },
    { id: 'equipment_prep', title: 'Подготовка оборудования', hours_per_unit: 1, qty: 1, group: 'Оборудование/ККТ' },
    { id: 'training', title: 'Обучение', hours_per_unit: 1, qty: 1, group: 'Обучение' },
  ],
  producer_only: [
    { id: 'reg_chz_gs1', title: 'Регистрация в ЧЗ/ГС1', hours_per_unit: 2, qty: 1, group: 'Регистрация ЧЗ' },
    { id: 'accounting_integration', title: 'Интеграция с товароучёткой', hours_per_unit: 5, qty: 1, group: 'Интеграция/учёт' },
    { id: 'equipment_prep', title: 'Подготовка оборудования', hours_per_unit: 4, qty: 1, group: 'Оборудование/ККТ' },
    { id: 'training', title: 'Обучение', hours_per_unit: 1, qty: 1, group: 'Обучение' },
  ],
  producer_retail: [
    { id: 'reg_chz_gs1', title: 'Регистрация в ЧЗ/ГС1', hours_per_unit: 2, qty: 1, group: 'Регистрация ЧЗ' },
    { id: 'accounting_integration', title: 'Интеграция с товароучёткой', hours_per_unit: 8, qty: 1, group: 'Интеграция/учёт' },
    { id: 'equipment_prep', title: 'Подготовка оборудования', hours_per_unit: 7, qty: 1, group: 'Оборудование/ККТ' },
    { id: 'training', title: 'Обучение', hours_per_unit: 1, qty: 1, group: 'Обучение' },
  ],
};

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
  return DATA?.manager_matrix_v5 || { rate_per_hour: 4950, packages: {} };
}

function _matrixPackage(packageId) {
  const matrix = _matrixData();
  return matrix.packages?.[packageId] || { summary: [], detailed: [] };
}

function _getPackageList(pkg, primaryKey, fallbackKey) {
  if (Array.isArray(pkg?.[primaryKey])) return pkg[primaryKey];
  if (Array.isArray(pkg?.[fallbackKey])) return pkg[fallbackKey];
  return [];
}

function _buildServiceCatalog(matrix) {
  const catalog = new Map();
  const packages = matrix?.packages || {};
  Object.values(packages || {}).forEach((pkg) => {
    [
      ['summary', 'servicesSummary'],
      ['detailed', 'servicesDetailed'],
    ].forEach(([primaryKey, fallbackKey]) => {
      const list = _getPackageList(pkg, primaryKey, fallbackKey);
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

function normalizeServiceLine(rawService, catalogEntry) {
  const base = rawService || {};
  const catalog = catalogEntry || {};
  const id = String(base.id || base.key || catalog.id || '').trim();
  const title = base.title || catalog.title || id;
  const group = base.group || catalog.group || 'Прочее';
  const hoursPerUnit = base.hours_per_unit ?? base.hoursPerUnit ?? catalog.hours_per_unit ?? catalog.hoursPerUnit ?? 0;
  const qtyValue = base.qty ?? catalog.qty ?? 0;
  const autoFrom = base.auto_from ?? base.autoFrom ?? catalog.auto_from ?? catalog.autoFrom ?? '';
  const autoMultiplier = Number(base.auto_multiplier ?? base.autoMultiplier ?? catalog.auto_multiplier ?? catalog.autoMultiplier ?? 1);
  const qtyMode = base.qty_mode || base.qtyMode || (autoFrom ? 'auto' : 'manual');
  const normalizedQty = Number.isFinite(Number(qtyValue)) ? Math.max(0, Math.trunc(Number(qtyValue))) : 0;

  return {
    id,
    title,
    group,
    hours_per_unit: Number(hoursPerUnit) || 0,
    qty: normalizedQty,
    qty_mode: qtyMode === 'auto' ? 'auto' : 'manual',
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
  const pkg = _matrixPackage(packageId);
  const detailedList = _getPackageList(pkg, 'detailed', 'servicesDetailed');
  const summaryList = _getPackageList(pkg, 'summary', 'servicesSummary');

  let rawPreset = detailed ? detailedList : summaryList;
  let source = detailed ? 'detailed' : 'summary';

  if (!rawPreset.length && detailed && summaryList.length) {
    rawPreset = summaryList;
    source = 'summary_fallback';
  }
  if (!rawPreset.length && !detailed && detailedList.length) {
    rawPreset = detailedList;
    source = 'detailed_fallback';
  }

  if (!rawPreset.length) {
    const fallback = SUMMARY_FALLBACK[String(packageId || '')];
    if (fallback && fallback.length) {
      rawPreset = fallback;
      source = 'summary_fallback_map';
    }
  }

  const catalog = _buildServiceCatalog(matrix);
  const normalized = (rawPreset || []).map((service) => {
    const id = String(service?.id || '').trim();
    const catalogEntry = id ? catalog.get(id) : null;
    return normalizeServiceLine(service, catalogEntry);
  }).filter((svc) => svc.id);

  const hasServices = normalized.length > 0;
  const diagnostics = {
    selectedPackageId: String(packageId || ''),
    isDetailed: !!detailed,
    source,
    hasServices,
    serviceCatalogIds: Array.from(catalog.keys()),
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

export function applyAutoFromEquipment(services, equipment, packageId, { allowEquipmentOverride = false } = {}) {
  const list = services || [];
  const scanners = Number(equipment?.scannersCount || 0);
  const regular = Number(equipment?.regularCount || 0);
  const smart = Number(equipment?.smartCount || 0);
  const other = Number(equipment?.otherCount || 0);
  const kktTotal = regular + smart + other;

  const allowKktAuto = isKktAvailable(packageId) || allowEquipmentOverride;
  const allowScannerAuto = isScannerAvailable(packageId) || allowEquipmentOverride;

  list.forEach((service) => {
    if (!service || service.qty_mode !== 'auto') return;
    const autoFrom = String(service.auto_from || '').trim();
    const multiplier = Number(service.auto_multiplier || 1);
    let base = null;

    if (autoFrom === 'kkt_total' && allowKktAuto) base = kktTotal;
    if (autoFrom === 'scanner_total' && allowScannerAuto) base = scanners;
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
  PACKAGE_IDS.forEach((packageId) => {
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
