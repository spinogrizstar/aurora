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
const MANAGER_MATRIX_URL = new URL('../../frontend_shared/data/manager_matrix_v5.json', import.meta.url);

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
  try {
    const matrixRes = await fetch(MANAGER_MATRIX_URL, { cache: 'no-store' });
    if (matrixRes.ok) {
      _DATA.manager_matrix_v5 = await matrixRes.json();
    }
  } catch (e) {
    // manager_matrix_v5.json опционален
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
