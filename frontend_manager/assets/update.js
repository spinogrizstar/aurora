// ФАЙЛ: frontend/assets/update.js
// ------------------------------------------------------------
// update() = «пересчитать и обновить правую панель».
//
// Приоритет:
//   1) Пытаемся спросить бэкенд (/api/v5/calculate)
//   2) Если не получилось — считаем локально (calc.js)
// ------------------------------------------------------------

import { state, getCalcState } from './state.js';
import { calcServicesAndLicenses, needDiagnostics } from './calc.js';
import { normalizeState, recalc } from './calc/managerV5Calc.js';
import { getDataSync } from './data.js';
import { renderFromCalc } from './ui/summary.js';
import { ensureServicesForPackage } from './services.js';

// Последний результат — нужен для «Скопировать КП / Запросить пресейл»
export let lastResult = {
  prelim: false,
  pkg: null,
  calc: { points: 0, rub: 0, licRub: 0, serviceItems: [], licItems: [] },
  costs: { base: 0, diag: 0, support: 0, total: 0 },
  managerCalc: { totals: { hours: 0, price: 0 }, breakdown: [], flags: { hasAnyWork: false, isValid: true, issues: [] } },
  managerTotals: { totalHours: 0, totalRub: 0, error: '' },
  hint: '',
};

let _lastCalcSnapshot = null;

function calcStateSnapshot(normalized) {
  return {
    selectedPackageId: normalized.selectedPackageId,
    services: normalized.services,
    overrides: normalized.overrides,
    ui: normalized.ui,
  };
}

function diffCalcState(prev, next) {
  const changes = [];
  if (!prev) {
    changes.push('init');
    return changes;
  }

  if (prev.selectedPackageId !== next.selectedPackageId) {
    changes.push(`selectedPackageId: "${prev.selectedPackageId}" → "${next.selectedPackageId}"`);
  }

  const diffMap = (label, prevMap, nextMap) => {
    const keys = new Set([
      ...Object.keys(prevMap || {}),
      ...Object.keys(nextMap || {}),
    ]);
    keys.forEach((key) => {
      const before = prevMap?.[key];
      const after = nextMap?.[key];
      if (!before && after) {
        changes.push(`${label}.${key}: +${JSON.stringify(after)}`);
        return;
      }
      if (before && !after) {
        changes.push(`${label}.${key}: removed`);
        return;
      }
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        changes.push(`${label}.${key}: ${JSON.stringify(before)} → ${JSON.stringify(after)}`);
      }
    });
  };

  diffMap('services', prev.services, next.services);
  diffMap('overrides', prev.overrides, next.overrides);

  if (JSON.stringify(prev.ui) !== JSON.stringify(next.ui)) {
    changes.push(`ui: ${JSON.stringify(prev.ui)} → ${JSON.stringify(next.ui)}`);
  }

  return changes;
}

function isDevEnv() {
  if (typeof process !== 'undefined' && process?.env?.NODE_ENV) {
    return process.env.NODE_ENV !== 'production';
  }
  if (typeof location !== 'undefined') {
    return location.hostname === 'localhost' || location.protocol === 'file:';
  }
  return false;
}

function _emptyState(hintText) {
  const calc = { points: 0, rub: 0, licRub: 0, serviceItems: [], licItems: [] };
  const costs = { base: 0, diag: 0, support: 0, total: 0 };
  const managerCalc = { totals: { hours: 0, price: 0 }, breakdown: [], flags: { hasAnyWork: false, isValid: true, issues: [] } };
  const managerTotals = { totalHours: 0, totalRub: 0, error: '' };
  const hint = hintText || 'Выберите тип клиента слева — и мы покажем пакет, состав работ и расчёт.';
  lastResult = { prelim: false, pkg: null, calc, costs, managerCalc, managerTotals, hint };
  renderFromCalc(null, calc, false, costs, hint, managerCalc);
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
  const normalized = normalizeState(getCalcState());
  const managerCalc = recalc(normalized);
  const managerTotals = {
    totalHours: managerCalc.totals.hours,
    totalRub: managerCalc.totals.price,
    error: '',
  };
  const costs = {
    base: managerTotals.totalRub,
    diag: 0,
    support: 0,
    total: managerTotals.totalRub,
  };
  let hint = prelim ? 'Сначала диагностика ККТ, после — подтверждаем пакет/итог.' : 'Пакет и сумма рассчитаны по чек‑листу.';
  lastResult = { prelim, pkg: selectedPkg, calc, costs, managerCalc, managerTotals, hint };
  renderFromCalc(selectedPkg, calc, prelim, costs, hint, managerCalc);

  if (isDevEnv()) {
    const snapshot = calcStateSnapshot(normalized);
    const changes = diffCalcState(_lastCalcSnapshot, snapshot);
    if (changes.length) {
      console.log('[Aurora][calcState]', {
        changes,
        totals: managerCalc.totals,
        issues: managerCalc.flags.issues,
      });
    }
    _lastCalcSnapshot = snapshot;
  }
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
