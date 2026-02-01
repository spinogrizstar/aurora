// ФАЙЛ: frontend/assets/helpers.js
// ------------------------------------------------------------
// Мелкие вспомогательные функции: формат денег, подсчёты, мелкая математика.
// Это «кирпичики», которые используют UI и расчёт.
// ------------------------------------------------------------

import { state } from './state.js';

export function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

export function fmtRub(x) {
  const n = Number(x || 0);
  return n.toLocaleString('ru-RU') + ' ₽';
}

export function splitToBullets(text) {
  if (!text) return [];
  return String(text)
    .split(/\n+/g)
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => s.replace(/^•\s?/, ''));
}

export function segText() {
  return (state.segments || []).length ? state.segments.join(' + ') : '—';
}

export function kktCount() {
  return Number(state.kkt?.count || 0);
}

export function deviceCounts() {
  return {
    scanners: Number(state.device_scanner || 0),
    tsd: Number(state.device_tsd || 0),
  };
}

export function devicesPayload() {
  // Для API отправляем массив устройств.
  const { scanners, tsd } = deviceCounts();
  const arr = [];
  for (let i = 0; i < scanners; i++) arr.push({ type: 'scanner' });
  for (let i = 0; i < tsd; i++) arr.push({ type: 'tsd' });
  return arr;
}

export function hasRetail() {
  return (state.segments || []).some(x => String(x).toLowerCase().includes('розниц'));
}

export function hasWholesaleOrProducer() {
  const segs = (state.segments || []).map(x => String(x).toLowerCase());
  return segs.some(s => s.includes('опт')) || segs.some(s => s.includes('производ'));
}

export function hasProducer() {
  return (state.segments || []).some(x => String(x).toLowerCase().includes('производ'));
}
