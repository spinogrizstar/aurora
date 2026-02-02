// ФАЙЛ: frontend/assets/calc.js
// ------------------------------------------------------------
// ЛОКАЛЬНЫЙ РАСЧЁТ.
//
// Обычно мы считаем через API /api/v5/calculate.
// Но если сервер недоступен (или коллега открыл сайт как файл),
// то мы считаем здесь — чтобы UI всё равно работал.
//
// ВАЖНО:
//   Логика повторяет backend/v5/calc.py (почти 1-в-1).
// ------------------------------------------------------------

import { getDataSync } from './data.js';
import { state } from './state.js';
import { calcServiceTotals } from './services.js';

const CORE_PRICE_PER_POINT = 4950;

export function pointsToRub(points) {
  const DATA = getDataSync();
  return Number(points || 0) * Number(DATA.rub_per_point || 0);
}

export function needDiagnostics() {
  // По последнему решению: диагностику не навязываем.
  return false;
}

function _segFlags() {
  const segs = (state.segments || []).map(s => String(s).toLowerCase());
  const isRetail = segs.some(s => s.includes('розниц'));
  const isWholesale = segs.some(s => s.includes('опт'));
  const isProducer = segs.some(s => s.includes('производ'));
  return { isRetail, isWholesale, isProducer };
}

export function calcServicesAndLicenses() {
  return { serviceItems: [], licItems: [], points: 0, rub: 0, licRub: 0 };
}

export function calcManagerTotals(currentState) {
  const totals = calcServiceTotals(currentState?.services || []);
  const totalHours = totals.totalHours || 0;
  const totalRub = totals.totalRub || 0;
  return {
    totalHours,
    totalRub,
    error: '',
  };
}

function _findPkg(seg, preferKeywords) {
  const DATA = getDataSync();
  const pkgs = (DATA.segments || {})[seg] || [];
  const low = s => String(s || '').toLowerCase();
  for (const kw of preferKeywords) {
    for (const p of pkgs) {
      if (kw && low(p.name).includes(low(kw))) return p;
    }
  }
  return pkgs[0] || null;
}

function _getCorePackages() {
  const DATA = getDataSync();
  const core = DATA.core_packages || {};
  const pkgs = core.packages || [];
  return Array.isArray(pkgs) ? pkgs : [];
}

function _corePackageSegments(pkg) {
  const key = _resolveCoreSegmentKey(pkg);
  if (key === 'retail_only') return ['retail'];
  if (key === 'wholesale_only') return ['wholesale'];
  if (key === 'producer_only') return ['producer'];
  if (key === 'producer_retail') return ['producer', 'retail'];
  return [];
}

function _normalizeCoreTitle(title) {
  return String(title || '')
    .toLowerCase()
    .replace('прозводитель', 'производитель')
    .replace(/\s+/g, ' ')
    .trim();
}

function _normalizeCoreDisplayName(name) {
  return String(name || '').replace(/прозводитель/gi, 'Производитель');
}

function _resolveCoreSegmentKey(pkg) {
  const key = String(pkg?.segment_key || '');
  if (key) return key;
  const title = _normalizeCoreTitle(pkg?.title || pkg?.name || '');
  if (title.includes('только') && title.includes('розниц')) return 'retail_only';
  if (title.includes('только') && title.includes('опт')) return 'wholesale_only';
  if (title.includes('только') && (title.includes('производ') || title.includes('импорт'))) return 'producer_only';
  if ((title.includes('производ') || title.includes('импорт')) && title.includes('розниц')) return 'producer_retail';
  return '';
}

function _corePackageQuoteHours(pkg) {
  return Number(pkg?.quote_hours || 0);
}

function _corePackagePrice(pkg) {
  const quoteHours = _corePackageQuoteHours(pkg);
  return quoteHours ? quoteHours * CORE_PRICE_PER_POINT : 0;
}

function _normalizeCorePackage(pkg) {
  if (!pkg) return null;
  return {
    ...pkg,
    name: _normalizeCoreDisplayName(pkg.title || pkg.name || '—'),
    quote_hours: _corePackageQuoteHours(pkg),
    price: _corePackagePrice(pkg),
  };
}

function _chooseCorePackage() {
  const corePkgs = _getCorePackages();
  if (!corePkgs.length) return { pkg: null, warning: '' };

  const { isRetail, isWholesale, isProducer } = _segFlags();
  const selected = new Set();
  if (isRetail) selected.add('retail');
  if (isWholesale) selected.add('wholesale');
  if (isProducer) selected.add('producer');

  if (!selected.size) return { pkg: null, warning: '' };

  let exactKey = '';
  if (isRetail && !isWholesale && !isProducer) exactKey = 'retail_only';
  if (isWholesale && !isRetail && !isProducer) exactKey = 'wholesale_only';
  if (isProducer && !isRetail && !isWholesale) exactKey = 'producer_only';
  if (isProducer && isRetail && !isWholesale) exactKey = 'producer_retail';

  if (exactKey) {
    const match = corePkgs.find(p => _resolveCoreSegmentKey(p) === exactKey);
    return { pkg: _normalizeCorePackage(match), warning: '' };
  }

  // Нестандартное комбо → берём «ближайший» пакет:
  // максимум пересечения сегментов → больше сегментов → более дорогой.
  let best = null;
  let bestScore = -1;
  let bestSize = -1;
  let bestPrice = -1;
  for (const p of corePkgs) {
    const segs = _corePackageSegments(p);
    const overlap = segs.filter(s => selected.has(s)).length;
    const size = segs.length;
    const price = _corePackagePrice(p);
    if (overlap > bestScore || (overlap === bestScore && size > bestSize) || (overlap === bestScore && size === bestSize && price > bestPrice)) {
      best = p;
      bestScore = overlap;
      bestSize = size;
      bestPrice = price;
    }
  }
  return {
    pkg: _normalizeCorePackage(best),
    warning: best ? 'Комбо нестандартное, выбран ближайший пакет.' : ''
  };
}

function _choosePackageForSegment(seg, points) {
  const s = String(seg || '').toLowerCase();
  const isRetail = s.includes('розниц');
  const isWholesale = s.includes('опт');
  const isProducer = s.includes('производ');

  let prefer = ['Старт', 'Оптим', 'Комбо', 'Запуск'];
  if (isProducer) {
    prefer = points >= 8 ? ['Премиум', 'Оптим', 'Запуск'] : ['Запуск', 'Старт', 'Оптим'];
  } else if (isWholesale) {
    prefer = points >= 6 ? ['Комбо', 'Оптим'] : ['Приемка + Отгрузка', 'Комбо', 'Приемка', 'Отгрузка', 'Старт', 'Оптим'];
  } else if (isRetail) {
    prefer = points >= 6 ? ['Оптим'] : ['Старт', 'Оптим'];
  }
  return _findPkg(seg, prefer);
}

export function choosePackage(points) {
  if (state.selectedPackageId) {
    const corePkgs = _getCorePackages();
    const direct = corePkgs.find(pkg => String(pkg?.id || pkg?.segment_key || '') === state.selectedPackageId);
    if (direct) {
      return { pkg: _normalizeCorePackage(direct), warning: '' };
    }
  }
  const core = _chooseCorePackage();
  if (core.pkg) return core;

  const segs = state.segments || [];
  if (!segs.length) return { pkg: null, warning: '' };
  const candidates = segs
    .map(seg => _choosePackageForSegment(seg, points))
    .filter(Boolean);
  if (!candidates.length) return { pkg: null, warning: '' };
  candidates.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
  return { pkg: candidates[0], warning: '' };
}

export function buildCosts(pkg, calc) {
  const DATA = getDataSync();
  const base = Number(pkg?.price || 0);
  const diag = needDiagnostics() ? Number(DATA.diag_price_rub || 0) : 0;
  const support = 0;
  const total = base + diag + support + Number(calc.rub || 0) + Number(calc.licRub || 0);
  return { base, diag, support, total };
}
