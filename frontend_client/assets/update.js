// ФАЙЛ: frontend/assets/update.js
// ------------------------------------------------------------
// update() = «пересчитать и обновить правую панель».
//
// Приоритет:
//   1) Пытаемся спросить бэкенд (/api/v5/calculate)
//   2) Если не получилось — считаем локально (calc.js)
// ------------------------------------------------------------

import { state } from './state.js';
import { devicesPayload, segText } from './helpers.js';
import { calcServicesAndLicenses, choosePackage, buildCosts, needDiagnostics } from './calc.js';
import { renderFromCalc } from './ui/summary.js';

let _reqSeq = 0;

// Последний результат — нужен для «Скопировать КП / Запросить пресейл»
export let lastResult = {
  prelim: false,
  pkg: null,
  calc: { points: 0, rub: 0, licRub: 0, serviceItems: [], licItems: [] },
  costs: { base: 0, diag: 0, support: 0, total: 0 },
  hint: '',
};

function _emptyState() {
  const calc = { points: 0, rub: 0, licRub: 0, serviceItems: [], licItems: [] };
  const costs = { base: 0, diag: 0, support: 0, total: 0 };
  const hint = 'Выбери сегмент слева — и мы покажем пакет, состав работ и расчёт.';
  lastResult = { prelim: false, pkg: null, calc, costs, hint };
  renderFromCalc(null, calc, false, costs, hint);
}

function _localUpdate() {
  const calc = calcServicesAndLicenses();
  const pkg = choosePackage(calc.points);
  if (!pkg) {
    _emptyState();
    return;
  }
  const prelim = needDiagnostics();
  const costs = buildCosts(pkg, calc);
  const hint = prelim ? 'Сначала диагностика ККТ, после — подтверждаем пакет/итог.' : 'Пакет и сумма рассчитаны по чек‑листу.';
  lastResult = { prelim, pkg, calc, costs, hint };
  renderFromCalc(pkg, calc, prelim, costs, hint);
}

export async function update() {
  // Пока сегмент не выбран — показываем пустое состояние.
  if (!(state.segments || []).length) {
    _emptyState();
    return;
  }

  const my = ++_reqSeq;
  try {
    const r = await fetch('/api/v5/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...state,
        devices: devicesPayload(),
      }),
    });

    if (!r.ok) throw new Error(await r.text());
    const res = await r.json();
    if (my !== _reqSeq) return;

    const pkg = res.package;
    const calc = {
      points: res.calc.points,
      rub: res.calc.rub,
      licRub: res.calc.licRub,
      serviceItems: res.calc.serviceItems || [],
      licItems: res.calc.licItems || [],
    };
    const prelim = false; // диагностику не навязываем
    const costs = {
      base: res.costs.base_rub,
      diag: 0,
      support: res.costs.support_rub,
      total: res.costs.total_rub,
    };
    const hint = res.hint || 'Пакет и сумма рассчитаны по чек‑листу.';

    lastResult = { prelim, pkg, calc, costs, hint };
    renderFromCalc(pkg, calc, prelim, costs, hint);
  } catch (e) {
    console.warn('API v5 недоступен, считаю локально:', e);
    _localUpdate();
  }
}
