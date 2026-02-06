// ФАЙЛ: frontend/assets/state.js
// ------------------------------------------------------------
// ЗАЧЕМ НУЖЕН:
//   Вся «память формы» (что выбрано галочками/счётчиками) живёт здесь.
//   Хочешь поменять дефолты (что включено при старте) — правь ТОЛЬКО здесь.
// ------------------------------------------------------------

export const state = {
  selectedPackageId: '',
  // 1) Сегменты (можно выбрать несколько)
  segments: [],
  services: [],
  servicesDetailed: false,
  servicesPackageId: '',
  servicesGroupsCollapsed: {},
  serviceOverrides: {},
  servicesPresetError: '',
  scannersAuto: true,

  // 2) ККТ: смесь типов (по количеству).
  kkt: {
    regularCount: 0,
    smartCount: 0,
    otherCount: 0,
  },
  uses_kkt: true,
  kkt_rereg: true,
  needs_rr: true,

  // 4) Устройства: два счётчика (можно мешать)
  equipment: {
    scannersCount: 0,
  },
  device_tsd: 0,
  tsd_collective: false,

  // Информационный выбор «какой уровень Клеверенса нужен».
  // Сейчас не влияет на расчёт автоматически (это подсказка/описание),
  // но сохраняется в state и может быть добавлен в Word в следующих релизах.
  cleverence_plan: 'bal',

  // 1С: конфигурация и актуальность.
  // Это нужно, чтобы:
  //   1) менеджер/клиент зафиксировал, что за 1С.
  //   2) мы могли добавить это в КП/ЛТ и (в будущем) влиять на расчёт.
  onec: {
    // id конфигурации из data.json → onec_configs[].id
    config: 'ut11',
    // true = конфигурация актуальная / обновлена; false = требуется обновление/доработки
    actual: true,
  },

  // 5) Сценарии / сложности
  custom_integration: false,

  comment: (() => {
    try {
      return localStorage.getItem('manager_v5_comment') || '';
    } catch (e) {
      return '';
    }
  })(),

  // 7) Контакты / цель
  contacts: {
    legal_name: '',
    inn: '',
    contact_name: '',
    phone: '',
    email: '',
    desired_result: '',
  },

  // Для производителя: товарные группы ЧЗ + комментарий
  product: {
    categories: [],
    comment: '',
  },
};

export const PACKAGE_DEFAULTS = {
  retail_only: {
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
  producer_retail: {
    kkt: { regularCount: 0, smartCount: 0, otherCount: 0 },
    scannersCount: 0,
  },
};

export function applyPackageDefaults(packageId) {
  const normalized = String(packageId || state.selectedPackageId || '');
  const fallback = PACKAGE_DEFAULTS.wholesale_only;
  const defaults = PACKAGE_DEFAULTS[normalized] || fallback;

  state.kkt = {
    regularCount: Number(defaults.kkt?.regularCount || 0),
    smartCount: Number(defaults.kkt?.smartCount || 0),
    otherCount: Number(defaults.kkt?.otherCount || 0),
  };

  state.equipment = {
    scannersCount: Number(defaults.scannersCount || 0),
  };

  state.scannersAuto = true;
}

export function getCalcState() {
  return {
    selectedPackageId: state.selectedPackageId,
    services: state.services,
    overrides: state.serviceOverrides,
    ui: { showDetails: state.servicesDetailed },
  };
}

export function setCalcState(next) {
  if (!next || typeof next !== 'object') return;
  if (next.selectedPackageId !== undefined) state.selectedPackageId = next.selectedPackageId;
  if (next.services !== undefined) state.services = next.services;
  if (next.overrides !== undefined) state.serviceOverrides = next.overrides;
  if (next.ui && next.ui.showDetails !== undefined) {
    state.servicesDetailed = !!next.ui.showDetails;
  }
}
