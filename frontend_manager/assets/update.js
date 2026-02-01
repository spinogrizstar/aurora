// ФАЙЛ: frontend/assets/update.js
// ------------------------------------------------------------
// update() = «пересчитать и обновить правую панель».
//
// Приоритет:
//   1) Пытаемся спросить бэкенд (/api/v5/calculate)
//   2) Если не получилось — считаем локально (calc.js)
// ------------------------------------------------------------

import { state } from './state.js';
import { calcServicesAndLicenses, choosePackage, needDiagnostics, calcManagerTotals } from './calc.js';
import { getDataSync } from './data.js';
import { renderFromCalc } from './ui/summary.js';

// Последний результат — нужен для «Скопировать КП / Запросить пресейл»
export let lastResult = {
  prelim: false,
  pkg: null,
  calc: { points: 0, rub: 0, licRub: 0, serviceItems: [], licItems: [] },
  costs: { base: 0, diag: 0, support: 0, total: 0 },
  managerTotals: { packageHours: 0, addonHours: 0, totalHours: 0, totalRub: 0, breakdown: { addons: [], kktPrepareHours: 0 } },
  hint: '',
};

function _emptyState(hintText) {
  const calc = { points: 0, rub: 0, licRub: 0, serviceItems: [], licItems: [] };
  const costs = { base: 0, diag: 0, support: 0, total: 0 };
  const managerTotals = { packageHours: 0, addonHours: 0, totalHours: 0, totalRub: 0, breakdown: { addons: [], kktPrepareHours: 0 } };
  const hint = hintText || 'Выберите тип клиента слева — и мы покажем пакет, состав работ и расчёт.';
  lastResult = { prelim: false, pkg: null, calc, costs, managerTotals, hint };
  renderFromCalc(null, calc, false, costs, hint, managerTotals);
}

function _localUpdate() {
  const calc = calcServicesAndLicenses();
  const { pkg } = choosePackage(calc.points);
  if (!pkg) {
    _emptyState();
    return;
  }
  const prelim = needDiagnostics();
  const DATA = getDataSync();
  const corePackages = DATA?.core_packages?.packages || [];
  const managerTotals = calcManagerTotals(state, DATA, corePackages);
  const costs = {
    base: managerTotals.packageHours * 4950,
    diag: 0,
    support: 0,
    total: managerTotals.totalRub,
  };
  let hint = prelim ? 'Сначала диагностика ККТ, после — подтверждаем пакет/итог.' : 'Пакет и сумма рассчитаны по чек‑листу.';
  lastResult = { prelim, pkg, calc, costs, managerTotals, hint };
  renderFromCalc(pkg, calc, prelim, costs, hint, managerTotals);
}

export async function update() {
  const DATA = getDataSync();
  if (DATA?.__loadError) {
    _emptyState('Данные не загрузились. Проверьте папку data/*.json — интерфейс работает, но без расчёта.');
    return;
  }
  // Пока сегмент не выбран — показываем пустое состояние.
  if (!(state.segments || []).length || !state.selectedPackageId) {
    _emptyState('Выберите тип клиента слева — и мы покажем пакет, состав работ и расчёт.');
    return;
  }
  _localUpdate();
}
