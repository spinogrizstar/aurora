// ФАЙЛ: frontend/assets/ui/summary.js
// ------------------------------------------------------------
// Рендер правой панели (рекомендация + суммы + детализация).
// ------------------------------------------------------------

import { el } from '../dom.js';
import { fmtRub, splitToBullets, segText, kktCount, deviceCounts } from '../helpers.js';
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
  } else if (kind === 'svc') {
    b.textContent = fmtRub(pointsToRub(it.pts));
  } else if (kind === 'hours') {
    b.textContent = `+${it.hours} ч`;
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
  const quoteHours = (p) => Number(p?.quote_hours || 0);
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

function getSelectedCorePackage() {
  const selectedId = String(state.selectedPackageId || '');
  if (!selectedId) return null;
  const DATA = getDataSync();
  const corePkgs = Array.isArray(DATA.core_packages?.packages) ? DATA.core_packages.packages : [];
  return corePkgs.find(pkg => String(pkg?.id || pkg?.segment_key || '') === selectedId) || null;
}

function buildGroupSummary(groups) {
  return (groups || []).map(g => {
    const base = g.name;
    return g.note ? `${base} (${g.note})` : base;
  });
}

function buildGroupDetails(groups) {
  const items = [];
  (groups || []).forEach(g => {
    const header = `${g.name}`;
    if (Array.isArray(g.details) && g.details.length) {
      g.details.forEach(d => {
        items.push(`${header}: ${d.text}`);
      });
    } else {
      items.push(header);
    }
  });
  return items;
}

export function renderFromCalc(pkg, calc, prelim, costs, hint, managerTotals) {
  const selectedPkg = getSelectedCorePackage();
  const pkgView = resolvePackage(selectedPkg);
  // Шапка
  el.segBadge.textContent = segText();
  const totals = managerTotals || { packageHours: 0, addonHours: 0, totalHours: 0, totalRub: 0, breakdown: { addons: {}, kkt: {} } };

  if (!pkgView) {
    // Сбрасываем заголовок (и возможную кнопку «подробнее»)
    _renderPackageTitle('Пакет: —', null);
    el.pkgWho.textContent = '';
    el.pkgPills.innerHTML = '';
    el.pkgPills.style.display = 'none';
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
    if (el.recRow) el.recRow.hidden = false;
    el.recHint.textContent = hint || 'Выбери сегмент слева — и мы покажем пакет и расчёт.';
    el.projAlert.style.display = 'none';
    if (el.packageDataAlert) {
      el.packageDataAlert.style.display = 'none';
      el.packageDataAlert.textContent = '';
    }

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
  if (el.recRow) el.recRow.hidden = true;
  const whoParts = [];
  if (pkgView.who) whoParts.push(`Для кого: ${pkgView.who}`);
  const dc = deviceCounts();
  whoParts.push(`Сканеры: ${dc.scanners || 0} · ТСД: ${dc.tsd || 0}`);
  el.pkgWho.textContent = whoParts.join(' · ');

  // Плашки
  el.pkgPills.innerHTML = '';
  el.pkgPills.style.display = 'none';

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
          const items = (group.details || []).map(d => `${d.text}`);
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
    const kkt = totals.breakdown?.kkt || {};
    const kktPrep = Number(kkt.totalKktPrepareHours || 0);
    const parts = [];
    if (Number(kkt.regularCount || 0) > 0) parts.push(`обыч: ${kkt.regularCount}×2ч`);
    if (Number(kkt.smartCount || 0) > 0) parts.push(`смарт: ${kkt.smartCount}×3ч`);
    if (Number(kkt.otherCount || 0) > 0) parts.push(`др: ${kkt.otherCount}×2ч`);
    const detail = parts.length ? ` (${parts.join(', ')})` : '';
    el.kktPrepHours.textContent = `${kktPrep} ч${detail}`;
    el.kktPrepHours.closest('.kv')?.toggleAttribute('hidden', kktPrep <= 0);
  }
  if (el.addonsList) {
    const addons = totals.breakdown?.addons || {};
    const items = [
      addons.reg_lk ? { label: 'Рега в ЛК ЧЗ (розница)', hours: addons.reg_lk } : null,
      addons.integration ? { label: 'Интеграция с товароучёткой', hours: addons.integration } : null,
      addons.kkt_prepare_marking ? { label: 'Подготовка кассового оборудования для работы с маркировкой', hours: addons.kkt_prepare_marking } : null,
    ].filter(Boolean);
    renderKVList(el.addonsList, items, 'hours');
  }

  renderKVList(el.servicesBreakdown, calc.serviceItems || [], 'svc');
  renderKVList(el.licBreakdown, calc.licItems || [], 'lic');

  el.recHint.textContent = hint || (prelim ? 'Сначала диагностика ККТ, после — подтверждаем пакет/итог.' : 'Пакет и сумма рассчитаны по чек‑листу.');
  el.projAlert.style.display = state.custom_integration ? 'block' : 'none';
  if (el.packageDataAlert) {
    if (totals.error) {
      el.packageDataAlert.style.display = 'block';
      el.packageDataAlert.textContent = totals.error;
    } else {
      el.packageDataAlert.style.display = 'none';
      el.packageDataAlert.textContent = '';
    }
  }

  // «Почему такая стоимость?» — открывает понятную раскладку.
  _wireWhyButton(pkgView, calc, costs, totals);

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

function _wireWhyButton(pkg, calc, costs, totals) {
  if (!el.whyBtn) return;
  if (document.body.classList.contains('managerSlim')) {
    el.whyBtn.style.display = 'none';
    return;
  }
  el.whyBtn.style.display = 'inline-flex';

  // Переназначаем обработчик на каждый ререндер — так проще и надёжнее.
  el.whyBtn.onclick = () => {
    const DATA = getDataSync();

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

    const kkt = totals?.breakdown?.kkt || {};
    const kktParts = [];
    if (Number(kkt.regularCount || 0) > 0) kktParts.push(`обыч: ${kkt.regularCount}×2ч`);
    if (Number(kkt.smartCount || 0) > 0) kktParts.push(`смарт: ${kkt.smartCount}×3ч`);
    if (Number(kkt.otherCount || 0) > 0) kktParts.push(`др: ${kkt.otherCount}×2ч`);

    items.push('────────');
    items.push(`Пакет: ${pkg.name || '—'} = ${totals?.packageHours || 0} ч`);
    if (totals?.addonHours) items.push(`Доп.работы (галочки) = ${totals.addonHours} ч`);
    if (totals?.breakdown?.kkt?.totalKktPrepareHours) {
      items.push(`Подготовка кассы = ${totals.breakdown.kkt.totalKktPrepareHours} ч${kktParts.length ? ` (${kktParts.join(', ')})` : ''}`);
    }

    items.push('────────');
    items.push(`ИТОГО: ${totals?.totalHours || 0} ч × 4 950 ₽ = ${fmtRub(totals?.totalRub || 0)}`);

    openInfoModal('Почему такая стоимость?', {
      desc: 'Это внутренняя раскладка для менеджера: какие параметры выбраны и как посчитаны часы.',
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
