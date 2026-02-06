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
import { SECTION_ANIM_MS, visibilityFromState } from '../visibility.js';
import { clamp, fmtRub } from '../helpers.js';
import { applyPackagePreset, getPackagePresetTotals, syncAutoServiceQuantities } from '../services.js';

// Чтобы блоки “появлялись/убирались” анимацией, но при этом чекбоксы
// реагировали МГНОВЕННО (без задержек после клика).
//
// Раньше мы ждали SECTION_ANIM_MS перед перерисовкой — из-за этого
// галочка ставилась через ~1 сек и казалось, что сайт лагает.
// Теперь: перерисовываем сразу, а для скрываемых секций делаем
// «анимацию выхода» (см. revealAppend ниже).
let _prevVis = { equipment:false, custom:false };

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
    { key: 'producer_only', title: 'Только производитель/импортер', segments: ['Производитель/Импортёр'], quote_hours: 12 },
    { key: 'producer_retail', title: 'Производитель + розница', segments: ['Производитель/Импортёр', 'Розница'], quote_hours: 18 },
  ];

  let activeKey = state.selectedPackageId || '';

  // Пакет «Производитель + розница» оставляем в данных/расчётах,
  // но скрываем из UI. Если такой пакет был выбран ранее (например,
  // восстановлен извне/из storage), переводим пользователя на
  // «Только производитель/импортёр», чтобы не было невидимого выбора.
  if (activeKey === 'producer_retail') {
    const producerOnly = packages.find(pkg => pkg.key === 'producer_only');
    state.segments = [...(producerOnly?.segments || ['Производитель/Импортёр'])];
    applyPackagePreset('producer_only');
    activeKey = state.selectedPackageId || 'producer_only';
  }

  const visiblePackages = packages.filter(pkgCfg => pkgCfg.key !== 'producer_retail');

  visiblePackages.forEach(pkgCfg => {
    const pkg = pkgByKey(pkgCfg.key) || {};
    const title = pkg.title || pkgCfg.title;
    const presetTotals = getPackagePresetTotals(pkgCfg.key, state.servicesDetailed);
    const quoteHours = Number(presetTotals.totalHours || 0);
    const price = Number(presetTotals.totalRub || 0);

    const card = document.createElement('button');
    card.type = 'button';
    card.className = `packageCard${activeKey === pkgCfg.key ? ' on' : ''}${pkgCfg.key === 'producer_only' ? ' packageCard--wide' : ''}`;
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

  const secComment = document.createElement('div');
  secComment.className = 'section';
  secComment.innerHTML = `<div class="secTitle"><h3>Комментарий</h3></div>`;
  const commentOpts = document.createElement('div');
  commentOpts.className = 'opts';
  const commentRow = document.createElement('div');
  commentRow.className = 'opt';
  const taComment = document.createElement('textarea');
  taComment.className = 'ta';
  taComment.rows = 5;
  taComment.placeholder = 'Например: 3 бренда, 120 SKU, печать этикеток, особенности учета...';
  taComment.value = state.comment || '';
  taComment.oninput = () => {
    state.comment = taComment.value;
    try {
      localStorage.setItem('manager_v5_comment', state.comment);
    } catch (e) {
      // ignore
    }
    update();
  };
  commentRow.appendChild(taComment);
  commentOpts.appendChild(commentRow);
  secComment.appendChild(commentOpts);
  checklistMain.appendChild(secComment);

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

  // 2) Оборудование (ККТ + сканеры)
  const sec2 = document.createElement('div');
  sec2.className='section';
  sec2.innerHTML = `<div class="secTitle"><h3>Оборудование</h3><span class="tag">счётчики</span></div>`;
  const box2 = document.createElement('div'); box2.className='opts';
  box2.style.marginTop='10px';

  if (!state.kkt) state.kkt = { regularCount: 0, smartCount: 0, otherCount: 0 };
  if (!state.equipment) state.equipment = { scannersCount: 0, printersCount: 0 };

  const card = document.createElement('div');
  card.className = 'kktCard';

  const totalKkt = () => Number(state.kkt?.regularCount || 0) + Number(state.kkt?.smartCount || 0) + Number(state.kkt?.otherCount || 0);
  const syncScannersWithKkt = () => {
    if (!state.scannersAuto) return;
    state.equipment.scannersCount = clamp(totalKkt(), 0, 99);
  };

  const kktTypes = [
    {
      key: 'regularCount',
      title: 'ККТ (Атол/Штрих/…)',
      note: '',
      prepHours: 2,
      tooltip: 'классическая касса + фискальник',
    },
    {
      key: 'smartCount',
      title: 'Смарт-терминал (Эвотор/Aqsi/…)',
      note: '',
      prepHours: 3,
      tooltip: 'Эвотор/Сигма/MS POS и т.п.',
    },
    {
      key: 'otherCount',
      title: 'Другая ККТ',
      note: '',
      prepHours: 2,
      tooltip: 'Штрих и т.п.',
    },
  ];

  kktTypes.forEach((type) => {
      const row = document.createElement('div');
      row.className = 'kktCardRow kktCountRow';

      const label = document.createElement('div');
      label.className = 'kktRowLabel';
      const title = document.createElement('div');
      title.className = 'kktRowTitle';
      title.textContent = type.title;
      title.title = type.tooltip;
      label.appendChild(title);

      const right = document.createElement('div');
      right.className = 'kktRowContent';
      const step = document.createElement('div'); step.className = 'stepper';
      const minus = document.createElement('button'); minus.className = 'btnTiny'; minus.type = 'button'; minus.textContent = '−';
      const num = document.createElement('div'); num.className = 'stepNum'; num.textContent = String(state.kkt?.[type.key] || 0);
      const plus = document.createElement('button'); plus.className = 'btnTiny'; plus.type = 'button'; plus.textContent = '+';
      const refresh = () => { num.textContent = String(state.kkt?.[type.key] || 0); };
      minus.onclick = () => {
        state.kkt[type.key] = clamp((state.kkt[type.key] || 0) - 1, 0, 99);
        refresh();
        syncScannersWithKkt();
        syncAutoServiceQuantities();
        update();
      };
      plus.onclick = () => {
        state.kkt[type.key] = clamp((state.kkt[type.key] || 0) + 1, 0, 99);
        refresh();
        syncScannersWithKkt();
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

  {
    const scannerRow = document.createElement('div');
    scannerRow.className = 'opt';
    scannerRow.innerHTML = `<div class="label"><div class="t">Сканеры (Количество)</div></div>`;
    const scannerStep = document.createElement('div'); scannerStep.className = 'stepper';
    const scannerMinus = document.createElement('button'); scannerMinus.className = 'btnTiny'; scannerMinus.type = 'button'; scannerMinus.textContent = '−';
    const scannerNum = document.createElement('div'); scannerNum.className = 'stepNum'; scannerNum.textContent = String(state.equipment?.scannersCount || 0);
    const scannerPlus = document.createElement('button'); scannerPlus.className = 'btnTiny'; scannerPlus.type = 'button'; scannerPlus.textContent = '+';
    const refreshScanner = () => { scannerNum.textContent = String(state.equipment?.scannersCount || 0); };
    scannerMinus.onclick = () => {
      state.equipment.scannersCount = clamp((state.equipment?.scannersCount || 0) - 1, 0, 99);
      state.scannersAuto = false;
      refreshScanner();
      syncAutoServiceQuantities();
      update();
    };
    scannerPlus.onclick = () => {
      state.equipment.scannersCount = clamp((state.equipment?.scannersCount || 0) + 1, 0, 99);
      state.scannersAuto = false;
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

  {
    const printerRow = document.createElement('div');
    printerRow.className = 'opt';
    printerRow.innerHTML = `<div class="label"><div class="t">Принтеры (Количество)</div></div>`;
    const printerStep = document.createElement('div'); printerStep.className = 'stepper';
    const printerMinus = document.createElement('button'); printerMinus.className = 'btnTiny'; printerMinus.type = 'button'; printerMinus.textContent = '−';
    const printerNum = document.createElement('div'); printerNum.className = 'stepNum'; printerNum.textContent = String(state.equipment?.printersCount || 0);
    const printerPlus = document.createElement('button'); printerPlus.className = 'btnTiny'; printerPlus.type = 'button'; printerPlus.textContent = '+';
    const refreshPrinter = () => { printerNum.textContent = String(state.equipment?.printersCount || 0); };
    printerMinus.onclick = () => {
      state.equipment.printersCount = clamp((state.equipment?.printersCount || 0) - 1, 0, 99);
      refreshPrinter();
      syncAutoServiceQuantities();
      update();
    };
    printerPlus.onclick = () => {
      state.equipment.printersCount = clamp((state.equipment?.printersCount || 0) + 1, 0, 99);
      refreshPrinter();
      syncAutoServiceQuantities();
      update();
    };
    printerStep.appendChild(printerMinus);
    printerStep.appendChild(printerNum);
    printerStep.appendChild(printerPlus);
    printerRow.appendChild(printerStep);
    box2.appendChild(printerRow);
  }

  sec2.appendChild(box2);
  revealAppend(sec2, 'equipment', vis.equipment, checklistExtra);

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


}
