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
const MANAGER_MATRIX_URL = '/api/v5/services-matrix';
const MANAGER_MATRIX_FALLBACK_URL = '/data/manager_matrix_v5.json';

export async function loadData() {
  if (_DATA) return _DATA;
  try {
    const res = await fetch(DATA_URL, { cache: 'no-store' });
    if (!res.ok) {
      console.error('[Aurora][manager_v5] Data fetch failed', {
        url: DATA_URL,
        status: res.status,
        statusText: res.statusText,
      });
      _DATA = { __loadError: `Не удалось загрузить ${DATA_URL}` };
      return _DATA;
    }
    _DATA = await res.json();
  } catch (err) {
    console.error('[Aurora][manager_v5] Data fetch error', {
      url: DATA_URL,
      error: err,
    });
    _DATA = { __loadError: `Ошибка загрузки ${DATA_URL}` };
    return _DATA;
  }
  try {
    const coreRes = await fetch(CORE_PACKAGES_URL, { cache: 'no-store' });
    if (coreRes.ok) {
      _DATA.core_packages = await coreRes.json();
    } else {
      console.error('[Aurora][manager_v5] Core packages fetch failed', {
        url: CORE_PACKAGES_URL,
        status: coreRes.status,
        statusText: coreRes.statusText,
      });
    }
  } catch (e) {
    // core_packages.json опционален
    console.error('[Aurora][manager_v5] Core packages fetch error', {
      url: CORE_PACKAGES_URL,
      error: e,
    });
  }
  try {
    const matrixRes = await fetch(MANAGER_MATRIX_URL, { cache: 'no-store' });
    if (matrixRes.ok) {
      _DATA.manager_matrix_v5 = await matrixRes.json();
      _DATA.__matrixError = '';
    } else {
      console.error('[Aurora][manager_v5] Manager matrix fetch failed', {
        url: MANAGER_MATRIX_URL,
        status: matrixRes.status,
        statusText: matrixRes.statusText,
      });
      _DATA.__matrixError = `не удалось загрузить ${MANAGER_MATRIX_URL}`;
    }
  } catch (e) {
    console.error('[Aurora][manager_v5] Manager matrix fetch error', {
      url: MANAGER_MATRIX_URL,
      error: e,
    });
    _DATA.__matrixError = `не удалось загрузить ${MANAGER_MATRIX_URL}`;
  }
  if (_DATA.__matrixError) {
    try {
      const fallbackRes = await fetch(MANAGER_MATRIX_FALLBACK_URL, { cache: 'no-store' });
      if (fallbackRes.ok) {
        _DATA.manager_matrix_v5 = await fallbackRes.json();
        _DATA.__matrixError = '';
      } else {
        console.error('[Aurora][manager_v5] Manager matrix fallback fetch failed', {
          url: MANAGER_MATRIX_FALLBACK_URL,
          status: fallbackRes.status,
          statusText: fallbackRes.statusText,
        });
        _DATA.__matrixError = `не удалось загрузить ${MANAGER_MATRIX_FALLBACK_URL}`;
      }
    } catch (e) {
      console.error('[Aurora][manager_v5] Manager matrix fallback fetch error', {
        url: MANAGER_MATRIX_FALLBACK_URL,
        error: e,
      });
      _DATA.__matrixError = `не удалось загрузить ${MANAGER_MATRIX_FALLBACK_URL}`;
    }
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
