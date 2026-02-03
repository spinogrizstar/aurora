// ФАЙЛ: frontend/assets/services.js
// ------------------------------------------------------------
// Единый источник истины для услуг и их автологики.
// ------------------------------------------------------------

import { state } from './state.js';

export const SERVICE_GROUPS = [
  'Регистрация ЧЗ',
  'Интеграция/учёт',
  'Оборудование/ККТ',
  'Обучение',
  'Прочее',
];

const BASE_PRESETS = {
  retail_only: [
    { id: 'reg_chz', title: 'Регистрация в системе ЧЗ', hoursPerUnit: 1, qty: 1, group: 'Регистрация ЧЗ' },
    { id: 'integration', title: 'Интеграция с товароучёткой', hoursPerUnit: 3, qty: 1, group: 'Интеграция/учёт' },
    { id: 'equipment_prep', title: 'Подготовка оборудования', hoursPerUnit: 4, qty: 1, group: 'Оборудование/ККТ' },
    { id: 'training', title: 'Обучение', hoursPerUnit: 1, qty: 1, group: 'Обучение' },
  ],
  wholesale_only: [
    { id: 'reg_chz', title: 'Регистрация в системе ЧЗ', hoursPerUnit: 1, qty: 1, group: 'Регистрация ЧЗ' },
    { id: 'integration', title: 'Интеграция с товароучёткой', hoursPerUnit: 4, qty: 1, group: 'Интеграция/учёт' },
    { id: 'equipment_prep', title: 'Подготовка оборудования', hoursPerUnit: 1, qty: 1, group: 'Оборудование/ККТ' },
    { id: 'training', title: 'Обучение', hoursPerUnit: 1, qty: 1, group: 'Обучение' },
  ],
  producer_only: [
    { id: 'reg_chz', title: 'Регистрация в системе ЧЗ', hoursPerUnit: 2, qty: 1, group: 'Регистрация ЧЗ' },
    { id: 'integration', title: 'Интеграция с товароучёткой', hoursPerUnit: 5, qty: 1, group: 'Интеграция/учёт' },
    { id: 'equipment_prep', title: 'Подготовка оборудования', hoursPerUnit: 4, qty: 1, group: 'Оборудование/ККТ' },
    { id: 'training', title: 'Обучение', hoursPerUnit: 1, qty: 1, group: 'Обучение' },
  ],
  producer_retail: [
    { id: 'reg_chz', title: 'Регистрация в системе ЧЗ', hoursPerUnit: 2, qty: 1, group: 'Регистрация ЧЗ' },
    { id: 'integration', title: 'Интеграция с товароучёткой', hoursPerUnit: 8, qty: 1, group: 'Интеграция/учёт' },
    { id: 'equipment_prep', title: 'Подготовка оборудования', hoursPerUnit: 7, qty: 1, group: 'Оборудование/ККТ' },
    { id: 'training', title: 'Обучение', hoursPerUnit: 1, qty: 1, group: 'Обучение' },
  ],
};

const DETAILED_PRESETS = {
  retail_only: [
    { id: 'reg_chz', title: 'Регистрация в системе ЧЗ', hoursPerUnit: 1, qty: 1, group: 'Регистрация ЧЗ' },
    { id: 'edo_setup', title: 'Настройка ЭДО', hoursPerUnit: 2, qty: 1, group: 'Интеграция/учёт' },
    { id: 'integration', title: 'Интеграция с товароучёткой', hoursPerUnit: 2, qty: 1, group: 'Интеграция/учёт' },
    { id: 'ts_piot', title: 'ТС ПИОТ', hoursPerUnit: 1, qty: 0, group: 'Интеграция/учёт' },
    { id: 'lm_chz', title: 'ЛМ ЧЗ', hoursPerUnit: 2, qty: 1, group: 'Интеграция/учёт' },
    { id: 'kkt_firmware', title: 'Прошивка ККТ', hoursPerUnit: 1, qty: 0, group: 'Оборудование/ККТ' },
    { id: 'fn_replace', title: 'Замена ФН', hoursPerUnit: 1, qty: 0, group: 'Оборудование/ККТ' },
    { id: 'scanner_connect', title: 'Подключение сканера', hoursPerUnit: 1, qty: 1, group: 'Оборудование/ККТ' },
    { id: 'kkt_connect', title: 'Подключение ККТ к товароучётке', hoursPerUnit: 1, qty: 1, group: 'Оборудование/ККТ' },
    { id: 'training', title: 'Обучение', hoursPerUnit: 1, qty: 1, group: 'Обучение' },
  ],
  wholesale_only: [
    { id: 'reg_chz', title: 'Регистрация в системе ЧЗ', hoursPerUnit: 1, qty: 1, group: 'Регистрация ЧЗ' },
    { id: 'edo_setup', title: 'Настройка ЭДО', hoursPerUnit: 2, qty: 1, group: 'Интеграция/учёт' },
    { id: 'integration', title: 'Интеграция с товароучёткой', hoursPerUnit: 2, qty: 1, group: 'Интеграция/учёт' },
    { id: 'lm_chz', title: 'ЛМ ЧЗ', hoursPerUnit: 2, qty: 1, group: 'Интеграция/учёт' },
    { id: 'scanner_connect', title: 'Подключение сканера', hoursPerUnit: 1, qty: 1, group: 'Оборудование/ККТ' },
    { id: 'training', title: 'Обучение', hoursPerUnit: 1, qty: 1, group: 'Обучение' },
  ],
  producer_only: [
    { id: 'reg_chz', title: 'Регистрация в системе ЧЗ', hoursPerUnit: 1, qty: 1, group: 'Регистрация ЧЗ' },
    { id: 'edo_setup', title: 'Настройка ЭДО', hoursPerUnit: 2, qty: 1, group: 'Интеграция/учёт' },
    { id: 'integration', title: 'Интеграция с товароучёткой', hoursPerUnit: 2, qty: 1, group: 'Интеграция/учёт' },
    { id: 'ts_piot', title: 'ТС ПИОТ', hoursPerUnit: 1, qty: 0, group: 'Интеграция/учёт' },
    { id: 'lm_chz', title: 'ЛМ ЧЗ', hoursPerUnit: 2, qty: 1, group: 'Интеграция/учёт' },
    { id: 'catalog_cards', title: 'Создание карточек товаров', hoursPerUnit: 1, qty: 1, group: 'Интеграция/учёт' },
    { id: 'kkt_firmware', title: 'Прошивка ККТ', hoursPerUnit: 1, qty: 0, group: 'Оборудование/ККТ' },
    { id: 'fn_replace', title: 'Замена ФН', hoursPerUnit: 1, qty: 0, group: 'Оборудование/ККТ' },
    { id: 'scanner_connect', title: 'Подключение сканера', hoursPerUnit: 1, qty: 1, group: 'Оборудование/ККТ' },
    { id: 'kkt_connect', title: 'Подключение ККТ к товароучётке', hoursPerUnit: 1, qty: 1, group: 'Оборудование/ККТ' },
    { id: 'training', title: 'Обучение', hoursPerUnit: 1, qty: 1, group: 'Обучение' },
  ],
  producer_retail: [
    { id: 'reg_chz', title: 'Регистрация в системе ЧЗ', hoursPerUnit: 1, qty: 1, group: 'Регистрация ЧЗ' },
    { id: 'edo_setup', title: 'Настройка ЭДО', hoursPerUnit: 2, qty: 1, group: 'Интеграция/учёт' },
    { id: 'integration', title: 'Интеграция с товароучёткой', hoursPerUnit: 2, qty: 1, group: 'Интеграция/учёт' },
    { id: 'ts_piot', title: 'ТС ПИОТ', hoursPerUnit: 1, qty: 0, group: 'Интеграция/учёт' },
    { id: 'lm_chz', title: 'ЛМ ЧЗ', hoursPerUnit: 2, qty: 1, group: 'Интеграция/учёт' },
    { id: 'catalog_cards', title: 'Создание карточек товаров', hoursPerUnit: 1, qty: 1, group: 'Интеграция/учёт' },
    { id: 'kkt_firmware', title: 'Прошивка ККТ', hoursPerUnit: 1, qty: 0, group: 'Оборудование/ККТ' },
    { id: 'fn_replace', title: 'Замена ФН', hoursPerUnit: 1, qty: 0, group: 'Оборудование/ККТ' },
    { id: 'scanner_connect', title: 'Подключение сканера', hoursPerUnit: 1, qty: 1, group: 'Оборудование/ККТ' },
    { id: 'kkt_connect', title: 'Подключение ККТ к товароучётке', hoursPerUnit: 1, qty: 1, group: 'Оборудование/ККТ' },
    { id: 'kepa_order', title: 'Заказ КЭП', hoursPerUnit: 1, qty: 1, group: 'Оборудование/ККТ' },
    { id: 'tsd_setup', title: 'Настройка ТСД', hoursPerUnit: 2, qty: 1, group: 'Оборудование/ККТ' },
    { id: 'training', title: 'Обучение', hoursPerUnit: 1, qty: 1, group: 'Обучение' },
  ],
};

const AUTO_BY_SCANNER = new Set(['scanner_connect']);

function _serviceDefaults(preset, scanners) {
  return (preset || []).map((service) => {
    let qty = Number(service.qty ?? 0);
    let isAuto = false;
    if (AUTO_BY_SCANNER.has(service.id)) {
      qty = scanners;
      isAuto = true;
    }
    return {
      ...service,
      qty,
      isAuto,
      manuallySet: false,
    };
  });
}

export function getServicePreset(packageId, detailed, scanners) {
  const presets = detailed ? DETAILED_PRESETS : BASE_PRESETS;
  return _serviceDefaults(presets[packageId] || [], scanners);
}

export function applyPackagePreset(packageId) {
  const scanners = Number(state.device_scanner || 0);
  state.services = getServicePreset(packageId, state.servicesDetailed, scanners);
  state.servicesPackageId = packageId;
}

export function ensureServicesForPackage(packageId) {
  if (!packageId) return;
  if (state.servicesPackageId !== packageId || !Array.isArray(state.services) || !state.services.length) {
    applyPackagePreset(packageId);
  }
}

export function syncAutoServiceQuantities() {
  const scanners = Number(state.device_scanner || 0);
  (state.services || []).forEach((service) => {
    if (service.manuallySet) return;
    if (AUTO_BY_SCANNER.has(service.id)) {
      service.qty = scanners;
      service.isAuto = true;
    }
  });
}

export function calcServiceTotals(services) {
  const list = services || [];
  const totalHours = list.reduce((sum, svc) => {
    return sum + Number(svc.hoursPerUnit || 0) * Number(svc.qty || 0);
  }, 0);
  const totalRub = totalHours * 4950;
  return { totalHours, totalRub };
}
