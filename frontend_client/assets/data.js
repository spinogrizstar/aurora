// ФАЙЛ: frontend/assets/data.js
// ------------------------------------------------------------
// ЗАЧЕМ НУЖЕН:
//   Это «загрузка таблицы» (пакеты/цены/баллы) из /data/data.json.
//
// КАК ПРАВИТЬ ДАННЫЕ:
//   Открой файл: frontend/data/data.json
//   Там всё в одном месте: пакеты, цены, коэффициенты.
// ------------------------------------------------------------

let _DATA = null;

export async function loadData() {
  if (_DATA) return _DATA;
  const res = await fetch('/data/data.json', { cache: 'no-store' });
  if (!res.ok) {
    throw new Error('Не удалось загрузить /data/data.json');
  }
  _DATA = await res.json();
  return _DATA;
}

export function getDataSync() {
  // Для случаев, когда данные уже загружены.
  if (!_DATA) {
    throw new Error('DATA ещё не загружен. Сначала вызови loadData().');
  }
  return _DATA;
}
