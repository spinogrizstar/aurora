// ФАЙЛ: frontend/assets/presale.js
// ------------------------------------------------------------
// Генерация текста «КП / запрос на пресейл» и кнопки копирования.
//
// Если хочется поменять формат текста — правь функцию buildPresaleText().
// ------------------------------------------------------------

import { state, getCalcState } from './state.js';
import { fmtRub, segText, kktCount, kktCounts, deviceCounts, devicesPayload } from './helpers.js';
import { el } from './dom.js';
import { lastResult } from './update.js';
import { normalizeState, recalc } from './calc/managerV5Calc.js';
import { getDataSync } from './data.js';
import { isEquipmentAvailable } from './services.js';

const DEFAULT_RATE_PER_HOUR = 4950;

function getRatePerHour() {
  const rate = Number(getDataSync()?.manager_matrix_v5?.rate_per_hour ?? DEFAULT_RATE_PER_HOUR);
  return Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_RATE_PER_HOUR;
}

function formatHoursInline(value) {
  const num = Number(value || 0);
  if (Number.isInteger(num)) return String(num);
  return num.toFixed(1).replace(/\.0$/, '');
}

function formatRub(value) {
  const num = Number(value || 0);
  return num.toLocaleString('ru-RU');
}

function showToast(message, kind = 'ok', ms = 2400) {
  const toast = document.createElement('div');
  toast.textContent = message;
  Object.assign(toast.style, {
    position: 'fixed',
    right: '20px',
    bottom: '20px',
    padding: '10px 14px',
    borderRadius: '10px',
    background: kind === 'err' ? 'rgba(239,68,68,.95)' : 'rgba(16,185,129,.95)',
    color: '#fff',
    fontSize: '13px',
    fontWeight: '600',
    boxShadow: '0 6px 18px rgba(0,0,0,.25)',
    zIndex: 9999,
    opacity: '0',
    transform: 'translateY(8px)',
    transition: 'opacity 0.2s ease, transform 0.2s ease',
    pointerEvents: 'none',
  });
  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });
  window.setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    window.setTimeout(() => toast.remove(), 250);
  }, ms);
}

async function copyWithFallback(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      // fallback below
    }
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.top = '-1000px';
  textarea.style.left = '-1000px';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch (e) {
    ok = false;
  }
  textarea.remove();
  return ok;
}

function getSelectedPackage() {
  const selectedId = String(state.selectedPackageId || '').trim();
  if (!selectedId) return null;
  const corePackages = getDataSync()?.core_packages?.packages || [];
  const pkg = corePackages.find((item) => String(item?.id || item?.segment_key || '') === selectedId);
  if (!pkg) return null;
  return {
    id: selectedId,
    label: String(pkg.title || pkg.name || pkg.label || '').trim() || selectedId,
  };
}

export function buildKPText() {
  const pkg = getSelectedPackage();
  if (!pkg) return '';
  const managerCalc = recalc(normalizeState(getCalcState()));
  const rate = getRatePerHour();

  const { regular, smart, other } = kktCounts();
  const { scanners } = deviceCounts();
  const now = new Date().toLocaleString('ru-RU');

  const lines = [
    'КП (внутреннее)',
    `Дата/время: ${now}`,
  ];

  const c = state.contacts || {};
  const clientLines = [];
  if (c.legal_name) clientLines.push(`Юрлицо: ${c.legal_name}`);
  if (c.inn) clientLines.push(`ИНН: ${c.inn}`);
  if (c.contact_name) clientLines.push(`Контакт: ${c.contact_name}`);
  if (c.phone) clientLines.push(`Телефон: ${c.phone}`);
  if (c.email) clientLines.push(`Email: ${c.email}`);
  if (clientLines.length) {
    lines.push('', 'Клиент:');
    clientLines.forEach((line) => lines.push(`- ${line}`));
  }

  const segmentLabel = segText() || '—';
  lines.push('', `Сегмент/пакет: ${segmentLabel} — ${pkg.label}`);
  lines.push(`Ставка: ${rate} ₽/час`);
  if (isEquipmentAvailable(state.selectedPackageId)) {
    const kktTotal = kktCount();
    lines.push(`Оборудование: ККТ ${kktTotal} (обычная/смарт/другая: ${regular}/${smart}/${other}) · Сканеры ${scanners}`);
  }
  lines.push('Услуги:');

  const breakdownMap = new Map();
  (managerCalc?.breakdown || []).forEach((row) => {
    breakdownMap.set(String(row.key || ''), row);
  });

  const servicesList = Array.isArray(state.services)
    ? state.services
    : Object.values(state.services || {});
  let currentGroup = null;
  let hasManualOverride = false;

  servicesList.forEach((svc) => {
    if (!svc) return;
    const key = String(svc.id || svc.key || svc.title || '');
    const row = breakdownMap.get(key) || {};
    const group = svc.group || row.group || 'Прочее';

    if (group !== currentGroup) {
      if (currentGroup !== null) lines.push('');
      lines.push(`${group}:`);
      currentGroup = group;
    }

    const qty = row.qty ?? svc.qty_current ?? svc.qty ?? 0;
    const hoursPerUnit = row.hours_per_unit ?? row.hoursPerUnit ?? svc.unit_hours ?? svc.hours_per_unit ?? svc.hoursPerUnit ?? 0;
    const hoursTotal = row.hoursTotal ?? Number(qty || 0) * Number(hoursPerUnit || 0);
    const isManualOverride = svc.qty_mode === 'manual' && svc.preset_qty_mode === 'auto';
    const marker = isManualOverride ? '*' : '';

    if (isManualOverride) hasManualOverride = true;

    lines.push(`${svc.title || key}${marker}: ${qty} × ${formatHoursInline(hoursPerUnit)} = ${formatHoursInline(hoursTotal)} ч`);
  });

  const totalHours = managerCalc?.totals?.hours || 0;
  const totalRub = managerCalc?.totals?.price || 0;
  lines.push('', `Итого: ${formatHoursInline(totalHours)} ч · ${formatRub(totalRub)} ₽`);

  if (hasManualOverride) {
    lines.push('', '* — количество изменено вручную');
  }

  return lines.join('\r\n');
}

export function buildPresaleText() {
  const pkg = lastResult?.pkg;
  const prelim = lastResult?.prelim;
  const managerCalc = recalc(normalizeState(getCalcState()));
  const total = managerCalc?.totals?.price || 0;

  const kktCnt = kktCount();
  const dc = deviceCounts();

  const segLow = (state.segments || []).map(x => String(x).toLowerCase());
  const isProducer = segLow.some(s => s.includes('производ'));
  const prodCats = (state.product && Array.isArray(state.product.categories)) ? state.product.categories : [];
  const prodComment = (state.product && state.product.comment) ? String(state.product.comment).trim() : '';

  const lines = [
    'ЗАПРОС НА ПРЕСЕЙЛ (по чек-листу)',
    `Сегменты: ${segText()}`,
    `Пакет: ${prelim ? 'предварительно ' : ''}${pkg?.title || pkg?.name || '—'}`,
    `ККТ: ${kktCnt} (используется: ${state.uses_kkt ? 'да' : 'нет'})`,
    `Сканеры: ${dc.scanners || 0}`,
    ...(isProducer ? [
      `Товарные группы (ЧЗ): ${prodCats.length ? prodCats.join(', ') : '—'}`,
      ...(prodComment ? ['Комментарий по продукции:', prodComment] : []),
    ] : []),
    `Нестандарт/интеграции: ${state.custom_integration ? 'да' : 'нет'}`,
    '',
    'Услуги и объём:'
  ];

  (managerCalc?.breakdown || []).forEach((row) => {
    const hoursPerUnit = row.hours_per_unit ?? row.hoursPerUnit ?? 0;
    lines.push(`- ${row.title}: ${row.qty || 0} × ${formatHoursInline(hoursPerUnit)} ч = ${formatHoursInline(row.hoursTotal)} ч`);
  });

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

  lines.push('', `Всего часов: ${managerCalc?.totals?.hours || 0} ч`);
  lines.push(`Итого (предварительно): ${fmtRub(total)}`);
  return lines.join('\n');
}

export function wirePresaleButtons() {
  if (el.copyBtn) {
    el.copyBtn.onclick = async () => {
      const selectedPackage = getSelectedPackage();
      if (!selectedPackage) {
        showToast('Сначала выберите пакет', 'err');
        return;
      }
      const txt = buildKPText();
      const ok = await copyWithFallback(txt);
      if (ok) {
        showToast('КП скопировано');
      } else {
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
