# Aurora Checklist

Мини‑проект: **FastAPI** (backend) + статичные фронтенды, раздаётся одним сервером.

## Требования
- Python 3.10+ (рекомендуется).
- Windows (для .bat), либо любой ОС для запуска через `uvicorn`.

## Быстрый старт (Windows)
1) Установить зависимости:
   ```bat
   pip install -r requirements.txt
   ```
2) Запуск:
   - `start_localhost.bat` — доступ только на этом ПК
   - `start_lan.bat` — доступно в домашней сети
   - `start_secure_localhost.bat` — localhost с паролем
   - `start_secure_lan.bat` — LAN с паролем
   - `start_caddy_host.bat` — Caddy + backend в одном клике (см. ниже)
   - `start.bat` — меню со всеми вариантами

Открой в браузере: `http://127.0.0.1:8000/`

## Запуск через командную строку (Linux/macOS/Windows)
```bash
python -m pip install -r requirements.txt
python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

Для доступа из LAN:
```bash
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

## Парольная защита (BasicAuth)
Если задать переменные окружения `AURORA_USER` и `AURORA_PASS`, сервер включает BasicAuth для всех маршрутов, кроме `/health`.

Пример (Windows PowerShell):
```powershell
$env:AURORA_USER = "admin"
$env:AURORA_PASS = "secret"
python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

Пример (bash):
```bash
AURORA_USER=admin AURORA_PASS=secret \
  python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

## Доступные страницы
- `/` — выбор роли (root UI)
- `/client` — клиентский UI
- `/manager` — менеджерский UI
- `/admin` — админка

## Важно про запуск менеджера
`frontend_manager/index.html` нельзя открывать двойным кликом (через `file://`). Используйте HTTP‑запуск через `start_localhost.bat` или `python -m http.server`, иначе модульные скрипты и `fetch` могут не работать.

## Менеджер v5: источник истины расчёта
- Источник истины — `calcState` (selectedPackageId + services + serviceOverrides + servicesDetailed), который собирается через `getCalcState()` из `frontend_manager/assets/state.js` и передаётся в `recalc(normalizeState(...))` в `frontend_manager/assets/update.js`.
- Сам расчёт находится в `frontend_manager/assets/calc/managerV5Calc.js` (normalize → recalc → validate).
- В dev‑режиме каждый апдейт логирует diff calcState + totals + issues (см. `frontend_manager/assets/update.js`).
- Сброс ручного оверрайда количества — кнопка ↺ рядом со счётчиком услуги в правой панели.

## API
- `POST /calculate`
- `GET /health`

Пример JSON для `/calculate`:
```json
{"cashboxes": 3, "support": true}
```

## Частые команды
- Установка зависимостей: `python -m pip install -r requirements.txt`
- Запуск (localhost): `python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000`
- Запуск (LAN): `python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000`

## Caddy + запуск в один .bat
Если Caddy лежит в `C:\caddy\caddy.exe`, а `Caddyfile` — в `C:\caddy\Caddyfile`, можно запускать всё одним файлом:

- `start_caddy_host.bat`:
  - Стартует Caddy.
  - Стартует backend на `0.0.0.0:8000`.
  - Через ~30 секунд делает запрос к `https://cheklistbit.ru` и пишет в CMD, работает сайт или нет.

Если пути отличаются, открой `start_caddy_host.bat` и поправь:
```
set "PROJECT_DIR=D:\paket"
set "CADDY_EXE=C:\caddy\caddy.exe"
set "CADDYFILE=C:\caddy\Caddyfile"
```

## Как обновлять проект с GitHub (PyCharm/терминал)
Открой терминал в PyCharm и выполни:

```bat
cd /d D:\paket
git status
git pull --rebase origin main
```

Если есть локальные изменения и `git pull` ругается, можно временно спрятать их:
```bat
git stash
git pull --rebase origin main
git stash pop
```

## Планы
- Поддерживать README актуальным при каждом изменении поведения/запуска.
- Расширить документацию по правилам расчёта и примерам запросов.
- Добавить/обновить тесты и smoke‑проверки при изменениях в логике.

## Как обновлять README
- При каждом изменении запуска, зависимостей, эндпоинтов или UI — обновляйте соответствующие разделы.
- Если меняются шаги установки/запуска, обновляйте **Быстрый старт** и **Частые команды**.
- При добавлении новых модулей/страниц — обновляйте **Доступные страницы**.
