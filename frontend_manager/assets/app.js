// ФАЙЛ: frontend/assets/app.js
// ------------------------------------------------------------
// ТОЧКА ВХОДА ДЛЯ БРАУЗЕРА.
//
// Здесь только «склейка»:
//   1) грузим data.json
//   2) рисуем чек‑лист
//   3) считаем и обновляем правую панель
//
// Если ты хочешь править логику:
//   - Чек‑лист (что показываем и как выглядит) -> ui/checklist.js
//   - Расчёт (баллы/рубли/лицензии) -> calc.js
//   - Правая панель (вывод результатов) -> ui/summary.js
//   - Текст КП/пресейл -> presale.js
// ------------------------------------------------------------

import { loadData } from './data.js';
import { renderChecklist } from './ui/checklist.js';
import { update } from './update.js';
import { wirePresaleButtons } from './presale.js';
import { initDropdownGlobalClose } from './components/dropdown.js';
import { initInfoModal } from './components/info_modal.js';
import { initServiceGraphModal } from './ui/service_graph.js';
import { el } from './dom.js';
import { validatePackagePresets } from './services.js';

async function init() {
  window.__AURORA_APP_BOOTED = true;

  // 1) Данные
  await loadData();
  validatePackagePresets();

  // 2) Глобальные «мелочи»
  initDropdownGlobalClose();
  initInfoModal();
  initServiceGraphModal();
  wirePresaleButtons();
  applyManagerLayout();

  // 3) Рендер + первый расчёт
  renderChecklist(update);
  await update();
  window.__AURORA_APP_UPDATE = update;
  window.__AURORA_APP_READY = true;
}

function applyManagerLayout() {
  document.body.classList.add('managerSlim');

  const hide = (node) => {
    if (node) node.style.display = 'none';
  };

  hide(el.presaleBtn);
  hide(el.wordBtn);
  hide(el.matrixBtn);
  hide(el.whyBtn);
  hide(el.diagBanner);

  hide(el.pkgDetailed?.closest('.card'));
  hide(document.getElementById('sumBase')?.closest('.card'));
}

function escapeHtml(s){
  return String(s)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#39;');
}

// ВАЖНО:
// Если где-то в модулях/данных ошибка, раньше страница могла выглядеть
// «пустой» (чек-лист не рисуется). Чтобы это было понятно даже человеку
// без опыта — показываем явное сообщение прямо на странице.
init().catch((err)=>{
  console.error('[Aurora] init failed:', err);
  const boxes = [document.getElementById('checklistMain'), document.getElementById('checklistExtra')].filter(Boolean);
  if(!boxes.length) return;
  const html = `
    <div class="alert red" style="display:block">
      <b>Ошибка загрузки интерфейса</b>
      <div class="small" style="margin-top:8px;white-space:pre-wrap;">${escapeHtml(err?.message || err)}</div>
      <div class="small" style="margin-top:10px;opacity:.9;">
        Быстрая проверка: открой <b>frontend_manager/data/data.json</b> — файл должен открываться.
        Если он не открывается, значит проект распакован не полностью или не в ту папку.
      </div>
    </div>
  `;
  boxes.forEach(b=>b.innerHTML = html);
});
