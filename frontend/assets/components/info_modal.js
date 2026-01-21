// ФАЙЛ: frontend/assets/components/info_modal.js
// ------------------------------------------------------------
// Одна общая «модалка-подсказка» для проекта.
//
// ЗАЧЕМ:
//   - показывать состав пакета (что входит)
//   - показывать состав мини-планов (например, Клеверенс)
//
// Это проще, чем плодить 5 разных всплывашек по коду.
// ------------------------------------------------------------

import { el } from '../dom.js';

export function initInfoModal() {
  if (!el.infoBack) return;

  // Закрытие по кнопке
  if (el.infoClose) {
    el.infoClose.onclick = () => {
      el.infoBack.style.display = 'none';
    };
  }

  // Закрытие по клику по фону
  el.infoBack.onclick = (e) => {
    if (e.target === el.infoBack) el.infoBack.style.display = 'none';
  };
}

/**
 * Открыть модалку.
 * @param {string} title
 * @param {{desc?:string, items?:string[]}} payload
 */
export function openInfoModal(title, payload = {}) {
  if (!el.infoBack) return;
  if (el.infoTitle) el.infoTitle.textContent = title || 'Подробности';

  const desc = payload.desc ? String(payload.desc).trim() : '';
  const items = Array.isArray(payload.items) ? payload.items : [];

  // Рисуем аккуратный список.
  const parts = [];
  if (desc) parts.push(`<div class="small" style="margin-bottom:10px;opacity:.95;">${_esc(desc)}</div>`);
  if (items.length) {
    const lis = items.map(x => `<li>${_esc(x)}</li>`).join('');
    parts.push(`<ul class="list" style="margin:0;">${lis}</ul>`);
  }
  if (!desc && !items.length) {
    parts.push('<div class="small" style="opacity:.85;">Нет данных для отображения.</div>');
  }

  if (el.infoBody) el.infoBody.innerHTML = parts.join('');
  el.infoBack.style.display = 'flex';
}

function _esc(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
