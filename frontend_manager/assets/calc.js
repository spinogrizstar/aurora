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
import { deviceCounts, kktCount, hasProducer, hasWholesaleOrProducer } from './helpers.js';

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
  const DATA = getDataSync();
  const pm = DATA.points_model || {};

  const serviceItems = [];
  const licItems = [];

  const addSvc = (label, pts) => {
    const p = Number(pts || 0);
    if (p > 0) serviceItems.push({ label, pts: p });
  };
  const addLic = (label, rub) => {
    const r = Number(rub || 0);
    if (r > 0) licItems.push({ label, rub: r });
  };

  // --- ККТ ---
  const kc = kktCount();
  const extraKkt = Math.max(0, kc - 1);
  if (state.kkt_rereg && extraKkt > 0) {
    addSvc(`Доп.кассы: перерегистрация/подготовка ККТ (+${extraKkt})`, extraKkt * Number(pm.kkt_rereg_points_per_kkt || 0));
  }
  if (state.needs_rr && extraKkt > 0) {
    addSvc(`Доп.кассы: Разрешительный режим (РР) (+${extraKkt})`, extraKkt * Number(pm.rr_points_per_kkt || 0));
  }

  // --- Юрлица ---
  const extraOrg = Math.max(0, Number(state.org_count || 1) - 1);
  if (extraOrg > 0) {
    addSvc(`Доп.юрлица (+${extraOrg})`, extraOrg * Number(pm.org_points_per_extra || 0));
  }

  // --- Устройства ---
  const dc = deviceCounts();
  const extraScanner = Math.max(0, dc.scanners - 1);
  if (extraScanner > 0) {
    addSvc(`Доп.сканеры (+${extraScanner})`, extraScanner * Number(pm.scanner_setup_points_per_scanner || 0));
  }

  if (dc.tsd > 0) {
    let rub = dc.tsd * Number(pm.tsd_license_rub || 0);
    if (state.tsd_collective) rub += dc.tsd * Number(pm.collective_tsd_license_rub || 0);
    addLic(
      `Клеверенс: лицензия ТСД ×${dc.tsd}` + (state.tsd_collective ? ' + коллективная работа' : ''),
      rub,
    );
  }

  // --- Сегменты и сценарии ---
  const { isWholesale, isProducer } = _segFlags();
  if (!state.has_edo && (isWholesale || isProducer)) {
    addSvc('Нет ЭДО (опт/производство)', Number(pm.no_edo_wholesale_points || 0));
  }
  if (state.needs_rework) {
    addSvc('Остатки/перемаркировка/вывод из оборота', Number(pm.rework_points || 0));
  }
  if (state.needs_aggregation) {
    addSvc('Агрегация/КИТУ', Number(pm.aggregation_points || 0));
  }
  if (state.big_volume) {
    addSvc('Большие объёмы/автоматизация', Number(pm.big_volume_points || 0));
  }
  if (isProducer && state.producer_codes) {
    addSvc('Заказ кодов/нанесение', Number(pm.producer_codes_points || 0));
  }
  if (state.custom_integration) {
    addSvc('Нестандарт/интеграции (маркер проекта)', Number(pm.custom_project_marker_points || 0));
  }

  const points = serviceItems.reduce((s, x) => s + Number(x.pts || 0), 0);
  const rub = pointsToRub(points);
  const licRub = licItems.reduce((s, x) => s + Number(x.rub || 0), 0);
  return { serviceItems, licItems, points, rub, licRub };
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
  const hours = Number(pkg?.quote_hours || 0);
  if (hours) return hours;
  return Number(pkg?.total_points || 0);
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
  const support = state.support ? pointsToRub(Number(DATA.support_points || 0)) : 0;
  const total = base + diag + support + Number(calc.rub || 0) + Number(calc.licRub || 0);
  return { base, diag, support, total };
}
