// ФАЙЛ: frontend/assets/data.js
// ------------------------------------------------------------
// ЗАЧЕМ НУЖЕН:
//   Это «загрузка таблицы» (пакеты/цены/баллы) из /data/data.json.
//
// КАК ПРАВИТЬ ДАННЫЕ:
//   Открой файл: frontend_shared/data/data.json
//   Там всё в одном месте: пакеты, цены, коэффициенты.
// ------------------------------------------------------------

let _DATA = null;
const DATA_URL = new URL('../data/data.json', import.meta.url);
const CORE_PACKAGES_URL = new URL('../data/core_packages.json', import.meta.url);

export async function loadData() {
  if (_DATA) return _DATA;
  try {
    const res = await fetch(DATA_URL, { cache: 'no-store' });
    if (!res.ok) {
      _DATA = { __loadError: `Не удалось загрузить ${DATA_URL.pathname}` };
      return _DATA;
    }
    _DATA = await res.json();
  } catch (err) {
    _DATA = { __loadError: `Ошибка загрузки ${DATA_URL.pathname}` };
    return _DATA;
  }
  try {
    const coreRes = await fetch(CORE_PACKAGES_URL, { cache: 'no-store' });
    if (coreRes.ok) {
      _DATA.core_packages = await coreRes.json();
    }
  } catch (e) {
    // core_packages.json опционален
  }
  return _DATA;
}

export function getDataSync() {
  // Для случаев, когда данные уже загружены.
  if (!_DATA) {
    throw new Error('DATA ещё не загружен. Сначала вызови loadData().');
  }
  return _DATA;
}
