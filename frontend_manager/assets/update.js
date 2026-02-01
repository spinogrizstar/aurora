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
import { renderFromCalc } from './ui/summary.js';

// Последний результат — нужен для «Скопировать КП / Запросить пресейл»
export let lastResult = {
  prelim: false,
  pkg: null,
  calc: { points: 0, rub: 0, licRub: 0, serviceItems: [], licItems: [] },
  costs: { base: 0, diag: 0, support: 0, total: 0 },
  managerTotals: { base_hours: 0, addons_hours: 0, total_hours: 0, total_rub: 0, addons: [] },
  hint: '',
};

function _emptyState() {
  const calc = { points: 0, rub: 0, licRub: 0, serviceItems: [], licItems: [] };
  const costs = { base: 0, diag: 0, support: 0, total: 0 };
  const managerTotals = { base_hours: 0, addons_hours: 0, total_hours: 0, total_rub: 0, addons: [] };
  const hint = 'Выбери сегмент слева — и мы покажем пакет, состав работ и расчёт.';
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
  const managerTotals = calcManagerTotals(pkg);
  const costs = {
    base: managerTotals.base_hours * 4950,
    diag: 0,
    support: 0,
    total: managerTotals.total_rub,
  };
  let hint = prelim ? 'Сначала диагностика ККТ, после — подтверждаем пакет/итог.' : 'Пакет и сумма рассчитаны по чек‑листу.';
  lastResult = { prelim, pkg, calc, costs, managerTotals, hint };
  renderFromCalc(pkg, calc, prelim, costs, hint, managerTotals);
}

export async function update() {
  // Пока сегмент не выбран — показываем пустое состояние.
  if (!(state.segments || []).length) {
    _emptyState();
    return;
  }
  _localUpdate();
}
