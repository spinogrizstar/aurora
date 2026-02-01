// ФАЙЛ: frontend/assets/ui/checklist.js
// ------------------------------------------------------------
// Рендер левой части: сам чек-лист.
//
// Важно:
//   1) Блоки показываются постепенно (progressive): сначала сегмент,
//      потом появляются нужные разделы.
//   2) Анимация скрытия/появления замедлена (см. visibility.js).
// ------------------------------------------------------------

import { el } from '../dom.js';
import { state } from '../state.js';
import { getDataSync } from '../data.js';
import { KKT_TYPES, DEVICE_CATALOG, CZ_GROUPS } from '../catalogs.js';
import { SECTION_ANIM_MS, visibilityFromState } from '../visibility.js';
import { clamp, fmtRub, hasRetail, kktCount } from '../helpers.js';
import { mkDropdown } from '../components/dropdown.js';
import { attachPopover } from '../components/popover.js';
import { openInfoModal } from '../components/info_modal.js';

// Чтобы блоки “появлялись/убирались” анимацией, но при этом чекбоксы
// реагировали МГНОВЕННО (без задержек после клика).
//
// Раньше мы ждали SECTION_ANIM_MS перед перерисовкой — из-за этого
// галочка ставилась через ~1 сек и казалось, что сайт лагает.
// Теперь: перерисовываем сразу, а для скрываемых секций делаем
// «анимацию выхода» (см. revealAppend ниже).
let _prevVis = { onec:false, kkt:false, addons:false, devices:false, orgs:false, products:false, scenarios:false, support:false, contacts:false };

// Главный рендер чек-листа.
// update() передаём снаружи, чтобы избежать циклических импортов.
export function renderChecklist(update){
  const DATA = getDataSync();
  const checklistMain = el.checklistMain;
  const checklistExtra = el.checklistExtra;
  // Защита: если в HTML забыли id — не падаем.
  if (!checklistMain || !checklistExtra) {
    console.error('[Aurora] checklist containers not found');
    return;
  }
  checklistMain.innerHTML = '';
  checklistExtra.innerHTML = '';

  if (DATA?.__loadError) {
    const err = document.createElement('div');
    err.className = 'alert red';
    err.style.display = 'block';
    err.innerHTML = `<b>Данные не загрузились</b><div class="small" style="margin-top:8px;">${DATA.__loadError}</div>`;
    checklistMain.appendChild(err);
    checklistExtra.innerHTML = '<div class="mini" style="padding:2px 2px 0;color:rgba(255,255,255,.55)">Проверьте, что папка <b>data</b> доступна рядом с index.html.</div>';
    return;
  }

  // 1) Быстрый выбор пакета (4 карточки)
  const sec1 = document.createElement('div');
  sec1.className='section';
  sec1.innerHTML = `<div class="secTitle"><h3>Выбор типа клиента</h3><span class="tag">пакет</span></div>`;
  const opts1 = document.createElement('div'); opts1.className='packageGrid';

  const corePkgs = Array.isArray(DATA.core_packages?.packages) ? DATA.core_packages.packages : [];
  const pkgByKey = (key) => corePkgs.find(p => p.segment_key === key || p.id === key);
  const packages = [
    { key: 'retail_only', title: 'Только розница', segments: ['Розница'], quote_hours: 9 },
    { key: 'wholesale_only', title: 'Только опт', segments: ['Опт'], quote_hours: 7 },
    { key: 'producer_only', title: 'Только производитель/импортёр', segments: ['Производитель/Импортёр'], quote_hours: 12 },
    { key: 'producer_retail', title: 'Производитель + розница', segments: ['Производитель/Импортёр', 'Розница'], quote_hours: 18 },
  ];

  let activeKey = state.selectedPackageId || '';

  packages.forEach(pkgCfg => {
    const pkg = pkgByKey(pkgCfg.key) || {};
    const title = pkg.title || pkgCfg.title;
    const quoteHours = Number(pkg.quote_hours || pkg.total_points || pkgCfg.quote_hours || 0);
    const price = quoteHours * 4950;

    const card = document.createElement('button');
    card.type = 'button';
    card.className = `packageCard${activeKey === pkgCfg.key ? ' on' : ''}`;
    card.innerHTML = `
      <div class="packageTitleRow">
        <div class="packageTitle">${title}</div>
        <div class="packageHours">${quoteHours} ч</div>
      </div>
      <div class="packagePrice">${fmtRub(price)}</div>
    `;
    card.onclick = () => {
      state.segments = [...pkgCfg.segments];
      state.selectedPackageId = pkgCfg.key;
      const hours = quoteHours;
      const totalRub = hours * 4950;
      console.log('[Aurora] package selected', {
        selectedPackageId: state.selectedPackageId,
        segments: state.segments,
        hours,
        totalRub,
      });
      renderChecklist(update);
      update();
    };
    opts1.appendChild(card);
  });
  sec1.appendChild(opts1);
  checklistMain.appendChild(sec1);

  // Если сегмент ещё не выбран — дальше ничего не показываем.
  if(!(state.segments||[]).length){
    _prevVis = { onec:false, kkt:false, addons:false, devices:false, orgs:false, products:false, scenarios:false, support:false, contacts:false };
    checklistExtra.innerHTML = `<div class="mini" style="padding:2px 2px 0;color:rgba(255,255,255,.55)">Выберите тип клиента слева — здесь появятся доп.факторы.</div>`;
    return;
  }

  // helper: добавить секцию с плавным появлением/исчезновением
  const revealAppend = (sec, key, show, target)=>{
    sec.dataset.sec = key;

    const host = target || checklistMain;

    if(show){
      // Появление
      sec.classList.add('collapsed');
      host.appendChild(sec);
      if(!_prevVis[key]){
        requestAnimationFrame(()=>sec.classList.remove('collapsed'));
      } else {
        sec.classList.remove('collapsed');
      }
      _prevVis[key] = true;
      return;
    }

    // Скрытие (анимация выхода): если секция раньше была видима —
    // покажем её на долю секунды и свернём, потом удалим.
    if(_prevVis[key]){
      host.appendChild(sec);
      // Форсируем reflow, чтобы браузер «увидел» стартовое состояние.
      // Иначе transition может не сработать.
      void sec.offsetHeight;
      sec.classList.add('collapsed');
      setTimeout(()=>{ sec.remove(); }, SECTION_ANIM_MS);
    }
    _prevVis[key] = false;
  };

  // Что именно показывать
  const vis = visibilityFromState();

  // 1.5) Учётная система (1С)
  const secOneC = document.createElement('div');
  secOneC.className='section';
  secOneC.innerHTML = `<div class="secTitle"><h3>Учётная система (1С)</h3><span class="tag">конфигурация</span></div>`;
  const optsOneC = document.createElement('div'); optsOneC.className='opts';

  const cfgs = Array.isArray(DATA.onec_configs) ? DATA.onec_configs : [];
  const items = cfgs.map(c => ({ value: c.id, label: c.name }));

  // Если конфигов нет — показываем объяснение (данные можно добавить через админку).
  const row = document.createElement('div');
  row.className='opt onecCfgRow';
  row.innerHTML = `<div class="label"><div class="t">Конфигурация 1С</div><div class="d">Выбери, что установлено у клиента</div></div>`;
  const right = document.createElement('div');
  // Правая часть строки: выпадашка + переключатель «актуальная».
  // ВАЖНО: делаем wrap, чтобы на узких экранах не «вылезало» за границы.
  right.className = 'optRight';

  if (items.length) {
    if (!items.some(i => i.value === (state.onec?.config))) {
      state.onec.config = items[0].value;
    }
    const dd = mkDropdown({
      items,
      value: state.onec.config,
      onChange: (v)=>{ state.onec.config = v; update(); }
    });
    right.appendChild(dd);
  } else {
    const hint = document.createElement('div');
    hint.className='muted';
    hint.textContent='(список конфигураций не задан — добавим через админку)';
    right.appendChild(hint);
  }

  const btn = document.createElement('button');
  btn.className='pillToggle';
  btn.type='button';
  const paint = ()=>{
    const ok = !!state.onec?.actual;
    btn.textContent = ok ? 'Актуальная' : 'Неактуальная';
    btn.classList.toggle('on', ok);
  };
  paint();
  btn.onclick = ()=>{ state.onec.actual = !state.onec.actual; paint(); update(); };
  right.appendChild(btn);

  row.appendChild(right);
  optsOneC.appendChild(row);
  secOneC.appendChild(optsOneC);
  revealAppend(secOneC, 'onec', vis.onec, checklistMain);

  // 2) ККТ (только для розницы)
  const sec2 = document.createElement('div');
  sec2.className='section';
  sec2.innerHTML = `<div class="secTitle"><h3>ККТ</h3><span class="tag">кассы</span></div>`;
  const box2 = document.createElement('div'); box2.className='opts';
  box2.style.marginTop='10px';

  const types = Array.isArray(KKT_TYPES) && KKT_TYPES.length
    ? KKT_TYPES
    : [{ id: 'other', label: 'Прочие ККТ', prep_hours: 2 }];
  if (!state.kkt) state.kkt = { type: null, count: 0 };
  if (state.kkt.type && !types.some(t => t.id === state.kkt.type)) {
    state.kkt.type = types[0]?.id || 'other';
  }

  const typeRow = document.createElement('div');
  typeRow.className = 'opt kktTypeRow';
  typeRow.innerHTML = `<div class="label"><div class="t">Тип ККТ</div><div class="d">Выберите тип кассы</div></div>`;
  const typeRight = document.createElement('div');
  typeRight.className = 'optRight kktTypeRight';

  const hint = document.createElement('div');
  hint.className = 'kktHint';
  const renderHint = () => {
    const current = types.find(t => t.id === state.kkt.type) || types[0];
    hint.textContent = `Подготовка: +${Number(current?.prep_hours || 2)}ч/кассу`;
  };

  types.forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'pillToggle';
    btn.type = 'button';
    btn.textContent = t.label;
    btn.classList.toggle('on', state.kkt.type === t.id);
    btn.onclick = () => {
      state.kkt.type = t.id;
      Array.from(typeRight.querySelectorAll('.pillToggle')).forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      renderHint();
      update();
    };
    typeRight.appendChild(btn);
  });
  renderHint();
  typeRight.appendChild(hint);
  typeRow.appendChild(typeRight);
  box2.appendChild(typeRow);

  const countRow = document.createElement('div');
  countRow.className = 'opt kktCountRow';
  countRow.innerHTML = `<div class="label"><div class="t">Касс</div><div class="d">Количество</div></div>`;
  const step = document.createElement('div'); step.className = 'stepper';
  const minus = document.createElement('button'); minus.className = 'btnTiny'; minus.type = 'button'; minus.textContent = '−';
  const num = document.createElement('div'); num.className = 'stepNum'; num.textContent = String(state.kkt.count || 0);
  const plus = document.createElement('button'); plus.className = 'btnTiny'; plus.type = 'button'; plus.textContent = '+';
  const refresh = () => { num.textContent = String(state.kkt.count || 0); };
  minus.onclick = () => {
    state.kkt.count = clamp((state.kkt.count || 0) - 1, 0, 99);
    refresh();
    update();
  };
  plus.onclick = () => {
    const prev = Number(state.kkt.count || 0);
    state.kkt.count = clamp(prev + 1, 0, 99);
    const hadType = !!state.kkt.type;
    if (!state.kkt.type) state.kkt.type = types[0]?.id || 'other';
    if (state.kkt.count > prev) {
      const scanners = Number(state.device_scanner || 0);
      if (scanners < state.kkt.count) {
        state.device_scanner = clamp(state.kkt.count, 0, 99);
      }
    }
    if (!hadType) {
      renderChecklist(update);
      update();
      return;
    }
    refresh();
    update();
  };
  step.appendChild(minus); step.appendChild(num); step.appendChild(plus);
  countRow.appendChild(step);
  box2.appendChild(countRow);
  sec2.appendChild(box2);
  revealAppend(sec2, 'kkt', vis.kkt, checklistExtra);

  // 2.5) Доп.работы
  const secAddons = document.createElement('div');
  secAddons.className='section';
  secAddons.innerHTML = `<div class="secTitle"><h3>Доп.работы</h3><span class="tag">опции</span></div>`;
  const optsAddons = document.createElement('div'); optsAddons.className='opts';

  const retailPackageIds = new Set(['retail_only', 'producer_retail']);
  const hasRetailSegment = hasRetail() || retailPackageIds.has(String(state.selectedPackageId || ''));
  const hasKkt = kktCount() > 0;
  const showRegLk = hasRetailSegment;
  const showKktPrepareMarking = hasRetailSegment || hasKkt;
  if (!showRegLk && state.addons?.reg_lk_cz_retail) state.addons.reg_lk_cz_retail = false;
  if (!showKktPrepareMarking && state.addons?.kkt_prepare_marking) state.addons.kkt_prepare_marking = false;

  const addAddon = (key, title, desc, show = true)=>{
    if (!show) return;
    const row = document.createElement('div');
    row.className = 'opt' + (state.addons?.[key] ? ' on' : '');
    row.innerHTML = `<div class="chk"><svg viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="white" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      <div class="label"><div class="t">${title}</div><div class="d">${desc}</div></div>`;
    row.onclick = () => {
      state.addons[key] = !state.addons[key];
      renderChecklist(update);
      update();
    };
    optsAddons.appendChild(row);
  };

  addAddon('reg_lk_cz_retail', 'Рега в ЛК ЧЗ (розница)', '+1 час', showRegLk);
  addAddon('integration_to_accounting', 'Интеграция с товароучёткой', '+3 часа', true);
  addAddon('kkt_prepare_marking', 'Подготовка кассового оборудования для работы с маркировкой', '+3 часа', showKktPrepareMarking);

  secAddons.appendChild(optsAddons);
  revealAppend(secAddons, 'addons', (state.segments || []).length > 0, checklistExtra);

  // 3) Устройства (сканеры/ТСД)
  const secDev = document.createElement('div');
  secDev.className='section';
  secDev.innerHTML = `<div class="secTitle"><h3>Устройства</h3><span class="tag">счётчики</span></div>`;
  const optsDev = document.createElement('div'); optsDev.className='opts';

  const mkStepper = (title, getV, setV)=>{
    const wrap = document.createElement('div'); wrap.className='opt';
    wrap.innerHTML = `<div class="label"><div class="t">${title}</div><div class="d">Количество</div></div>`;
    const step = document.createElement('div'); step.className='stepper';
    const minus = document.createElement('button'); minus.className='btnTiny'; minus.type='button'; minus.textContent='−';
    const num = document.createElement('div'); num.className='stepNum'; num.textContent=String(getV());
    const plus = document.createElement('button'); plus.className='btnTiny'; plus.type='button'; plus.textContent='+';
    const refresh = ()=>{ num.textContent = String(getV()); };
    minus.onclick=()=>{ setV(getV()-1); refresh(); update(); };
    plus.onclick=()=>{ setV(getV()+1); refresh(); update(); };
    step.appendChild(minus); step.appendChild(num); step.appendChild(plus);
    wrap.appendChild(step);
    return wrap;
  };

  optsDev.appendChild(mkStepper('Сканеры (доп.)', ()=>Number(state.device_scanner||0), v=>{ state.device_scanner = clamp(v,0,99);}));
  optsDev.appendChild(mkStepper('ТСД (доп.)', ()=>Number(state.device_tsd||0), v=>{
    state.device_tsd = clamp(v,0,99);
    // Отображение мини-плана Клеверенса и доп.опций зависит от кол-ва ТСД,
    // поэтому при изменении сразу перерисовываем чек-лист.
    if (Number(state.device_tsd||0) <= 0) state.tsd_collective = false;
    renderChecklist(update);
    update();
  }));

  // коллективная работа для Клеверенса — показываем только когда есть ТСД.
  // Иначе пользователь тыкает «галку», а сумма не меняется (потому что ТСД=0).
  if (Number(state.device_tsd || 0) > 0) {
    const cl = document.createElement('div');
    cl.className='opt' + (state.tsd_collective ? ' on' : '');
    cl.innerHTML = `<div class="chk"><svg viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="white" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      <div class="label"><div class="t">Клеверенс: коллективная работа</div><div class="d">+25 000 ₽ × кол-во ТСД</div></div>`;
    cl.onclick=()=>{ state.tsd_collective = !state.tsd_collective; renderChecklist(update); update(); };
    optsDev.appendChild(cl);

    // Мини-планы Клеверенса (информационно)
    const plans = Array.isArray(DATA.cleverence_plans) ? DATA.cleverence_plans : [];
    if (plans.length) {
      // Подготовим опции для выпадашки
      const items = plans.map(p => ({ value: p.id, label: p.name }));
      // Если в state лежит неизвестное значение — нормализуем
      if (!items.some(i => i.value === state.cleverence_plan)) state.cleverence_plan = items[0].value;

      const planRow = document.createElement('div');
      planRow.className='opt';
      planRow.innerHTML = `<div class="label"><div class="t">План Клеверенса</div><div class="d">Что входит (подсказка)
      </div></div>`;

      const right = document.createElement('div');
      right.style.display='flex';
      right.style.gap='8px';
      right.style.alignItems='center';

      const dd = mkDropdown({
        items,
        value: state.cleverence_plan,
        onChange: (v)=>{ state.cleverence_plan = v; update(); }
      });

      const info = document.createElement('button');
      info.className='iconBtn';
      info.type='button';
      info.textContent='i';
      info.title='Посмотреть, что входит'
      info.onclick = () => {
        const selected = plans.find(p => p.id === state.cleverence_plan) || plans[0];
        openInfoModal(selected.name, { desc: selected.desc || '', items: selected.includes || [] });
      };

      // На ПК показываем состав плана при наведении.
      attachPopover(info, () => {
        const selected = plans.find(p => p.id === state.cleverence_plan) || plans[0];
        return {
          title: selected.name,
          desc: selected.desc || '',
          items: selected.includes || [],
        };
      });

      right.appendChild(dd);
      right.appendChild(info);
      planRow.appendChild(right);
      optsDev.appendChild(planRow);
    }
  } else {
    state.tsd_collective = false;
  }

  secDev.appendChild(optsDev);
  revealAppend(secDev, 'devices', vis.devices, checklistExtra);

  // 4) Юрлица (показываем в ветках, где это нужно)
  const secWh = document.createElement('div');
  secWh.className='section';
  secWh.innerHTML = `<div class="secTitle"><h3>Юрлица</h3><span class="tag">кол-во</span></div>`;
  const optsWh = document.createElement('div'); optsWh.className='opts';

  const chkOrg = document.createElement('div');
  chkOrg.className = 'opt' + (state.multi_orgs ? ' on' : '');
  chkOrg.innerHTML = `<div class="chk"><svg viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="white" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
    <div class="label"><div class="t">Несколько юрлиц</div><div class="d">Появится счётчик</div></div>`;
  chkOrg.onclick=()=>{ state.multi_orgs = !state.multi_orgs; if(!state.multi_orgs) state.org_count = 1; renderChecklist(update); update(); };
  optsWh.appendChild(chkOrg);

  if(state.multi_orgs){
    const row = document.createElement('div');
    row.className='opt';
    row.innerHTML = `<div class="label"><div class="t">Количество юрлиц</div><div class="d">1..99</div></div>`;
    const step = document.createElement('div'); step.className='stepper';
    const minus = document.createElement('button'); minus.className='btnTiny'; minus.type='button'; minus.textContent='−'; minus.id='orgMinus';
    const num = document.createElement('div'); num.className='stepNum'; num.textContent=String(state.org_count||1); num.id='orgNum';
    const plus = document.createElement('button'); plus.className='btnTiny'; plus.type='button'; plus.textContent='+'; plus.id='orgPlus';
    minus.onclick=()=>{ state.org_count = clamp((state.org_count||1)-1,1,99); num.textContent=String(state.org_count); update(); };
    plus.onclick=()=>{ state.org_count = clamp((state.org_count||1)+1,1,99); num.textContent=String(state.org_count); update(); };
    step.appendChild(minus); step.appendChild(num); step.appendChild(plus);
    row.appendChild(step);
    optsWh.appendChild(row);
  }
  secWh.appendChild(optsWh);
  revealAppend(secWh, 'orgs', vis.orgs, checklistMain);

  // 5) Продукция (только производитель)
  const secProd = document.createElement('div');
  secProd.className='section';
  secProd.innerHTML = `<div class="secTitle"><h3>Продукция (ЧЗ)</h3><span class="tag">категории</span></div>`;
  const optsProd = document.createElement('div'); optsProd.className='opts';

  // В старом варианте был «полотном» из чекбоксов.
  // Чтобы было удобно, делаем:
  //   1) поиск,
  //   2) выбранные категории показываем «чипами» сверху,
  //   3) список — в 2 колонки и ограничиваем по количеству.

  const cats = Array.isArray(state.product.categories) ? state.product.categories : (state.product.categories = []);

  // Чипы выбранных категорий
  const chips = document.createElement('div');
  chips.className = 'chips';
  cats.forEach(name => {
    const ch = document.createElement('div');
    ch.className = 'chip';
    ch.textContent = name;
    const x = document.createElement('div');
    x.className = 'chipX';
    x.textContent = '×';
    x.title = 'Убрать';
    x.onclick = (e) => {
      e.stopPropagation();
      const i = cats.indexOf(name);
      if (i >= 0) cats.splice(i, 1);
      renderChecklist(update);
      update();
    };
    ch.appendChild(x);
    chips.appendChild(ch);
  });
  if (cats.length) optsProd.appendChild(chips);

  // Поиск
  const sRow = document.createElement('div');
  sRow.className = 'prodSearch';
  const sInp = document.createElement('input');
  sInp.type = 'text';
  sInp.placeholder = 'Поиск категории (например: обувь, парфюм...)';
  sInp.value = state.product.search || '';
  sInp.oninput = () => { state.product.search = sInp.value; renderChecklist(update); };
  sRow.appendChild(sInp);
  optsProd.appendChild(sRow);

  const listProd = document.createElement('div');
  listProd.className = 'prodList';

  const q = (state.product.search || '').trim().toLowerCase();
  const filtered = CZ_GROUPS.filter(n => !q || String(n).toLowerCase().includes(q));
  const LIMIT = 60;
  filtered.slice(0, LIMIT).forEach(name => {
    const row = document.createElement('div');
    const on = cats.includes(name);
    row.className = 'opt' + (on ? ' on' : '');
    row.innerHTML = `<div class="chk"><svg viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="white" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      <div class="label"><div class="t">${name}</div><div class="d">Товарная группа</div></div>`;
    row.onclick = () => {
      const idx = cats.indexOf(name);
      if (idx >= 0) cats.splice(idx, 1);
      else cats.push(name);
      renderChecklist(update);
      update();
    };
    listProd.appendChild(row);
  });

  if (filtered.length > LIMIT) {
    const hint = document.createElement('div');
    hint.className = 'muted';
    hint.style.marginTop = '8px';
    hint.textContent = `Показаны первые ${LIMIT} из ${filtered.length}. Уточни поиск.`;
    optsProd.appendChild(hint);
  }

  optsProd.appendChild(listProd);

  // Комментарий
  const comm = document.createElement('div');
  comm.className='opt';
  comm.innerHTML = `<div class="label"><div class="t">Комментарий по продукции</div><div class="d">GTIN/бренды/упаковки и т.д.</div></div>`;
  // ВАЖНО: переменные внутри renderChecklist должны иметь уникальные имена.
  // Иначе будет ошибка "Identifier has already been declared" и весь интерфейс не загрузится.
  const taProd = document.createElement('textarea');
  taProd.className='ta';
  taProd.placeholder='Например: 3 бренда, 120 SKU, печать этикеток на термопринтере...';
  taProd.value = state.product.comment || '';
  taProd.oninput=()=>{ state.product.comment = taProd.value; update(); };
  comm.appendChild(taProd);
  optsProd.appendChild(comm);

  secProd.appendChild(optsProd);
  revealAppend(secProd, 'products', vis.products, checklistMain);

  // 6) Сценарии
  const sec4 = document.createElement('div');
  sec4.className='section';
  sec4.innerHTML = `<div class="secTitle"><h3>Сценарии</h3><span class="tag">галочки</span></div>`;
  const opts4 = document.createElement('div'); opts4.className='opts';

  const mkOpt = (flag, title, desc, isVisible=true)=>{
    if(!isVisible) return;
    const row = document.createElement('div');
    row.className = 'opt' + (state[flag] ? ' on' : '');
    row.innerHTML = `<div class="chk"><svg viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="white" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      <div class="label"><div class="t">${title}</div><div class="d">${desc}</div></div>`;
    row.onclick=()=>{ state[flag] = !state[flag]; renderChecklist(update); update(); };
    opts4.appendChild(row);
  };

  mkOpt('has_edo','ЭДО подключено','если нет — добавим сложность (только опт/производство)');
  mkOpt('needs_rework','Остатки/перемаркировка/вывод','доп.работы');
  // Агрегация — только для опта/производителя (по твоему правилу)
  mkOpt('needs_aggregation','Агрегация/КИТУ','только опт/производство', vis.wholesaleAgg);
  mkOpt('big_volume','Большие объёмы','много документов/автоматизация');
  mkOpt('producer_codes','Заказ/нанесение кодов','только производитель/импортёр', vis.products);
  mkOpt('custom_integration','Нестандарт/интеграции','маркер проекта (уводим на пресейл)');

  sec4.appendChild(opts4);
  revealAppend(sec4, 'scenarios', vis.scenarios, checklistExtra);

  // 7) Поддержка
  const secSup = document.createElement('div');
  secSup.className='section';
  secSup.innerHTML = `<div class="secTitle"><h3>Поддержка</h3><span class="tag">опция</span></div>`;
  const optsSup = document.createElement('div'); optsSup.className='opts';
  const rowSup = document.createElement('div');
  rowSup.className='opt' + (state.support ? ' on' : '');
  rowSup.innerHTML = `<div class="chk"><svg viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="white" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
    <div class="label"><div class="t">${DATA.support_label || 'Поддержка'}</div><div class="d">+${DATA.support_points || 0} баллов</div></div>`;
  rowSup.onclick=()=>{ state.support=!state.support; renderChecklist(update); update(); };
  optsSup.appendChild(rowSup);
  secSup.appendChild(optsSup);
  revealAppend(secSup, 'support', vis.support, checklistExtra);

  // 8) Данные + цель
  const sec7 = document.createElement('div');
  sec7.className='section';
  sec7.innerHTML = `<div class="secTitle"><h3>Данные и цель</h3><span class="tag">контакты</span></div>`;
  // Контакты рисуем в том же формате, что и остальные пункты (строка-«карточка» + поле справа).
  // Чтобы поля не были «белыми системными», для них есть стили .opt .inp / .opt .ta в styles.css.
  const opts7 = document.createElement('div');
  opts7.className = 'opts';

  const mkInputRow = (key, title, ph='') => {
    const row = document.createElement('div');
    row.className = 'opt';
    row.innerHTML = `<div class="label"><div class="t">${title}</div><div class="d"></div></div>`;
    const inp = document.createElement('input');
    inp.className = 'inp';
    inp.placeholder = ph;
    inp.value = state.contacts[key] || '';
    inp.oninput = () => { state.contacts[key] = inp.value; update(); };
    row.appendChild(inp);
    return row;
  };

  opts7.appendChild(mkInputRow('legal_name','Юрлицо (название)','ООО Ромашка'));
  opts7.appendChild(mkInputRow('inn','ИНН','1234567890'));
  opts7.appendChild(mkInputRow('contact_name','Контактное лицо','Иван'));
  opts7.appendChild(mkInputRow('phone','Телефон','+7...'));
  opts7.appendChild(mkInputRow('email','Email','mail@...'));

  const des = document.createElement('div');
  des.className = 'opt';
  des.innerHTML = `<div class="label"><div class="t">Желаемый результат</div><div class="d">что хотим получить на выходе</div></div>`;
  const taDesired = document.createElement('textarea');
  taDesired.className = 'ta';
  taDesired.placeholder = 'Например: запустить продажу маркировки на 2 кассах + приемка по ЭДО';
  taDesired.value = state.contacts.desired_result || '';
  taDesired.oninput = () => { state.contacts.desired_result = taDesired.value; update(); };
  des.appendChild(taDesired);
  opts7.appendChild(des);

  sec7.appendChild(opts7);
  revealAppend(sec7, 'contacts', vis.contacts, checklistMain);
}
