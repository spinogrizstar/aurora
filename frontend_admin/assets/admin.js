// ФАЙЛ: frontend/assets/admin.js
// ------------------------------------------------------------
// Простая админка, чтобы менять цены/пакеты в data.json из браузера.
//
// КАК ЭТО РАБОТАЕТ:
//   1) Нажми «Загрузить data.json» — увидишь текущий JSON.
//   2) Поправь значения.
//   3) Нажми «Сохранить изменения» — сервер перезапишет frontend_shared/data/data.json
//      и сбросит кеш, чтобы расчёт сразу увидел новые цены.
//
// БЕЗОПАСНОСТЬ:
//   Админка работает только если в ОС задан AURORA_ADMIN_TOKEN.
//   Токен передаём в заголовке X-Aurora-Admin.
// ------------------------------------------------------------

const LS_KEY = 'aurora_admin_token';
const AURORA_ADMIN_TAB = 'aurora_admin_tab';

const el = {
  token: document.getElementById('token'),
  saveToken: document.getElementById('saveToken'),
  load: document.getElementById('load'),
  save: document.getElementById('save'),
  download: document.getElementById('download'),
  importFile: document.getElementById('importFile'),
  json: document.getElementById('json'),
  msg: document.getElementById('msg'),
  quick: document.getElementById('quick'),
};


// -------------------------
// TOAST уведомления (маленькие всплывашки снизу справа)
// -------------------------
function toast(title, body = '', kind = 'ok', ms = 2800) {
  const host = document.getElementById('toastHost');
  if (!host) return;
  const t = document.createElement('div');
  t.className = `toast toast--${kind}`;
  t.innerHTML = `<div class="tHd">${title}</div>${body ? `<div class="tBd">${body}</div>` : ''}`;
  host.appendChild(t);
  requestAnimationFrame(() => t.classList.add('toast--show'));
  window.setTimeout(() => {
    t.classList.remove('toast--show');
    window.setTimeout(() => t.remove(), 220);
  }, ms);
}

let currentData = null;
let currentCore = null;
const CORE_PRICE_PER_POINT = 4950;

// Короткие пояснения к полям points_model (чтобы было понятно «что за что отвечает»)
const POINTS_HELP = {
  kkt_rereg_points_per_kkt: 'Баллы за доп. кассу: перерегистрация/подготовка под маркировку (за 1 кассу сверх первой).',
  rr_points_per_kkt: 'Баллы за доп. кассу: включение/настройка Разрешительного режима (РР) (за 1 кассу сверх первой).',
  org_points_per_extra: 'Баллы за каждое доп. юрлицо сверх первого.',
  rework_points: 'Баллы за сценарии: остатки/перемаркировка/вывод из оборота.',
  aggregation_points: 'Баллы за сценарии: агрегация/КИТУ.',
  big_volume_points: 'Баллы за сценарии: большие объёмы/автоматизация.',
  no_edo_wholesale_points: 'Баллы штрафа/усложнения: нет ЭДО при опте/производстве.',
  producer_codes_points: 'Баллы за производителя: заказ кодов/нанесение.',
  scanner_setup_points_per_scanner: 'Баллы за каждый доп. сканер сверх первого.',
  custom_project_marker_points: 'Маркер проекта: баллы за нестандарт/интеграции.',
  tsd_license_rub: 'Стоимость лицензии Клеверенс на 1 ТСД (в рублях).',
  collective_tsd_license_rub: 'Доплата за «коллективную работу» на 1 ТСД (в рублях).',
};

function h(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') e.className = v;
    else if (k === 'style') e.setAttribute('style', v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  const arr = Array.isArray(children) ? children : [children];
  for (const c of arr) {
    if (c == null) continue;
    if (typeof c === 'string') e.appendChild(document.createTextNode(c));
    else e.appendChild(c);
  }
  return e;
}

function mkInput(label, value, { type = 'text', step = null, placeholder = '' } = {}) {
  const inp = h('input', { class: 'input', type, placeholder });
  inp.value = value ?? '';
  if (step != null) inp.step = String(step);
  const wrap = h('div', { class: 'card', style: 'padding:12px 14px;border-radius:18px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.10);' }, [
    h('div', { class: 'sub', style: 'margin-bottom:6px;opacity:.9' }, label),
    inp,
  ]);
  return { wrap, inp };
}

function mkTextarea(label, value, { rows = 3, placeholder = '' } = {}) {
  const ta = h('textarea', { class: 'input', rows: String(rows), placeholder, style: 'width:100%;min-height:auto;resize:vertical;' });
  ta.value = value ?? '';
  const wrap = h('div', { class: 'card', style: 'padding:12px 14px;border-radius:18px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.10);' }, [
    h('div', { class: 'sub', style: 'margin-bottom:6px;opacity:.9' }, label),
    ta,
  ]);
  return { wrap, ta };
}

function sumGroupPoints(groups = []) {
  return groups.reduce((acc, g) => acc + Number(g?.points || 0), 0);
}

function sumDetailPoints(details = []) {
  return details.reduce((acc, d) => acc + Number(d?.points || 0), 0);
}

function renderQuick(data) {
  el.quick.innerHTML = '';

  // ----------------------------------------------------------
  // Табы: чтобы админка была «как приложение», а не поле JSON.
  // ----------------------------------------------------------
  const tabs = h('div', { class: 'tabs' });
  const panes = {
    main: h('div', { class: 'tabPane', 'data-tab': 'main' }),
    packages: h('div', { class: 'tabPane', 'data-tab': 'packages' }),
    core: h('div', { class: 'tabPane', 'data-tab': 'core' }),
    points: h('div', { class: 'tabPane', 'data-tab': 'points' }),
    catalogs: h('div', { class: 'tabPane', 'data-tab': 'catalogs' }),
  };

  const tabButtons = [
    { id: 'main', label: 'Основное' },
    { id: 'packages', label: 'Пакеты' },
    { id: 'core', label: 'Core пакеты (4 основных)' },
    { id: 'points', label: 'Баллы и лицензии' },
    { id: 'catalogs', label: 'Справочники' },
  ].map(t => {
    const b = h('button', { class: 'tabBtn', type: 'button', onclick: () => setTab(t.id) }, t.label);
    tabs.appendChild(b);
    return { ...t, el: b };
  });

  function setTab(id) {
    try { localStorage.setItem(AURORA_ADMIN_TAB, id); } catch(e) {}
    tabButtons.forEach(b => b.el.classList.toggle('active', b.id === id));
    Object.values(panes).forEach(p => p.classList.toggle('active', p.getAttribute('data-tab') === id));
  }

  // ----------------------------------------------------------
  // TAB: Основное
  // ----------------------------------------------------------
  const topGrid = h('div', { class: 'adminGrid', style: 'grid-template-columns:repeat(2,minmax(0,1fr));gap:12px' });
  const rubPer = mkInput('Цена за 1 балл (rub_per_point)', data.rub_per_point, { type: 'number', step: 1 });
  const diag = mkInput('Диагностика (diag_price_rub)', data.diag_price_rub, { type: 'number', step: 1 });
  const supportPts = mkInput('Поддержка (support_points — баллы)', data.support_points, { type: 'number', step: 1 });
  const supportLabel = mkInput('Поддержка (support_label — название)', data.support_label || '', { type: 'text' });
  [rubPer.wrap, diag.wrap, supportPts.wrap, supportLabel.wrap].forEach(x => topGrid.appendChild(x));

  const applyTop = () => {
    data.rub_per_point = parseInt(rubPer.inp.value || '0', 10) || 0;
    data.diag_price_rub = parseInt(diag.inp.value || '0', 10) || 0;
    data.support_points = parseInt(supportPts.inp.value || '0', 10) || 0;
    data.support_label = (supportLabel.inp.value || '').trim();
  };
  [rubPer.inp, diag.inp, supportPts.inp, supportLabel.inp].forEach(inp => {
    inp.addEventListener('input', () => {
      applyTop();
      syncJsonFromData();
    });
  });

  panes.main.appendChild(h('div', { class: 'adminHint', style: 'margin:0 0 10px 0' }, 'Основные параметры расчёта. Меняешь значения — расчёт на сайте меняется сразу после сохранения data.json.'));
  panes.main.appendChild(topGrid);

  // ----------------------------------------------------------
  // TAB: Пакеты
  // ----------------------------------------------------------
  const pkgsCard = h('div', { class: 'card', style: 'padding:12px 14px;' }, [
    h('div', { class: 'h2', style: 'margin-bottom:6px' }, 'Пакеты по сегментам (segments)'),
    h('div', { class: 'adminHint', style: 'margin-bottom:10px' }, 'Можно править названия, цены и «что включено». Плюс — добавлять/дублировать/перетаскивать пакеты без JSON.'),
  ]);

  const segments = data.segments || {};
  const segNames = Object.keys(segments);
  if (segNames.length === 0) {
    pkgsCard.appendChild(h('div', { class: 'adminErr' }, 'В data.json нет segments. Нечего редактировать.'));
  }

  function newPackageTemplate() {
    return { name: 'Новый пакет', price: 0, inc: '', who: '', detail: '' };
  }

  function moveItem(arr, from, to) {
    if (to < 0 || to >= arr.length) return;
    const item = arr.splice(from, 1)[0];
    arr.splice(to, 0, item);
  }

  segNames.forEach(segName => {
    const det = h('details', { open: false, style: 'margin:10px 0;padding:10px 12px;border-radius:18px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.10);' });
    const sum = h('summary', { style: 'cursor:pointer;user-select:none;' }, [
      h('span', { class: 'h2', style: 'font-size:16px' }, segName),
      h('span', { class: 'adminTag', style: 'margin-left:10px' }, `пакетов: ${(segments[segName]||[]).length}`),
    ]);
    det.appendChild(sum);

    const list = segments[segName] || [];

    (list).forEach((p, idx) => {
      const row = h('div', { style: 'margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,.10);' });
      row.appendChild(h('div', { class: 'sub', style: 'margin-bottom:8px;opacity:.9' }, `Пакет #${idx+1}`));
      const g = h('div', { class: 'adminGrid', style: 'grid-template-columns:repeat(2,minmax(0,1fr));gap:12px' });

      const nm = mkInput('Название', p.name || '', { type: 'text' });
      const pr = mkInput('Цена (руб)', p.price || 0, { type: 'number', step: 1 });
      const inc = mkTextarea('Что включено (inc)', p.inc || '', { rows: 3 });
      const who = mkTextarea('Кому подходит (who)', p.who || '', { rows: 2 });
      const detail = mkTextarea('Детали (detail)', p.detail || '', { rows: 2 });

      g.appendChild(nm.wrap);
      g.appendChild(pr.wrap);
      g.appendChild(inc.wrap);
      g.appendChild(who.wrap);
      g.appendChild(detail.wrap);
      row.appendChild(g);

      const btns = h('div', { class: 'miniBtns' });
      const bUp = h('button', { class: 'btn alt mini', type: 'button', onclick: () => {
        moveItem(list, idx, idx - 1);
        syncJsonFromData();
        renderQuick(currentData);
      } }, '↑ выше');
      const bDown = h('button', { class: 'btn alt mini', type: 'button', onclick: () => {
        moveItem(list, idx, idx + 1);
        syncJsonFromData();
        renderQuick(currentData);
      } }, '↓ ниже');
      const bDup = h('button', { class: 'btn alt mini', type: 'button', onclick: () => {
        list.splice(idx + 1, 0, JSON.parse(JSON.stringify(p)));
        syncJsonFromData();
        renderQuick(currentData);
      } }, 'Дублировать');
      const bDel = h('button', { class: 'btn mini danger', type: 'button', onclick: () => {
        if (!confirm('Удалить этот пакет?')) return;
        list.splice(idx, 1);
        syncJsonFromData();
        renderQuick(currentData);
      } }, 'Удалить');
      [bUp, bDown, bDup, bDel].forEach(x => btns.appendChild(x));
      row.appendChild(btns);

      const applyPkg = () => {
        p.name = (nm.inp.value || '').trim();
        p.price = parseInt(pr.inp.value || '0', 10) || 0;
        p.inc = (inc.ta.value || '').trim();
        p.who = (who.ta.value || '').trim();
        p.detail = (detail.ta.value || '').trim();
      };
      [nm.inp, pr.inp, inc.ta, who.ta, detail.ta].forEach(inp => inp.addEventListener('input', () => {
        applyPkg();
        syncJsonFromData();
      }));

      det.appendChild(row);
    });

    const addWrap = h('div', { style: 'margin-top:12px;padding-top:12px;border-top:1px dashed rgba(255,255,255,.18);' });
    addWrap.appendChild(h('div', { class: 'adminHint', style: 'margin-bottom:8px' }, 'Добавить новый пакет в этот сегмент:'));
    addWrap.appendChild(h('button', { class: 'btn alt mini', type: 'button', onclick: () => {
      list.push(newPackageTemplate());
      syncJsonFromData();
      renderQuick(currentData);
    } }, '+ Добавить пакет'));
    det.appendChild(addWrap);

    pkgsCard.appendChild(det);
  });

  panes.packages.appendChild(pkgsCard);

  // ----------------------------------------------------------
  // TAB: Core пакеты (4 основных)
  // ----------------------------------------------------------
  const coreCard = h('div', { class: 'card', style: 'padding:12px 14px;' }, [
    h('div', { class: 'h2', style: 'margin-bottom:6px' }, 'Core пакеты (4 основных)'),
    h('div', { class: 'adminHint', style: 'margin-bottom:10px' }, 'Редактируй ключевые пакеты. Эти данные используются клиентом, менеджером и Word-выгрузкой.'),
  ]);
  const coreActions = h('div', { class: 'adminRow', style: 'margin:4px 0 10px 0;' }, [
    h('button', { class: 'btn', type: 'button', onclick: () => saveCorePackages().catch(e => setMsg('Ошибка сохранения core пакетов: ' + e.message, 'err')) }, 'Сохранить core пакеты'),
  ]);
  coreCard.appendChild(coreActions);

  if (!currentCore || typeof currentCore !== 'object') currentCore = { packages: [] };
  if (!Array.isArray(currentCore.packages)) currentCore.packages = [];

  const corePackages = currentCore.packages;

  function rerenderCore() {
    renderQuick(currentData);
  }

  corePackages.forEach((pkg, idx) => {
    if (!pkg || typeof pkg !== 'object') corePackages[idx] = { title: '', segment_key: '', total_points: 0, price_rub: 0, groups: [] };
    const p = corePackages[idx];
    if (!Array.isArray(p.groups)) p.groups = [];

    const det = h('details', { open: true, style: 'margin:10px 0;padding:10px 12px;border-radius:18px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.10);' });
    const sum = h('summary', { style: 'cursor:pointer;user-select:none;' }, [
      h('span', { class: 'h2', style: 'font-size:16px' }, p.title || `Пакет #${idx + 1}`),
      h('span', { class: 'adminTag', style: 'margin-left:10px' }, `groups: ${p.groups.length}`),
    ]);
    det.appendChild(sum);

    const grid = h('div', { class: 'adminGrid', style: 'grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:12px;' });
    const title = mkInput('Название (title)', p.title || '', { type: 'text' });
    const segment = mkInput('segment_key', p.segment_key || '', { type: 'text', placeholder: 'retail_only | wholesale_only | producer_only | producer_retail' });
    const totalPts = mkInput('total_points', p.total_points || 0, { type: 'number', step: 1 });
    const price = mkInput('price_rub', p.price_rub || p.price || '', { type: 'number', step: 1, placeholder: '0 = авто' });
    [title.wrap, segment.wrap, totalPts.wrap, price.wrap].forEach(x => grid.appendChild(x));
    det.appendChild(grid);

    const applyPkg = () => {
      p.title = (title.inp.value || '').trim();
      p.segment_key = (segment.inp.value || '').trim();
      p.total_points = parseInt(totalPts.inp.value || '0', 10) || 0;
      const priceVal = parseInt(price.inp.value || '0', 10) || 0;
      p.price_rub = priceVal;
    };
    [title.inp, segment.inp, totalPts.inp, price.inp].forEach(inp => inp.addEventListener('input', () => {
      applyPkg();
      sum.firstChild.textContent = p.title || `Пакет #${idx + 1}`;
    }));

    const priceBtn = h('button', {
      class: 'btn alt mini',
      type: 'button',
      onclick: () => {
        if ((price.inp.value || '').trim()) return;
        const total = parseInt(totalPts.inp.value || '0', 10) || 0;
        if (!total) return;
        const next = total * CORE_PRICE_PER_POINT;
        price.inp.value = String(next);
        applyPkg();
      }
    }, 'Пересчитать цену если пусто (total_points × 4950)');
    det.appendChild(priceBtn);

    const warn = h('div', { class: 'adminHint', style: 'margin-top:8px;' });
    const updateWarn = () => {
      const total = Number(p.total_points || 0);
      const sumGroups = sumGroupPoints(p.groups);
      const detailMismatch = p.groups.some(g => Array.isArray(g.details) && g.details.length && sumDetailPoints(g.details) !== Number(g.points || 0));
      const parts = [];
      if (total !== sumGroups) parts.push(`total_points (${total}) != сумма групп (${sumGroups})`);
      if (detailMismatch) parts.push('есть группы, где сумма деталей не равна баллам группы');
      warn.textContent = parts.length ? `Проверка: ${parts.join(' • ')}` : 'Проверка: ок (total_points = сумма групп).';
      warn.className = parts.length ? 'adminErr' : 'adminOk';
    };
    updateWarn();
    det.appendChild(warn);

    p.groups.forEach((group, gIdx) => {
      if (!group || typeof group !== 'object') p.groups[gIdx] = { name: '', points: 0, note: '', details: [] };
      const g = p.groups[gIdx];
      if (!Array.isArray(g.details)) g.details = [];

      const gWrap = h('div', { style: 'margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,.10);' });
      gWrap.appendChild(h('div', { class: 'sub', style: 'margin-bottom:8px;opacity:.9' }, `Группа #${gIdx + 1}`));
      const gGrid = h('div', { class: 'adminGrid', style: 'grid-template-columns:repeat(2,minmax(0,1fr));gap:12px' });
      const gName = mkInput('Название группы', g.name || '', { type: 'text' });
      const gPoints = mkInput('Баллы группы', g.points || 0, { type: 'number', step: 1 });
      const gNote = mkTextarea('Комментарий (note)', g.note || '', { rows: 2 });
      [gName.wrap, gPoints.wrap, gNote.wrap].forEach(x => gGrid.appendChild(x));
      gWrap.appendChild(gGrid);

      const applyGroup = () => {
        g.name = (gName.inp.value || '').trim();
        g.points = parseInt(gPoints.inp.value || '0', 10) || 0;
        g.note = (gNote.ta.value || '').trim();
        updateWarn();
      };
      [gName.inp, gPoints.inp, gNote.ta].forEach(inp => inp.addEventListener('input', applyGroup));

      g.details.forEach((detail, dIdx) => {
        if (!detail || typeof detail !== 'object') g.details[dIdx] = { text: '', points: 0 };
        const d = g.details[dIdx];
        const dRow = h('div', { class: 'adminGrid', style: 'grid-template-columns:3fr 1fr auto;gap:10px;margin-top:10px;' });
        const dText = h('input', { class: 'input', type: 'text', value: d.text || '', placeholder: 'Деталь' });
        const dPoints = h('input', { class: 'input', type: 'number', step: 1, value: d.points || 0 });
        const dDel = h('button', { class: 'btn mini danger', type: 'button', onclick: () => {
          g.details.splice(dIdx, 1);
          rerenderCore();
        } }, 'Удалить');
        dRow.appendChild(dText);
        dRow.appendChild(dPoints);
        dRow.appendChild(dDel);
        gWrap.appendChild(dRow);
        [dText, dPoints].forEach(inp => inp.addEventListener('input', () => {
          d.text = (dText.value || '').trim();
          d.points = parseInt(dPoints.value || '0', 10) || 0;
          updateWarn();
        }));
      });

      gWrap.appendChild(h('button', { class: 'btn alt mini', type: 'button', onclick: () => {
        g.details.push({ text: '', points: 0 });
        rerenderCore();
      } }, '+ Добавить деталь'));

      const gBtns = h('div', { class: 'miniBtns' });
      const gUp = h('button', { class: 'btn alt mini', type: 'button', onclick: () => {
        if (gIdx <= 0) return;
        const item = p.groups.splice(gIdx, 1)[0];
        p.groups.splice(gIdx - 1, 0, item);
        rerenderCore();
      } }, '↑ группа');
      const gDown = h('button', { class: 'btn alt mini', type: 'button', onclick: () => {
        if (gIdx >= p.groups.length - 1) return;
        const item = p.groups.splice(gIdx, 1)[0];
        p.groups.splice(gIdx + 1, 0, item);
        rerenderCore();
      } }, '↓ группа');
      const gDel = h('button', { class: 'btn mini danger', type: 'button', onclick: () => {
        if (!confirm('Удалить группу?')) return;
        p.groups.splice(gIdx, 1);
        rerenderCore();
      } }, 'Удалить группу');
      [gUp, gDown, gDel].forEach(b => gBtns.appendChild(b));
      gWrap.appendChild(gBtns);

      det.appendChild(gWrap);
    });

    det.appendChild(h('button', { class: 'btn alt mini', type: 'button', onclick: () => {
      p.groups.push({ name: '', points: 0, note: '', details: [] });
      rerenderCore();
    } }, '+ Добавить группу'));

    const pkgBtns = h('div', { class: 'miniBtns' });
    const pkgUp = h('button', { class: 'btn alt mini', type: 'button', onclick: () => {
      if (idx <= 0) return;
      const item = corePackages.splice(idx, 1)[0];
      corePackages.splice(idx - 1, 0, item);
      rerenderCore();
    } }, '↑ пакет');
    const pkgDown = h('button', { class: 'btn alt mini', type: 'button', onclick: () => {
      if (idx >= corePackages.length - 1) return;
      const item = corePackages.splice(idx, 1)[0];
      corePackages.splice(idx + 1, 0, item);
      rerenderCore();
    } }, '↓ пакет');
    const pkgDel = h('button', { class: 'btn mini danger', type: 'button', onclick: () => {
      if (!confirm('Удалить пакет?')) return;
      corePackages.splice(idx, 1);
      rerenderCore();
    } }, 'Удалить пакет');
    [pkgUp, pkgDown, pkgDel].forEach(b => pkgBtns.appendChild(b));
    det.appendChild(pkgBtns);

    coreCard.appendChild(det);
  });

  coreCard.appendChild(h('button', { class: 'btn alt mini', type: 'button', style: 'margin-top:10px', onclick: () => {
    corePackages.push({ title: '', segment_key: '', total_points: 0, price_rub: 0, groups: [] });
    rerenderCore();
  } }, '+ Добавить core пакет'));

  panes.core.appendChild(coreCard);

  // ----------------------------------------------------------
  // TAB: Баллы и лицензии
  // ----------------------------------------------------------
  const pmCard = h('div', { class: 'card', style: 'padding:12px 14px;' }, [
    h('div', { class: 'h2', style: 'margin-bottom:6px' }, 'Модель баллов и лицензий (points_model)'),
    h('div', { class: 'adminHint', style: 'margin-bottom:10px' }, 'Подсказка по каждому полю есть в title — наведи курсор. Баллы → влияют на доп.услуги, рубли → стоимость лицензий.'),
  ]);

  const pm = data.points_model || {};
  const pmGrid = h('div', { class: 'adminGrid', style: 'grid-template-columns:repeat(2,minmax(0,1fr));gap:12px' });
  Object.keys(pm).forEach(key => {
    const inp = mkInput(key, pm[key], { type: 'number', step: 1 });
    inp.inp.title = POINTS_HELP[key] || '';
    inp.inp.addEventListener('input', () => {
      pm[key] = parseInt(inp.inp.value || '0', 10) || 0;
      syncJsonFromData();
    });
    pmGrid.appendChild(inp.wrap);
  });
  pmCard.appendChild(pmGrid);
  panes.points.appendChild(pmCard);

  // ----------------------------------------------------------
  // TAB: Справочники
  // ----------------------------------------------------------
  const catCard = h('div', { class: 'card', style: 'padding:12px 14px;' }, [
    h('div', { class: 'h2', style: 'margin-bottom:6px' }, 'Справочники (для чек‑листа)'),
    h('div', { class: 'adminHint', style: 'margin-bottom:10px' }, 'Здесь правятся выпадающие списки: конфигурации 1С и планы Клеверенса.'),
  ]);

  // 1C configs
  const onec = data.onec_configs || [];
  catCard.appendChild(h('div', { class: 'h2', style: 'font-size:16px;margin-top:6px' }, '1С конфигурации'));
  catCard.appendChild(h('div', { class: 'adminHint', style: 'margin:6px 0 10px 0' }, 'ID — короткий ключ (латиница/цифры), Name — как видно пользователю.'));

  const onecWrap = h('div', { class: 'adminGrid', style: 'grid-template-columns:repeat(1,minmax(0,1fr));gap:10px' });
  onec.forEach((c, idx) => {
    const row = h('div', { class: 'card', style: 'padding:12px 14px;border-radius:18px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.10);' });
    const g = h('div', { class: 'adminGrid', style: 'grid-template-columns:220px 1fr;gap:12px' });
    const id = mkInput('ID', c.id || '', { type: 'text' });
    const nm = mkInput('Название', c.name || '', { type: 'text' });
    g.appendChild(id.wrap); g.appendChild(nm.wrap);
    row.appendChild(g);
    const btns = h('div', { class: 'miniBtns' }, [
      h('button', { class: 'btn alt mini', type: 'button', onclick: () => { moveItem(onec, idx, idx-1); syncJsonFromData(); renderQuick(currentData);} }, '↑'),
      h('button', { class: 'btn alt mini', type: 'button', onclick: () => { moveItem(onec, idx, idx+1); syncJsonFromData(); renderQuick(currentData);} }, '↓'),
      h('button', { class: 'btn mini danger', type: 'button', onclick: () => { if(!confirm('Удалить конфигурацию 1С?')) return; onec.splice(idx,1); syncJsonFromData(); renderQuick(currentData);} }, 'Удалить'),
    ]);
    row.appendChild(btns);
    const apply = () => { c.id = (id.inp.value||'').trim(); c.name = (nm.inp.value||'').trim(); };
    [id.inp, nm.inp].forEach(i => i.addEventListener('input', () => { apply(); syncJsonFromData(); }));
    onecWrap.appendChild(row);
  });
  catCard.appendChild(onecWrap);
  catCard.appendChild(h('button', { class: 'btn alt mini', type: 'button', style: 'margin-top:10px', onclick: () => { onec.push({id:'',name:''}); syncJsonFromData(); renderQuick(currentData);} }, '+ Добавить конфигурацию 1С'));

  // Cleverence plans
  const plans = data.cleverence_plans || [];
  catCard.appendChild(h('div', { class: 'h2', style: 'font-size:16px;margin-top:18px' }, 'Планы Клеверенса'));
  catCard.appendChild(h('div', { class: 'adminHint', style: 'margin:6px 0 10px 0' }, 'Includes — список пунктов (по одному в строке).'));

  const plansWrap = h('div', { class: 'adminGrid', style: 'grid-template-columns:repeat(1,minmax(0,1fr));gap:10px' });
  plans.forEach((p, idx) => {
    const card = h('div', { class: 'card', style: 'padding:12px 14px;border-radius:18px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.10);' });
    card.appendChild(h('div', { class: 'sub', style: 'margin-bottom:8px;opacity:.9' }, `План #${idx+1}`));
    const g = h('div', { class: 'adminGrid', style: 'grid-template-columns:repeat(2,minmax(0,1fr));gap:12px' });
    const id = mkInput('ID', p.id || '', { type: 'text' });
    const nm = mkInput('Название', p.name || '', { type: 'text' });
    const desc = mkTextarea('Описание (desc)', p.desc || '', { rows: 3 });
    const inc = mkTextarea('Что входит (includes — по 1 пункту в строке)', (p.includes || []).join('\n'), { rows: 4 });
    g.appendChild(id.wrap); g.appendChild(nm.wrap); g.appendChild(desc.wrap); g.appendChild(inc.wrap);
    card.appendChild(g);
    const btns = h('div', { class: 'miniBtns' }, [
      h('button', { class: 'btn alt mini', type: 'button', onclick: () => { moveItem(plans, idx, idx-1); syncJsonFromData(); renderQuick(currentData);} }, '↑'),
      h('button', { class: 'btn alt mini', type: 'button', onclick: () => { moveItem(plans, idx, idx+1); syncJsonFromData(); renderQuick(currentData);} }, '↓'),
      h('button', { class: 'btn alt mini', type: 'button', onclick: () => { plans.splice(idx+1,0, JSON.parse(JSON.stringify(p))); syncJsonFromData(); renderQuick(currentData);} }, 'Дублировать'),
      h('button', { class: 'btn mini danger', type: 'button', onclick: () => { if(!confirm('Удалить план?')) return; plans.splice(idx,1); syncJsonFromData(); renderQuick(currentData);} }, 'Удалить'),
    ]);
    card.appendChild(btns);
    const apply = () => {
      p.id = (id.inp.value||'').trim();
      p.name = (nm.inp.value||'').trim();
      p.desc = (desc.ta.value||'').trim();
      p.includes = (inc.ta.value||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    };
    [id.inp, nm.inp, desc.ta, inc.ta].forEach(i => i.addEventListener('input', () => { apply(); syncJsonFromData(); }));
    plansWrap.appendChild(card);
  });
  catCard.appendChild(plansWrap);
  catCard.appendChild(h('button', { class: 'btn alt mini', type: 'button', style: 'margin-top:10px', onclick: () => { plans.push({id:'',name:'',desc:'',includes:[]}); syncJsonFromData(); renderQuick(currentData);} }, '+ Добавить план Клеверенса'));

  panes.catalogs.appendChild(catCard);

  // Сборка UI
  el.quick.appendChild(tabs);
  el.quick.appendChild(panes.main);
  el.quick.appendChild(panes.packages);
  el.quick.appendChild(panes.points);
  el.quick.appendChild(panes.catalogs);
  const savedTab = (()=>{ try { return (localStorage.getItem(AURORA_ADMIN_TAB)||'').trim(); } catch(e){ return ''; } })();
  setTab(savedTab || 'main');
}

function syncJsonFromData() {
  if (!currentData) return;
  el.json.value = JSON.stringify(currentData, null, 2);
}

function setMsg(html, kind = 'ok') {
  el.msg.innerHTML = `<div class="${kind === 'err' ? 'adminErr' : 'adminOk'}">${html}</div>`;
  // Дублируем в toast, чтобы не искать глазами сообщение наверху
  try {
    const plain = (''+html).replace(/<[^>]+>/g,'').trim();
    toast(kind === 'err' ? 'Ошибка' : 'Готово', plain, kind === 'err' ? 'err' : 'ok');
  } catch(e) {}
}

function getToken() {
  return (localStorage.getItem(LS_KEY) || '').trim();
}

function saveToken() {
  const t = (el.token.value || '').trim();
  if (!t) {
    setMsg('Вставь токен и нажми «Сохранить токен».', 'err');
    return;
  }
  localStorage.setItem(LS_KEY, t);
  setMsg('Токен сохранён в браузере.');
}

async function api(path, opts = {}) {
  const token = getToken();
  const headers = { ...(opts.headers || {}) };
  if (token) headers['X-Aurora-Admin'] = token;
  const r = await fetch(path, { ...opts, headers });
  const text = await r.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!r.ok) {
    throw new Error(typeof data === 'string' ? data : (data?.detail || `HTTP ${r.status}`));
  }
  return data;
}

async function loadData() {
  const [data, core] = await Promise.all([
    api('/api/admin/data'),
    api('/api/admin/core-packages'),
  ]);
  currentData = data;
  currentCore = core;
  syncJsonFromData();
  renderQuick(currentData);
  setMsg('Данные загружены. Можно править в «Быстрых настройках» или прямо в JSON.');
}

async function saveData() {
  // Валидируем JSON на клиенте, чтобы не отправлять мусор.
  let obj;
  try {
    obj = JSON.parse(el.json.value);
  } catch (e) {
    setMsg('JSON некорректный: ' + (e?.message || e), 'err');
    return;
  }
  if (!obj || typeof obj !== 'object') {
    setMsg('JSON должен быть объектом (в фигурных скобках).', 'err');
    return;
  }

  // Базовая валидация, чтобы не сохранить очевидную ерунду.
  const problems = validateData(obj);
  if (problems.length) {
    setMsg('Не сохраняю — проверь поля:<br><ul style="margin:6px 0 0 18px">' + problems.map(p => `<li>${p}</li>`).join('') + '</ul>', 'err');
    return;
  }

  // Держим быстрые настройки в актуальном состоянии
  currentData = obj;
  renderQuick(currentData);

  const res = await api('/api/admin/data', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(obj),
  });
  if (res?.ok) setMsg('Сохранено. Расчёт уже работает с новыми ценами.');
  else setMsg('Не удалось сохранить: ' + JSON.stringify(res), 'err');
}

function validateCorePackages(obj) {
  const errors = [];
  const warnings = [];
  if (!obj || typeof obj !== 'object') {
    errors.push('Core packages: JSON должен быть объектом.');
    return { errors, warnings };
  }
  const pkgs = Array.isArray(obj.packages) ? obj.packages : [];
  pkgs.forEach((p, idx) => {
    const title = (p?.title || p?.name || '').trim() || `Пакет #${idx + 1}`;
    const groups = Array.isArray(p?.groups) ? p.groups : [];
    const total = Number(p?.total_points || 0);
    const sumGroups = sumGroupPoints(groups);
    if (total !== sumGroups) {
      errors.push(`${title}: total_points (${total}) != сумма групп (${sumGroups})`);
    }
    groups.forEach((g, gIdx) => {
      const details = Array.isArray(g?.details) ? g.details : [];
      if (!details.length) return;
      const sumDetails = sumDetailPoints(details);
      const gPoints = Number(g?.points || 0);
      if (sumDetails !== gPoints) {
        warnings.push(`${title} → группа #${gIdx + 1}: сумма деталей (${sumDetails}) != баллы группы (${gPoints})`);
      }
    });
  });
  return { errors, warnings };
}

async function saveCorePackages() {
  const core = currentCore || { packages: [] };
  const { errors, warnings } = validateCorePackages(core);
  if (errors.length) {
    setMsg('Core пакеты: не сохраняю — проверь поля:<br><ul style="margin:6px 0 0 18px">' + errors.map(p => `<li>${p}</li>`).join('') + '</ul>', 'err');
    return;
  }
  if (warnings.length) {
    setMsg('Core пакеты: сохраню, но есть предупреждения:<br><ul style="margin:6px 0 0 18px">' + warnings.map(p => `<li>${p}</li>`).join('') + '</ul>');
  }
  const res = await api('/api/admin/core-packages', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(core),
  });
  if (res?.ok) {
    if (!warnings.length) setMsg('Core пакеты сохранены.');
  } else {
    setMsg('Не удалось сохранить core пакеты: ' + JSON.stringify(res), 'err');
  }
}

function validateData(obj) {
  const problems = [];
  // 1С
  if (Array.isArray(obj.onec_configs)) {
    const seen = new Set();
    obj.onec_configs.forEach((c, i) => {
      const id = (c?.id || '').trim();
      const name = (c?.name || '').trim();
      if (!id) problems.push(`1С: пустой ID в строке #${i + 1}`);
      if (!name) problems.push(`1С: пустое название в строке #${i + 1}`);
      if (id) {
        if (seen.has(id)) problems.push(`1С: дублируется ID «${id}»`);
        seen.add(id);
      }
    });
  }

  // Планы Клеверенса
  if (Array.isArray(obj.cleverence_plans)) {
    const seen = new Set();
    obj.cleverence_plans.forEach((p, i) => {
      const id = (p?.id || '').trim();
      const name = (p?.name || '').trim();
      if (!id) problems.push(`Клеверенс: пустой ID в плане #${i + 1}`);
      if (!name) problems.push(`Клеверенс: пустое название в плане #${i + 1}`);
      if (id) {
        if (seen.has(id)) problems.push(`Клеверенс: дублируется ID «${id}»`);
        seen.add(id);
      }
    });
  }

  // Сегменты/пакеты
  if (obj.segments && typeof obj.segments === 'object') {
    for (const [seg, pkgs] of Object.entries(obj.segments)) {
      if (!Array.isArray(pkgs)) continue;
      pkgs.forEach((p, i) => {
        const name = (p?.name || '').trim();
        if (!name) problems.push(`Пакеты: пустое название (сегмент «${seg}», пакет #${i + 1})`);
      });
    }
  }
  return problems;
}

// init
el.token.value = getToken();
el.saveToken.onclick = saveToken;
el.load.onclick = () => loadData().catch(e => setMsg('Ошибка загрузки: ' + e.message, 'err'));
el.save.onclick = () => saveData().catch(e => setMsg('Ошибка сохранения: ' + e.message, 'err'));

// Скачать резервную копию текущего data.json
el.download.onclick = () => {
  if (!el.json.value) {
    setMsg('Сначала нажми «Загрузить data.json».', 'err');
    return;
  }
  const blob = new Blob([el.json.value], { type: 'application/json;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `data.backup.${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
};

// Импорт JSON из файла (заменяет текущее содержимое, но НЕ сохраняет на сервер пока не нажмёшь «Сохранить»)
el.importFile.addEventListener('change', async () => {
  const f = el.importFile.files?.[0];
  if (!f) return;
  try {
    const text = await f.text();
    const obj = JSON.parse(text);
    currentData = obj;
    syncJsonFromData();
    renderQuick(currentData);
    setMsg('JSON импортирован. Проверь вкладки и нажми «Сохранить изменения», если всё ок.');
  } catch (e) {
    setMsg('Не удалось импортировать JSON: ' + (e?.message || e), 'err');
  } finally {
    el.importFile.value = '';
  }
});

// Если кто-то правит JSON руками — при выходе из поля попробуем обновить быстрые настройки
el.json.addEventListener('blur', () => {
  try {
    const obj = JSON.parse(el.json.value);
    if (obj && typeof obj === 'object') {
      currentData = obj;
      renderQuick(currentData);
    }
  } catch {
    // молча
  }
});

// Автозагрузка, если токен уже сохранён
if (getToken()) {
  loadData().catch(() => {});
}
