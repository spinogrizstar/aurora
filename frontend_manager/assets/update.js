// ФАЙЛ: frontend/assets/update.js
// ------------------------------------------------------------
// update() = «пересчитать и обновить правую панель».
//
// Приоритет:
//   1) Пытаемся спросить бэкенд (/api/v5/calculate)
//   2) Если не получилось — считаем локально (calc.js)
// ------------------------------------------------------------

import { state } from './state.js';
import { calcServicesAndLicenses, needDiagnostics, calcManagerTotals } from './calc.js';
import { getDataSync } from './data.js';
import { renderFromCalc } from './ui/summary.js';
import { ensureServicesForPackage } from './services.js';

// Последний результат — нужен для «Скопировать КП / Запросить пресейл»
export let lastResult = {
  prelim: false,
  pkg: null,
  calc: { points: 0, rub: 0, licRub: 0, serviceItems: [], licItems: [] },
  costs: { base: 0, diag: 0, support: 0, total: 0 },
  managerTotals: { totalHours: 0, totalRub: 0, error: '' },
  hint: '',
};

function _emptyState(hintText) {
  const calc = { points: 0, rub: 0, licRub: 0, serviceItems: [], licItems: [] };
  const costs = { base: 0, diag: 0, support: 0, total: 0 };
  const managerTotals = { totalHours: 0, totalRub: 0, error: '' };
  const hint = hintText || 'Выберите тип клиента слева — и мы покажем пакет, состав работ и расчёт.';
  lastResult = { prelim: false, pkg: null, calc, costs, managerTotals, hint };
  renderFromCalc(null, calc, false, costs, hint, managerTotals);
}

function _localUpdate() {
  const DATA = getDataSync();
  const corePackages = DATA?.core_packages?.packages || [];
  const selectedId = String(state.selectedPackageId || '');
  const selectedPkg = corePackages.find(pkg => String(pkg?.id || pkg?.segment_key || '') === selectedId) || null;
  if (!selectedPkg) {
    _emptyState('Выберите тип клиента слева — и мы покажем пакет, состав работ и расчёт.');
    return;
  }
  const calc = calcServicesAndLicenses();
  ensureServicesForPackage(selectedId);
  const prelim = needDiagnostics();
  const managerTotals = calcManagerTotals(state);
  const costs = {
    base: managerTotals.totalRub,
    diag: 0,
    support: 0,
    total: managerTotals.totalRub,
  };
  let hint = prelim ? 'Сначала диагностика ККТ, после — подтверждаем пакет/итог.' : 'Пакет и сумма рассчитаны по чек‑листу.';
  lastResult = { prelim, pkg: selectedPkg, calc, costs, managerTotals, hint };
  renderFromCalc(selectedPkg, calc, prelim, costs, hint, managerTotals);
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
