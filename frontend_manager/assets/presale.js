// ФАЙЛ: frontend/assets/presale.js
// ------------------------------------------------------------
// Генерация текста «КП / запрос на пресейл» и кнопки копирования.
//
// Если хочется поменять формат текста — правь функцию buildPresaleText().
// ------------------------------------------------------------

import { state } from './state.js';
import { fmtRub, segText, kktCount, deviceCounts, devicesPayload } from './helpers.js';
import { el } from './dom.js';
import { lastResult } from './update.js';
import { KKT_TYPES } from './catalogs.js';

export function buildPresaleText() {
  const pkg = lastResult?.pkg;
  const calc = lastResult?.calc;
  const prelim = lastResult?.prelim;
  const diag = lastResult?.costs?.diag || 0;
  const support = lastResult?.costs?.support || 0;
  const total = lastResult?.costs?.total || 0;

  const kktCnt = kktCount();
  const dc = deviceCounts();
  const typeMap = new Map((KKT_TYPES || []).map(t => [t.id, t.label]));
  const kktTypeLabel = typeMap.get(state.kkt?.type) || 'Прочие ККТ';

  const segLow = (state.segments || []).map(x => String(x).toLowerCase());
  const isProducer = segLow.some(s => s.includes('производ'));
  const prodCats = (state.product && Array.isArray(state.product.categories)) ? state.product.categories : [];
  const prodComment = (state.product && state.product.comment) ? String(state.product.comment).trim() : '';

  const lines = [
    'ЗАПРОС НА ПРЕСЕЙЛ (по чек-листу)',
    `Сегменты: ${segText()}`,
    `Пакет: ${prelim ? 'предварительно ' : ''}${pkg?.name || '—'}`,
    `ККТ: ${kktCnt} (используется: ${state.uses_kkt ? 'да' : 'нет'})`,
    ...(kktCnt > 0 ? [`Тип ККТ: ${kktTypeLabel}`] : []),
    `Юрлица: ${state.org_count}`,
    `Устройства: Сканеры ×${dc.scanners}, ТСД ×${dc.tsd}` + ((dc.tsd && state.tsd_collective) ? ' (коллективная работа)' : ''),
    ...(isProducer ? [
      `Товарные группы (ЧЗ): ${prodCats.length ? prodCats.join(', ') : '—'}`,
      ...(prodComment ? ['Комментарий по продукции:', prodComment] : []),
    ] : []),
    `Поддержка 5 дней: ${state.support ? 'да' : 'нет'}`,
    `Нестандарт/интеграции: ${state.custom_integration ? 'да' : 'нет'}`,
    '',
    'Факторы стоимости:'
  ];

  if (prelim) lines.push(`- Диагностика ККТ: ${fmtRub(diag)}`);
  if (support) lines.push(`- Поддержка 5 дней: ${fmtRub(support)}`);
  (calc?.serviceItems || []).forEach(x => lines.push(`- Услуги: ${x.label} (+${x.pts} балл.)`));
  (calc?.licItems || []).forEach(x => lines.push(`- Лицензии: ${x.label} (${fmtRub(x.rub)})`));

  const c = state.contacts || {};
  if ((c.legal_name || c.inn || c.contact_name || c.phone || c.email || c.desired_result)) {
    lines.push('', 'Данные клиента:');
    if (c.legal_name) lines.push(`- Юрлицо: ${c.legal_name}`);
    if (c.inn) lines.push(`- ИНН: ${c.inn}`);
    if (c.contact_name) lines.push(`- Контакт: ${c.contact_name}`);
    if (c.phone) lines.push(`- Телефон: ${c.phone}`);
    if (c.email) lines.push(`- Email: ${c.email}`);
    if (c.desired_result) lines.push('', 'Желаемый результат:', c.desired_result);
  }

  lines.push('', `Итого (предварительно): ${fmtRub(total)}`);
  return lines.join('\n');
}

export function wirePresaleButtons() {
  if (el.copyBtn) {
    el.copyBtn.onclick = async () => {
      const txt = buildPresaleText().replace(
        'ЗАПРОС НА ПРЕСЕЙЛ (по чек-листу)',
        'КП (выжимка по чек-листу)',
      );
      try {
        await navigator.clipboard.writeText(txt);
        alert('Скопировано.');
      } catch (e) {
        alert(txt);
      }
    };
  }

  if (el.presaleBtn) {
    el.presaleBtn.onclick = async () => {
      const txt = buildPresaleText();
      try {
        await navigator.clipboard.writeText(txt);
        alert('Запрос на пресейл скопирован.');
      } catch (e) {
        alert(txt);
      }
    };
  }

  // Скачать Word (docx)
  // Это удобно, если у тебя есть стандартный шаблон КП/анкеты.
  // Механика простая: фронт отправляет текущий state на /api/v5/docx,
  // бэкенд собирает .docx и возвращает файл.
  if (el.wordBtn) {
    el.wordBtn.onclick = async () => {
      try {
        const r = await fetch('/api/v5/docx', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...state,
            devices: devicesPayload(),
          }),
        });

        if (!r.ok) throw new Error(await r.text());
        const blob = await r.blob();

        // Попробуем взять имя из Content-Disposition.
        let filename = 'KP_Aurora.docx';
        const cd = r.headers.get('content-disposition') || '';
        const m = cd.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
        if (m) filename = decodeURIComponent(m[1] || m[2] || filename);

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (e) {
        alert('Не удалось скачать Word: ' + (e?.message || e));
      }
    };
  }

  // Модалка диагностики сейчас не используется, но закрытие оставим
  if (el.modalClose && el.modalBack) {
    el.modalClose.onclick = () => { el.modalBack.style.display = 'none'; };
  }
}
