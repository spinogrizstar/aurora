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
import { CZ_GROUPS } from '../catalogs.js';
import { SECTION_ANIM_MS, visibilityFromState } from '../visibility.js';
import { clamp, fmtRub } from '../helpers.js';
import { mkDropdown } from '../components/dropdown.js';
import { applyPackagePreset, getPackagePresetTotals, isEquipmentAvailable, isKktAvailable, isScannerAvailable, syncAutoServiceQuantities } from '../services.js';

// Чтобы блоки “появлялись/убирались” анимацией, но при этом чекбоксы
// реагировали МГНОВЕННО (без задержек после клика).
//
// Раньше мы ждали SECTION_ANIM_MS перед перерисовкой — из-за этого
// галочка ставилась через ~1 сек и казалось, что сайт лагает.
// Теперь: перерисовываем сразу, а для скрываемых секций делаем
// «анимацию выхода» (см. revealAppend ниже).
let _prevVis = { onec:false, equipment:false, products:false, contacts:false, custom:false };

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

  if (DATA?.__matrixError) {
    const err = document.createElement('div');
    err.className = 'alert red';
    err.style.display = 'block';
    err.innerHTML = `<b>Матрица услуг не загрузилась</b><div class="small" style="margin-top:8px;">${DATA.__matrixError}</div>`;
    checklistMain.appendChild(err);
  }

  const getTotalKktCount = () => {
    const regular = Number(state.kkt?.regularCount || 0);
    const smart = Number(state.kkt?.smartCount || 0);
    const other = Number(state.kkt?.otherCount || 0);
    return regular + smart + other;
  };

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
    const presetTotals = getPackagePresetTotals(pkgCfg.key, state.servicesDetailed);
    const quoteHours = Number(presetTotals.totalHours || 0);
    const price = Number(presetTotals.totalRub || 0);

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
      applyPackagePreset(pkgCfg.key);
      const hours = quoteHours;
      const totalRub = price;
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
    _prevVis = { onec:false, equipment:false, products:false, contacts:false, custom:false };
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
  const equipmentAllowed = isEquipmentAvailable(state.selectedPackageId);
  const kktAllowed = isKktAvailable(state.selectedPackageId);
  const scannerAllowed = isScannerAvailable(state.selectedPackageId);

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

  // 2) Оборудование (ККТ + сканеры)
  const sec2 = document.createElement('div');
  sec2.className='section';
  sec2.innerHTML = `<div class="secTitle"><h3>Оборудование</h3><span class="tag">счётчики</span></div>`;
  const box2 = document.createElement('div'); box2.className='opts';
  box2.style.marginTop='10px';

  if (!state.kkt) state.kkt = { regularCount: 0, smartCount: 0, otherCount: 0 };
  if (!state.equipment) state.equipment = { scannersCount: 0 };

  const card = document.createElement('div');
  card.className = 'kktCard';

  const kktTypes = [
    {
      key: 'regularCount',
      title: 'Обычная касса (ФР/ККТ)',
      note: 'Фактор для авто‑qty услуг',
      prepHours: 2,
      tooltip: 'ФР/обычная ККТ на ПК (драйвер/ФР). Подготовка обычно 2 часа.',
    },
    {
      key: 'smartCount',
      title: 'Смарт-терминал',
      note: 'Фактор для авто‑qty услуг',
      prepHours: 3,
      tooltip: 'Эвотор/Сигма/MS POS и аналоги. Подготовка обычно 3 часа.',
    },
    {
      key: 'otherCount',
      title: 'Другая касса',
      note: 'Фактор для авто‑qty услуг',
      prepHours: 2,
      tooltip: 'Штрих и прочие. Если нестандарт — отмечайте «Нестандарт/интеграции».',
    },
  ];

  const ensureScannerMin = (prevTotal, nextTotal) => {
    if (nextTotal > prevTotal && !state.scannersManuallySet) {
      const scanners = Number(state.equipment?.scannersCount || 0);
      state.equipment.scannersCount = clamp(Math.max(scanners, nextTotal), 0, 99);
    }
  };

  if (kktAllowed) {
    kktTypes.forEach((type) => {
      const row = document.createElement('div');
      row.className = 'kktCardRow kktCountRow';

      const label = document.createElement('div');
      label.className = 'kktRowLabel';
      const title = document.createElement('div');
      title.className = 'kktRowTitle';
      title.textContent = type.title;
      title.title = type.tooltip;
      const note = document.createElement('div');
      note.className = 'kktRowNote';
      note.textContent = type.note;
      label.appendChild(title);
      label.appendChild(note);

      const right = document.createElement('div');
      right.className = 'kktRowContent';
      const step = document.createElement('div'); step.className = 'stepper';
      const minus = document.createElement('button'); minus.className = 'btnTiny'; minus.type = 'button'; minus.textContent = '−';
      const num = document.createElement('div'); num.className = 'stepNum'; num.textContent = String(state.kkt?.[type.key] || 0);
      const plus = document.createElement('button'); plus.className = 'btnTiny'; plus.type = 'button'; plus.textContent = '+';
      const refresh = () => { num.textContent = String(state.kkt?.[type.key] || 0); };
      minus.onclick = () => {
        const prevTotal = getTotalKktCount();
        state.kkt[type.key] = clamp((state.kkt[type.key] || 0) - 1, 0, 99);
        refresh();
        ensureScannerMin(prevTotal, getTotalKktCount());
        syncAutoServiceQuantities();
        update();
      };
      plus.onclick = () => {
        const prevTotal = getTotalKktCount();
        state.kkt[type.key] = clamp((state.kkt[type.key] || 0) + 1, 0, 99);
        refresh();
        ensureScannerMin(prevTotal, getTotalKktCount());
        syncAutoServiceQuantities();
        update();
      };
      step.appendChild(minus); step.appendChild(num); step.appendChild(plus);
      right.appendChild(step);
      row.appendChild(label);
      row.appendChild(right);
      card.appendChild(row);
    });

    box2.appendChild(card);
  }

  if (scannerAllowed || state.equipmentEnabled) {
    const scannerRow = document.createElement('div');
    scannerRow.className = 'opt';
    scannerRow.innerHTML = `<div class="label"><div class="t">Сканеры</div><div class="d">Количество (может быть меньше касс)</div></div>`;
    const scannerStep = document.createElement('div'); scannerStep.className = 'stepper';
    const scannerMinus = document.createElement('button'); scannerMinus.className = 'btnTiny'; scannerMinus.type = 'button'; scannerMinus.textContent = '−';
    const scannerNum = document.createElement('div'); scannerNum.className = 'stepNum'; scannerNum.textContent = String(state.equipment?.scannersCount || 0);
    const scannerPlus = document.createElement('button'); scannerPlus.className = 'btnTiny'; scannerPlus.type = 'button'; scannerPlus.textContent = '+';
    const refreshScanner = () => { scannerNum.textContent = String(state.equipment?.scannersCount || 0); };
    scannerMinus.onclick = () => {
      state.scannersManuallySet = true;
      state.equipment.scannersCount = clamp((state.equipment?.scannersCount || 0) - 1, 0, 99);
      refreshScanner();
      syncAutoServiceQuantities();
      update();
    };
    scannerPlus.onclick = () => {
      state.scannersManuallySet = true;
      state.equipment.scannersCount = clamp((state.equipment?.scannersCount || 0) + 1, 0, 99);
      refreshScanner();
      syncAutoServiceQuantities();
      update();
    };
    scannerStep.appendChild(scannerMinus);
    scannerStep.appendChild(scannerNum);
    scannerStep.appendChild(scannerPlus);
    scannerRow.appendChild(scannerStep);
    box2.appendChild(scannerRow);
  }

  sec2.appendChild(box2);
  revealAppend(sec2, 'equipment', vis.equipment, checklistExtra);

  const toggleEquipment = document.createElement('div');
  toggleEquipment.className = 'section';
  toggleEquipment.innerHTML = `<div class="secTitle"><h3>Оборудование</h3><span class="tag">опционально</span></div>`;
  const toggleBox = document.createElement('div');
  toggleBox.className = 'opts';
  const toggleRow = document.createElement('div');
  toggleRow.className = 'opt';
  toggleRow.innerHTML = `<div class="label"><div class="t">Показать оборудование (если есть)</div><div class="d">Для опта/производителя по умолчанию скрыто</div></div>`;
  const toggleRight = document.createElement('div');
  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'pillToggle';
  const paintToggle = () => {
    toggleBtn.textContent = state.equipmentEnabled ? 'Включено' : 'Выключено';
    toggleBtn.classList.toggle('on', !!state.equipmentEnabled);
  };
  paintToggle();
  toggleBtn.onclick = () => {
    state.equipmentEnabled = !state.equipmentEnabled;
    if (!state.equipmentEnabled && !equipmentAllowed) {
      state.kkt = { regularCount: 0, smartCount: 0, otherCount: 0 };
      state.equipment.scannersCount = 0;
      state.scannersManuallySet = false;
    }
    syncAutoServiceQuantities();
    renderChecklist(update);
    update();
  };
  toggleRight.appendChild(toggleBtn);
  toggleRow.appendChild(toggleRight);
  toggleBox.appendChild(toggleRow);
  toggleEquipment.appendChild(toggleBox);
  const showEquipToggle = (state.segments || []).length && !equipmentAllowed && !state.equipmentEnabled;
  revealAppend(toggleEquipment, 'equipmentToggle', showEquipToggle, checklistExtra);

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

  // 6) Нестандарт/интеграции (маркер пресейла)
  const secCustom = document.createElement('div');
  secCustom.className='section';
  secCustom.innerHTML = `<div class="secTitle"><h3>Нестандарт/интеграции</h3><span class="tag">маркер</span></div>
    <div class="mini markerNote">Маркер проекта (не влияет на итоговую стоимость).</div>`;
  const optsCustom = document.createElement('div'); optsCustom.className='opts';
  const rowCustom = document.createElement('div');
  rowCustom.className = 'opt' + (state.custom_integration ? ' on' : '');
  rowCustom.innerHTML = `<div class="chk"><svg viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="white" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
    <div class="label"><div class="t">Нестандарт/интеграции</div><div class="d">маркер проекта (без влияния на часы)</div></div>`;
  rowCustom.onclick=()=>{ state.custom_integration = !state.custom_integration; renderChecklist(update); update(); };
  optsCustom.appendChild(rowCustom);
  secCustom.appendChild(optsCustom);
  revealAppend(secCustom, 'custom', vis.custom, checklistExtra);

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
