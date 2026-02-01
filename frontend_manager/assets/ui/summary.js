// ФАЙЛ: frontend/assets/ui/summary.js
// ------------------------------------------------------------
// Рендер правой панели (рекомендация + суммы + детализация).
// ------------------------------------------------------------

import { el } from '../dom.js';
import { fmtRub, splitToBullets, segText, kktCount, deviceCounts, hasWholesaleOrProducer, hasProducer } from '../helpers.js';
import { needDiagnostics, pointsToRub } from '../calc.js';
import { state } from '../state.js';
import { getDataSync } from '../data.js';
import { openInfoModal } from '../components/info_modal.js';
import { openServiceGraphModal } from './service_graph.js';
import { attachPopover } from '../components/popover.js';

export function renderList(ul, items) {
  ul.innerHTML = '';
  (items || []).forEach(t => {
    const li = document.createElement('li');
    li.textContent = t;
    ul.appendChild(li);
  });
}

export function renderKVList(ul, items, kind) {
  ul.innerHTML = '';
  (items || []).forEach(it => {
    const li = document.createElement('li');
    const a = document.createElement('span');
    a.textContent = it.label;
    const b = document.createElement('span');
    if (kind === 'lic') {
      b.textContent = fmtRub(it.rub);
    } else if (kind === 'hours') {
      b.textContent = `+${it.hours} ч`;
    } else {
      b.textContent = `+${it.pts} балл.`;
    }
    li.appendChild(a);
    li.appendChild(b);
    ul.appendChild(li);
  });
}

function resolvePackage(pkg) {
  if (!pkg) return null;
  const DATA = getDataSync();
  const corePkgs = DATA.core_packages?.packages || [];
  const name = pkg.title || pkg.name;
  const normalizeName = (value) => String(value || '').replace(/прозводитель/gi, 'Производитель');
  const quoteHours = (p) => Number(p?.quote_hours || p?.total_points || 0);
  const priceFallback = (p) => {
    const hours = quoteHours(p);
    return hours ? hours * 4950 : 0;
  };
  if (Array.isArray(corePkgs) && name) {
    const match = corePkgs.find(p => p.id === pkg.id || p.title === name);
    if (match) {
      return {
        ...pkg,
        ...match,
        name: normalizeName(match.title || match.name || name),
        quote_hours: quoteHours(match),
        price: priceFallback(match) || Number(pkg.price || 0),
      };
    }
  }
  return pkg;
}

function buildGroupSummary(groups) {
  return (groups || []).map(g => {
    const pts = Number(g.points || 0);
    const base = `${g.name}${pts ? ` — ${pts} балл.` : ''}`;
    return g.note ? `${base} (${g.note})` : base;
  });
}

function buildGroupDetails(groups) {
  const items = [];
  (groups || []).forEach(g => {
    const header = `${g.name}${g.points ? ` — ${g.points} балл.` : ''}`;
    if (Array.isArray(g.details) && g.details.length) {
      g.details.forEach(d => {
        const pts = Number(d.points || 0);
        items.push(`${header}: ${d.text}${pts ? ` — ${pts} балл.` : ''}`);
      });
    } else {
      items.push(header);
    }
  });
  return items;
}

export function renderFromCalc(pkg, calc, prelim, costs, hint, managerTotals) {
  const pkgView = resolvePackage(pkg);
  // Шапка
  el.segBadge.textContent = segText();
  const totals = managerTotals || { packageHours: 0, addonHours: 0, totalHours: 0, totalRub: 0, breakdown: { addons: [], kktPrepareHours: 0 } };

  if (!pkgView) {
    // Сбрасываем заголовок (и возможную кнопку «подробнее»)
    _renderPackageTitle('Пакет: —', null);
    el.pkgWho.textContent = '';
    el.pkgPills.innerHTML = '';
    el.diagBanner.style.display = 'none';
    el.sumBase.textContent = '0 ₽';
    el.sumDiag.textContent = '0 ₽';
    el.sumSupport.textContent = '0 ₽';
    el.sumServices.textContent = '0 ₽';
    el.sumLic.textContent = '0 ₽';
    el.sumTotal.textContent = 'Выберите тип клиента';
    if (el.sumHours) el.sumHours.textContent = '—';
    if (el.pkgHours) el.pkgHours.textContent = '—';
    if (el.addonsHours) el.addonsHours.textContent = '—';
    if (el.totalHours) el.totalHours.textContent = '—';
    if (el.kktPrepHours) el.kktPrepHours.textContent = '—';
    if (el.kktPrepHours) el.kktPrepHours.closest('.kv')?.setAttribute('hidden', '');
    if (el.addonsList) renderKVList(el.addonsList, [], 'hours');
    renderList(el.pkgDetailed, []);
    renderKVList(el.servicesBreakdown, [], 'svc');
    renderKVList(el.licBreakdown, [], 'lic');
    el.recHint.textContent = hint || 'Выбери сегмент слева — и мы покажем пакет и расчёт.';
    el.projAlert.style.display = 'none';

    // Кнопка «Почему такая стоимость?» скрыта, пока нет пакета.
    if (el.whyBtn) {
      el.whyBtn.style.display = 'none';
      el.whyBtn.onclick = null;
    }
    if (el.matrixBtn) {
      el.matrixBtn.style.display = 'none';
      el.matrixBtn.onclick = null;
    }
    return;
  }

  _renderPackageTitle(
    (prelim ? 'Пакет (предварительно): ' : 'Пакет: ') + (pkgView.name || '—'),
    pkgView,
  );
  const whoParts = [];
  if (pkgView.who) whoParts.push(`Для кого: ${pkgView.who}`);
  if (pkgView.total_points) whoParts.push(`Баллы пакета: ${pkgView.total_points}`);
  if (costs?.base) whoParts.push(`Цена пакета: ${fmtRub(costs.base)}`);
  el.pkgWho.textContent = whoParts.join(' · ');

  // Плашки
  el.pkgPills.innerHTML = '';
  const dc = deviceCounts();
  // 1С (информационно)
  let onecPill = '';
  try {
    const DATA = getDataSync();
    const cfgs = Array.isArray(DATA.onec_configs) ? DATA.onec_configs : [];
    const name = cfgs.find(c => c.id === state.onec?.config)?.name || (state.onec?.config || '—');
    const act = (state.onec?.actual === false) ? 'неактуальная' : 'актуальная';
    onecPill = `1С: ${name} · ${act}`;
  } catch (e) {
    // если data.js не отдал — просто молчим
  }
  const devParts = [];
  if (dc.scanners) devParts.push(`Сканеры: ${dc.scanners}`);
  if (dc.tsd) devParts.push(`ТСД: ${dc.tsd}`);
  if (!devParts.length) devParts.push('Устройства: 0');

  [
    `Доп.баллы: ${calc.points}`,
    `ККТ: ${kktCount()} · Юрлица: ${state.org_count}`,
    devParts.join(' · '),
    onecPill || '',
    prelim ? 'ККТ неизвестна' : 'ККТ подтверждена',
  ].forEach(p => {
    if (!p) return;
    const d = document.createElement('div');
    d.className = 'pill';
    d.textContent = p;
    el.pkgPills.appendChild(d);
  });

  // Детализация пакета
  if (Array.isArray(pkgView.groups) && pkgView.groups.length) {
    el.pkgDetailed.innerHTML = '';
    pkgView.groups.forEach(group => {
      const li = document.createElement('li');
      li.textContent = buildGroupSummary([group])[0] || group.name;
      if (group.details && group.details.length) {
        li.style.cursor = 'pointer';
        li.title = 'Нажмите, чтобы увидеть детали группы';
        li.onclick = () => {
          const items = (group.details || []).map(d => `${d.text}${d.points ? ` — ${d.points} балл.` : ''}`);
          openInfoModal(group.name || 'Группа работ', {
            desc: group.note || '',
            items,
          });
        };
      }
      el.pkgDetailed.appendChild(li);
    });
  } else {
    const det = splitToBullets(pkgView.detail);
    renderList(el.pkgDetailed, det.length ? det : splitToBullets(pkgView.inc));
  }

  // Диагностика (сейчас выключена)
  el.diagBanner.style.display = (needDiagnostics() ? 'block' : 'none');

  // Суммы
  el.sumBase.textContent = fmtRub(costs.base);
  el.sumDiag.textContent = fmtRub(costs.diag || 0);
  el.sumSupport.textContent = fmtRub(costs.support || 0);
  el.sumServices.textContent = fmtRub(calc.rub || 0);
  el.sumLic.textContent = fmtRub(calc.licRub || 0);
  el.sumTotal.textContent = fmtRub(totals.totalRub || costs.total || 0);
  if (el.sumHours) el.sumHours.textContent = `${totals.totalHours || 0} ч`;
  if (el.pkgHours) el.pkgHours.textContent = `${totals.packageHours || 0} ч`;
  if (el.addonsHours) el.addonsHours.textContent = `${totals.addonHours || 0} ч`;
  if (el.totalHours) el.totalHours.textContent = `${totals.totalHours || 0} ч`;
  if (el.kktPrepHours) {
    const kktPrep = Number(totals.breakdown?.kktPrepareHours || 0);
    el.kktPrepHours.textContent = `${kktPrep} ч`;
    el.kktPrepHours.closest('.kv')?.toggleAttribute('hidden', kktPrep <= 0);
  }
  if (el.addonsList) {
    const items = (totals.breakdown?.addons || []).map(item => ({
      label: item.label,
      hours: item.hours,
    }));
    const kktPrep = Number(totals.breakdown?.kktPrepareHours || 0);
    if (kktPrep > 0) {
      items.push({ label: 'Подготовка кассы', hours: kktPrep });
    }
    renderKVList(el.addonsList, items, 'hours');
  }

  renderKVList(el.servicesBreakdown, calc.serviceItems || [], 'svc');
  renderKVList(el.licBreakdown, calc.licItems || [], 'lic');

  el.recHint.textContent = hint || (prelim ? 'Сначала диагностика ККТ, после — подтверждаем пакет/итог.' : 'Пакет и сумма рассчитаны по чек‑листу.');
  el.projAlert.style.display = state.custom_integration ? 'block' : 'none';

  // «Почему такая стоимость?» — открывает понятную раскладку.
  _wireWhyButton(pkgView, calc, costs);

  // «Матрица услуг» — показывает правила/условия, что именно сработало.
  _wireMatrixButton(pkgView, calc, costs);
}

function _renderPackageTitle(text, pkg) {
  // Делаем заголовок в одну строку и добавляем кнопку «i», если есть данные.
  if (!el.pkgTitle) return;

  el.pkgTitle.innerHTML = '';
  el.pkgTitle.style.display = 'flex';
  el.pkgTitle.style.alignItems = 'center';
  el.pkgTitle.style.justifyContent = 'space-between';
  el.pkgTitle.style.gap = '10px';

  const span = document.createElement('span');
  span.textContent = text;
  el.pkgTitle.appendChild(span);

  // Если пакета нет — не показываем кнопку.
  if (!pkg) return;

  const hours = Number(pkg?.quote_hours || pkg?.total_points || 0);
  if (hours) {
    const meta = document.createElement('div');
    meta.className = 'pkgMeta';

    const hoursBadge = document.createElement('span');
    hoursBadge.className = 'pkgHours';
    hoursBadge.textContent = `${hours} ч`;
    meta.appendChild(hoursBadge);

    const price = Number(pkg?.price || 0);
    const priceBadge = document.createElement('span');
    priceBadge.className = 'pkgPrice';
    priceBadge.textContent = fmtRub(price);
    meta.appendChild(priceBadge);

    el.pkgTitle.appendChild(meta);
  }

  const hasGroups = Array.isArray(pkg.groups) && pkg.groups.length;
  const raw = hasGroups ? 'ok' : (pkg.detail || pkg.inc || '').trim();
  if (!raw) return;

  const btn = document.createElement('button');
  btn.className = 'iconBtn';
  btn.type = 'button';
  btn.title = 'Посмотреть состав пакета';
  btn.textContent = 'i';

  const infoItems = hasGroups ? buildGroupDetails(pkg.groups) : (splitToBullets(pkg.detail).length ? splitToBullets(pkg.detail) : splitToBullets(pkg.inc));
  btn.onclick = () => {
    openInfoModal(pkg.name || 'Пакет', {
      desc: pkg.who ? `Для кого: ${pkg.who}` : '',
      items: infoItems,
    });
  };

  // На ПК показываем состав пакета при наведении.
  // На телефонах hover нет, там остаётся клик.
  attachPopover(btn, () => ({
    title: pkg.name || 'Пакет',
    desc: pkg.who ? `Для кого: ${pkg.who}` : '',
    items: infoItems,
  }));

  el.pkgTitle.appendChild(btn);
}

function _wireWhyButton(pkg, calc, costs) {
  if (!el.whyBtn) return;
  if (document.body.classList.contains('managerSlim')) {
    el.whyBtn.style.display = 'none';
    return;
  }
  el.whyBtn.style.display = 'inline-flex';

  // Переназначаем обработчик на каждый ререндер — так проще и надёжнее.
  el.whyBtn.onclick = () => {
    const DATA = getDataSync();
    const rubPerPoint = Number(DATA.rub_per_point || 0);

    // 1С (информационно)
    let onecStr = '—';
    try {
      const cfgs = Array.isArray(DATA.onec_configs) ? DATA.onec_configs : [];
      const name = cfgs.find(c => c.id === state.onec?.config)?.name || (state.onec?.config || '—');
      const act = (state.onec?.actual === false) ? 'неактуальная' : 'актуальная';
      onecStr = `${name} (${act})`;
    } catch (e) {}

    // Клеверенс-план (информационно)
    let clevStr = '—';
    try {
      const plans = Array.isArray(DATA.cleverence_plans) ? DATA.cleverence_plans : [];
      const p = plans.find(x => x.id === state.cleverence_plan);
      clevStr = p ? p.name : (state.cleverence_plan || '—');
    } catch (e) {}

    const dc = deviceCounts();
    const segs = (state.segments || []).join(', ') || '—';

    // Сценарии/флаги (только включённые)
    const flags = [];
    if (state.support) flags.push('Поддержка 5 дней');
    if (state.has_edo === false) flags.push('Нет ЭДО');
    if (state.needs_rework) flags.push('Остатки/перемаркировка/вывод из оборота');
    if (state.needs_aggregation) flags.push('Агрегация/КИТУ');
    if (state.big_volume) flags.push('Большие объёмы/автоматизация');
    if (state.producer_codes) flags.push('Заказ кодов/нанесение');
    if (state.custom_integration) flags.push('Нестандарт/интеграции (похоже на проект)');

    const items = [];
    items.push(`Сегменты: ${segs}`);
    items.push(`1С: ${onecStr}`);
    items.push(`Юрлица: ${Number(state.org_count || 1)} · ККТ: ${kktCount()}`);
    items.push(`Устройства: сканеры ${dc.scanners || 0}, ТСД ${dc.tsd || 0}${state.tsd_collective ? ' (коллективная)' : ''}`);
    if ((dc.tsd || 0) > 0) items.push(`Клеверенс (план): ${clevStr}`);
    if (flags.length) items.push(`Флаги: ${flags.join(' · ')}`);

    items.push('────────');
    items.push(`Пакет: ${pkg.name || '—'} = ${fmtRub(costs.base || 0)}`);
    if (costs.support) items.push(`Поддержка 5 дней = ${fmtRub(costs.support || 0)}`);

    items.push('────────');
    if ((calc.serviceItems || []).length) {
      items.push(`Доп.баллы: ${calc.points || 0} × ${fmtRub(rubPerPoint)} = ${fmtRub(calc.rub || 0)} (внутр.)`);
      (calc.serviceItems || []).forEach(it => {
        const pts = Number(it.pts || 0);
        const rub = pts * rubPerPoint;
        items.push(`${it.label} → +${pts} балл. = ${fmtRub(rub)} (внутр.)`);
      });
    } else {
      items.push('Доп.баллы: 0');
    }

    items.push('────────');
    if ((calc.licItems || []).length) {
      items.push(`ПО/лицензии: ${fmtRub(calc.licRub || 0)}`);
      (calc.licItems || []).forEach(it => {
        items.push(`${it.label} = ${fmtRub(Number(it.rub || 0))}`);
      });
    } else {
      items.push('ПО/лицензии: 0');
    }

    items.push('────────');
    items.push(
      `ИТОГО: ${fmtRub(costs.base || 0)} + ${fmtRub(costs.support || 0)} + ${fmtRub(calc.rub || 0)} + ${fmtRub(calc.licRub || 0)} = ${fmtRub(costs.total || 0)}`
    );

    openInfoModal('Почему такая стоимость?', {
      desc: 'Это внутренняя раскладка для менеджера: какие параметры выбраны и какие блоки суммы сработали.',
      items,
    });
  };
}

function _wireMatrixButton(pkg, calc, costs) {
  if (!el.matrixBtn) return;
  if (document.body.classList.contains('managerSlim')) {
    el.matrixBtn.style.display = 'none';
    return;
  }
  el.matrixBtn.style.display = 'inline-flex';

  el.matrixBtn.onclick = () => {
    // Открываем «Матрицу услуг» в виде графа (пакеты ↔ работы из detail).
    // Подсветим текущий рекомендованный пакет.
    openServiceGraphModal({
      highlightPackage: pkg?.name || '',
      preferSegment: '__auto__',
    });
  };
}
