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
const DATA_URL = '/data/data.json';
const CORE_PACKAGES_URL = '/data/core_packages.json';
const MANAGER_MATRIX_URL = '/data/manager_matrix_v5.json';

export async function loadData() {
  if (_DATA) return _DATA;
  try {
    const res = await fetch(DATA_URL, { cache: 'no-store' });
    if (!res.ok) {
      console.error('[Aurora][manager_v5] Failed to load data.json', res.status, res.statusText);
      _DATA = { __loadError: `Не удалось загрузить ${DATA_URL}` };
      return _DATA;
    }
    _DATA = await res.json();
  } catch (err) {
    console.error('[Aurora][manager_v5] Failed to load data.json', err);
    _DATA = { __loadError: `Ошибка загрузки ${DATA_URL}` };
    return _DATA;
  }
  try {
    const coreRes = await fetch(CORE_PACKAGES_URL, { cache: 'no-store' });
    if (!coreRes.ok) {
      console.error('[Aurora][manager_v5] Failed to load core_packages.json', coreRes.status, coreRes.statusText);
    } else {
      _DATA.core_packages = await coreRes.json();
    }
  } catch (e) {
    console.error('[Aurora][manager_v5] Failed to load core_packages.json', e);
    // core_packages.json опционален
  }
  try {
    const matrixRes = await fetch(MANAGER_MATRIX_URL, { cache: 'no-store' });
    if (!matrixRes.ok) {
      console.error('[Aurora][manager_v5] Failed to load manager_matrix_v5.json', matrixRes.status, matrixRes.statusText);
      _DATA.__matrixLoadError = `Не удалось загрузить ${MANAGER_MATRIX_URL}`;
    } else {
      _DATA.manager_matrix_v5 = await matrixRes.json();
    }
  } catch (e) {
    console.error('[Aurora][manager_v5] Failed to load manager_matrix_v5.json', e);
    _DATA.__matrixLoadError = `Не удалось загрузить ${MANAGER_MATRIX_URL}`;
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
