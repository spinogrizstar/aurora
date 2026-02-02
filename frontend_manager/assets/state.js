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
  scannersManuallySet: false,

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
  device_scanner: 0,
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
