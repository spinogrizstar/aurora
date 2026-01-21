// ФАЙЛ: frontend/assets/components/popover.js
// ------------------------------------------------------------
// Мини‑поповер (всплывающая подсказка) для десктопа.
//
// ЗАЧЕМ:
//   - показать «что входит» прямо при наведении (без клика)
//   - при этом на мобильных остаётся клик по кнопке "i" (там hover нет)
//
// КАК ЭТО РАБОТАЕТ:
//   attachPopover(btn, getPayload)
//     - на mouseenter показывает поповер рядом с кнопкой
//     - на mouseleave прячет (с небольшой задержкой, чтобы можно было
//       навести курсор на сам поповер)
//
// Payload такой же как у модалки:
//   { title, desc, items[] }
// ------------------------------------------------------------

let pop = null;
let hideTimer = null;
let isOverPop = false;

function _ensure() {
  if (pop) return pop;
  pop = document.createElement('div');
  pop.className = 'popover';
  pop.style.display = 'none';
  pop.innerHTML = `
    <div class="popoverHead"></div>
    <div class="popoverBody"></div>
  `;
  document.body.appendChild(pop);

  pop.addEventListener('mouseenter', () => {
    isOverPop = true;
    if (hideTimer) clearTimeout(hideTimer);
  });
  pop.addEventListener('mouseleave', () => {
    isOverPop = false;
    _hideSoon();
  });

  return pop;
}

function _esc(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function _render(title, payload) {
  const p = _ensure();
  const head = p.querySelector('.popoverHead');
  const body = p.querySelector('.popoverBody');
  if (head) head.textContent = title || 'Подробности';

  const desc = payload?.desc ? String(payload.desc).trim() : '';
  const items = Array.isArray(payload?.items) ? payload.items : [];

  const parts = [];
  if (desc) parts.push(`<div class="small" style="opacity:.95;margin-bottom:8px;">${_esc(desc)}</div>`);
  if (items.length) {
    const lis = items.map(x => `<li>${_esc(x)}</li>`).join('');
    parts.push(`<ul class="list" style="margin:0;">${lis}</ul>`);
  }
  if (!desc && !items.length) parts.push('<div class="small" style="opacity:.85;">Нет данных.</div>');

  if (body) body.innerHTML = parts.join('');
}

function _placeNear(anchor) {
  const p = _ensure();
  const r = anchor.getBoundingClientRect();
  // Показываем снизу справа от кнопки
  const pad = 10;
  const w = Math.min(360, window.innerWidth - pad * 2);
  p.style.maxWidth = w + 'px';
  p.style.minWidth = '220px';

  // Сначала выставим "временную" позицию, чтобы узнать размеры
  p.style.left = pad + 'px';
  p.style.top = pad + 'px';
  p.style.display = 'block';

  const pr = p.getBoundingClientRect();
  let left = r.right - pr.width;
  let top = r.bottom + 8;

  // если не помещается снизу — показываем сверху
  if (top + pr.height > window.innerHeight - pad) {
    top = r.top - pr.height - 8;
  }

  // поджимаем в экран
  left = Math.max(pad, Math.min(left, window.innerWidth - pr.width - pad));
  top = Math.max(pad, Math.min(top, window.innerHeight - pr.height - pad));

  p.style.left = left + 'px';
  p.style.top = top + 'px';
}

function _hide() {
  if (!pop) return;
  pop.style.display = 'none';
}

function _hideSoon() {
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    if (!isOverPop) _hide();
  }, 140);
}

/**
 * Подключить поповер к кнопке.
 * @param {HTMLElement} btn
 * @param {()=>({title?:string, desc?:string, items?:string[]})} getPayload
 */
export function attachPopover(btn, getPayload) {
  if (!btn) return;

  btn.addEventListener('mouseenter', () => {
    // На тач‑устройствах hover не нужен.
    if (window.matchMedia && window.matchMedia('(hover: none)').matches) return;

    if (hideTimer) clearTimeout(hideTimer);
    const payload = (typeof getPayload === 'function') ? (getPayload() || {}) : {};
    _render(payload.title || '', payload);
    _placeNear(btn);
  });

  btn.addEventListener('mouseleave', () => {
    if (window.matchMedia && window.matchMedia('(hover: none)').matches) return;
    _hideSoon();
  });

  // Если пользователь скроллит — прячем, чтобы не висело где‑то в стороне.
  window.addEventListener('scroll', _hide, { passive: true });
  window.addEventListener('resize', _hide, { passive: true });
}
