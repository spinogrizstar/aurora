// ФАЙЛ: frontend/assets/ui/summary.js
// ------------------------------------------------------------
// Рендер правой панели (рекомендация + суммы + детализация).
// ------------------------------------------------------------

import { el } from '../dom.js';
import { fmtRub, splitToBullets, segText, kktCount, deviceCounts } from '../helpers.js';
import { needDiagnostics } from '../calc.js';
import { state } from '../state.js';
import { getDataSync } from '../data.js';
import { openInfoModal } from '../components/info_modal.js';
import { openServiceGraphModal } from './service_graph.js';
import { attachPopover } from '../components/popover.js';
import { applyPackagePreset } from '../services.js';

export function renderList(ul, items) {
  if (!ul) return;
  ul.innerHTML = '';
  (items || []).forEach(t => {
    const li = document.createElement('li');
    li.textContent = t;
    ul.appendChild(li);
  });
}

function fmtHours(value) {
  const n = Number(value || 0);
  return Number.isInteger(n) ? `${n} ч` : `${n.toFixed(1)} ч`;
}

function fmtHoursInline(value) {
  const n = Number(value || 0);
  return Number.isInteger(n) ? `${n}` : n.toFixed(1);
}

function groupServices(services) {
  const grouped = new Map();
  (services || []).forEach((svc) => {
    const group = svc.group || 'Прочее';
    if (!grouped.has(group)) grouped.set(group, []);
    grouped.get(group).push(svc);
  });
  return grouped;
}

function renderServicesList() {
  if (!el.servicesList) return;
  el.servicesList.innerHTML = '';

  const grouped = groupServices(state.services || []);
  grouped.forEach((items, group) => {
    const groupWrap = document.createElement('div');
    groupWrap.className = 'serviceGroup';

    const header = document.createElement('button');
    header.type = 'button';
    header.className = 'serviceGroupHead';
    header.innerHTML = `<span>${group}</span><span class="serviceGroupChevron">▾</span>`;

    const collapsed = !!state.servicesGroupsCollapsed?.[group];
    groupWrap.classList.toggle('collapsed', collapsed);
    header.onclick = () => {
      state.servicesGroupsCollapsed = state.servicesGroupsCollapsed || {};
      state.servicesGroupsCollapsed[group] = !state.servicesGroupsCollapsed[group];
      renderServicesList();
    };

    const list = document.createElement('div');
    list.className = 'serviceGroupList';

    items.forEach((svc) => {
      const row = document.createElement('div');
      row.className = 'serviceRow';

      const title = document.createElement('div');
      title.className = 'serviceTitle';
      title.textContent = svc.title;

      if (svc.isAuto) {
        const auto = document.createElement('span');
        auto.className = 'serviceAuto';
        auto.textContent = 'авто';
        title.appendChild(auto);
      }

      const perUnit = document.createElement('div');
      perUnit.className = 'serviceUnit';
      perUnit.textContent = `${fmtHoursInline(svc.hoursPerUnit)} ч/ед`;

      const stepper = document.createElement('div');
      stepper.className = 'stepper';
      const minus = document.createElement('button');
      minus.type = 'button';
      minus.className = 'btnTiny';
      minus.textContent = '−';
      const qty = document.createElement('div');
      qty.className = 'stepNum';
      qty.textContent = String(svc.qty || 0);
      const plus = document.createElement('button');
      plus.type = 'button';
      plus.className = 'btnTiny';
      plus.textContent = '+';

      const updateQty = (delta) => {
        const next = Math.max(0, Number(svc.qty || 0) + delta);
        svc.qty = Math.trunc(next);
        svc.manuallySet = true;
        svc.isAuto = false;
        qty.textContent = String(svc.qty);
      };

      minus.onclick = () => {
        updateQty(-1);
        if (window.__AURORA_APP_UPDATE) {
          window.__AURORA_APP_UPDATE();
        } else {
          renderServicesTotals();
        }
      };
      plus.onclick = () => {
        updateQty(1);
        if (window.__AURORA_APP_UPDATE) {
          window.__AURORA_APP_UPDATE();
        } else {
          renderServicesTotals();
        }
      };

      stepper.appendChild(minus);
      stepper.appendChild(qty);
      stepper.appendChild(plus);

      const rowTotal = document.createElement('div');
      rowTotal.className = 'serviceTotal';
      const rowHours = Number(svc.hoursPerUnit || 0) * Number(svc.qty || 0);
      rowTotal.textContent = fmtHours(rowHours);

      row.appendChild(title);
      row.appendChild(perUnit);
      row.appendChild(stepper);
      row.appendChild(rowTotal);

      list.appendChild(row);
    });

    groupWrap.appendChild(header);
    groupWrap.appendChild(list);
    el.servicesList.appendChild(groupWrap);
  });
}

function renderServicesTotals() {
  const totalHours = (state.services || []).reduce((sum, svc) => {
    return sum + Number(svc.hoursPerUnit || 0) * Number(svc.qty || 0);
  }, 0);
  const totalRub = totalHours * 4950;

  if (el.servicesTotalHours) el.servicesTotalHours.textContent = fmtHours(totalHours);
  if (el.servicesTotalRub) el.servicesTotalRub.textContent = fmtRub(totalRub);
  if (el.sumTotal) el.sumTotal.textContent = fmtRub(totalRub);
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
  const totals = managerTotals || { totalHours: 0, totalRub: 0, error: '' };

  if (!pkgView) {
    // Сбрасываем заголовок (и возможную кнопку «подробнее»)
    _renderPackageTitle('Пакет: —', null);
    el.pkgWho.textContent = '';
    el.pkgPills.innerHTML = '';
    el.pkgPills.style.display = 'none';
    el.diagBanner.style.display = 'none';
    el.sumTotal.textContent = 'Выберите тип клиента';
    if (el.servicesList) el.servicesList.innerHTML = '';
    if (el.servicesTotalHours) el.servicesTotalHours.textContent = '—';
    if (el.servicesTotalRub) el.servicesTotalRub.textContent = '—';
    if (el.servicesToggle) {
      el.servicesToggle.checked = !!state.servicesDetailed;
      el.servicesToggle.disabled = true;
    }
    renderList(el.pkgDetailed, []);
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
  whoParts.push(`ККТ: ${kktCount()} · Сканеры: ${dc.scanners || 0}`);
  el.pkgWho.textContent = whoParts.join(' · ');

  // Плашки
  el.pkgPills.innerHTML = '';
  el.pkgPills.style.display = 'none';

  // Детализация пакета
  if (el.pkgDetailed) {
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
  }

  // Диагностика (сейчас выключена)
  el.diagBanner.style.display = (needDiagnostics() ? 'block' : 'none');

  // Суммы
  el.sumTotal.textContent = fmtRub(totals.totalRub || 0);

  if (el.servicesToggle) {
    el.servicesToggle.checked = !!state.servicesDetailed;
    el.servicesToggle.disabled = false;
    el.servicesToggle.onchange = () => {
      state.servicesDetailed = !!el.servicesToggle.checked;
      applyPackagePreset(state.selectedPackageId);
      if (window.__AURORA_APP_UPDATE) window.__AURORA_APP_UPDATE();
    };
  }

  renderServicesList();
  renderServicesTotals();

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

    const dc = deviceCounts();
    const segs = (state.segments || []).join(', ') || '—';

    const items = [];
    items.push(`Сегменты: ${segs}`);
    items.push(`1С: ${onecStr}`);
    items.push(`ККТ: ${kktCount()} · Сканеры: ${dc.scanners || 0}`);
    if (state.custom_integration) items.push('Маркер: нестандарт/интеграции');

    items.push('────────');
    items.push(`Пакет: ${pkg.name || '—'}`);
    (state.services || []).forEach(svc => {
      const rowHours = Number(svc.hoursPerUnit || 0) * Number(svc.qty || 0);
      items.push(`- ${svc.title}: ${svc.qty || 0} × ${fmtHoursInline(svc.hoursPerUnit)} ч = ${fmtHoursInline(rowHours)} ч`);
    });

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
