// ФАЙЛ: frontend/assets/calc/managerV5Calc.js
// ------------------------------------------------------------
// Единый расчёт менеджера (v5): normalizeState → recalc → validate.
// ------------------------------------------------------------

import { getDataSync } from '../data.js';

const DEFAULT_RATE_PER_HOUR = 4950;

function getRatePerHour() {
  const DATA = getDataSync();
  const rate = Number(DATA?.manager_matrix_v5?.rate_per_hour ?? DEFAULT_RATE_PER_HOUR);
  return Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_RATE_PER_HOUR;
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

function normalizeNumber(value, { integer = false, min = 0 } = {}, issues) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    if (issues) issues.add('NAN_FIXED');
    return min;
  }
  const normalized = integer ? Math.trunc(num) : num;
  if (normalized < min) return min;
  return normalized;
}

function normalizeOverride(value, issues, { integer = false } = {}) {
  if (value === null || value === undefined || value === '') return null;
  return normalizeNumber(value, { integer, min: 0 }, issues);
}

function normalizeServices(rawServices, rawOverrides, issues) {
  const list = Array.isArray(rawServices)
    ? rawServices
    : Object.values(rawServices || {});
  const overrides = rawOverrides && typeof rawOverrides === 'object' ? rawOverrides : {};
  const services = {};

  list.forEach((svc) => {
    if (!svc) return;
    const key = String(svc.id || svc.key || svc.title || '').trim();
    if (!key) return;
    services[key] = {
      key,
      title: svc.title || key,
      group: svc.group || 'Прочее',
      qty: normalizeNumber(svc.qty, { integer: true, min: 0 }, issues),
      hours_per_unit: normalizeNumber(
        svc.hours_per_unit ?? svc.hoursPerUnit,
        { integer: false, min: 0 },
        issues,
      ),
      enabled: !!svc.enabled,
    };
  });

  const normalizedOverrides = {};
  Object.keys(overrides || {}).forEach((key) => {
    const raw = overrides[key] || {};
    normalizedOverrides[key] = {
      qtyOverride: normalizeOverride(raw.qtyOverride, issues, { integer: true }),
      hoursOverride: normalizeOverride(raw.hoursOverride, issues, { integer: false }),
    };
  });

  return { services, overrides: normalizedOverrides };
}

export function normalizeState(rawState = {}) {
  const issues = new Set();
  const selectedPackageId = String(rawState.selectedPackageId || '');
  const { services, overrides } = normalizeServices(
    rawState.services,
    rawState.overrides || rawState.serviceOverrides,
    issues,
  );

  const normalized = {
    selectedPackageId,
    services,
    overrides,
    ui: {
      showDetails: !!(rawState.ui?.showDetails ?? rawState.servicesDetailed),
    },
  };

  Object.defineProperty(normalized, '__issues', {
    value: Array.from(issues),
    enumerable: false,
  });

  return normalized;
}

export function validate(state, recalcResult) {
  const result = recalcResult || recalc(state);
  return {
    isValid: !!result?.flags?.isValid,
    issues: result?.flags?.issues || [],
  };
}

export function recalc(state) {
  const normalized = (state && state.services && !Array.isArray(state.services) && state.overrides)
    ? state
    : normalizeState(state);
  const rate = getRatePerHour();
  const issues = new Set(normalized?.__issues || []);

  const breakdown = Object.values(normalized.services || {}).map((svc) => {
    const override = normalized.overrides?.[svc.key] || {};
    const qty = override.qtyOverride !== null && override.qtyOverride !== undefined ? override.qtyOverride : svc.qty;
    const hoursPerUnit = override.hoursOverride !== null && override.hoursOverride !== undefined
      ? override.hoursOverride
      : svc.hours_per_unit;
    const hoursTotal = Number(qty || 0) * Number(hoursPerUnit || 0);
    const priceTotal = hoursTotal * rate;
    const source = (override.qtyOverride !== null && override.qtyOverride !== undefined) ||
      (override.hoursOverride !== null && override.hoursOverride !== undefined)
      ? 'override'
      : 'preset';

    return {
      key: svc.key,
      title: svc.title,
      group: svc.group,
      qty,
      hours_per_unit: hoursPerUnit,
      hoursTotal,
      priceTotal,
      source,
    };
  });

  const totals = breakdown.reduce(
    (acc, row) => {
      acc.hours += Number(row.hoursTotal || 0);
      acc.price += Number(row.priceTotal || 0);
      return acc;
    },
    { hours: 0, price: 0 },
  );

  const hasAnyOverrideQty = Object.values(normalized.overrides || {}).some((override) => Number(override?.qtyOverride || 0) > 0);
  const hasAnyServiceQty = Object.values(normalized.services || {}).some((svc) => {
    const override = normalized.overrides?.[svc.key];
    const qty = override?.qtyOverride !== null && override?.qtyOverride !== undefined
      ? override.qtyOverride
      : svc.qty;
    return Number(qty || 0) > 0;
  });
  const hasEnabled = Object.values(normalized.services || {}).some((svc) => !!svc.enabled);
  const hasAnyWork = !!normalized.selectedPackageId || hasAnyServiceQty || hasAnyOverrideQty || hasEnabled;

  if ((hasAnyServiceQty || hasAnyOverrideQty) && !breakdown.length) {
    issues.add('EMPTY_BREAKDOWN');
  }

  if (hasAnyWork && totals.hours === 0) {
    issues.add('INVALID_STATE_ZERO_TOTAL');
  }

  if (hasAnyWork && rate > 0 && totals.price === 0) {
    issues.add('INVALID_STATE_ZERO_TOTAL');
  }

  const isValid = !hasAnyWork || (totals.hours > 0 && (rate <= 0 || totals.price > 0));

  return {
    totals,
    breakdown,
    flags: {
      hasAnyWork,
      isValid,
      issues: Array.from(issues),
    },
  };
}

function runSelfCheck() {
  const base = {
    selectedPackageId: 'retail_only',
    services: [
      { id: 'scanners', title: 'Сканеры', qty: 1, hours_per_unit: 1.5 },
    ],
    overrides: {},
    ui: { showDetails: true },
  };
  const calcA = recalc(normalizeState(base));
  console.assert(calcA.totals.hours > 0, '[managerV5Calc] expected hours > 0');

  const calcB = recalc(normalizeState({
    ...base,
    services: [{ id: 'scanners', title: 'Сканеры', qty: 0, hours_per_unit: 1.5 }],
  }));
  console.assert(calcB.flags.isValid === false, '[managerV5Calc] expected invalid state when no hours');

  const calcC = recalc(normalizeState({
    ...base,
    services: [{ id: 'scanners', title: 'Сканеры', qty: NaN, hours_per_unit: 1.5 }],
  }));
  console.assert(calcC.flags.issues.includes('NAN_FIXED'), '[managerV5Calc] expected NAN_FIXED issue');
}

if (isDevEnv()) {
  runSelfCheck();
}
