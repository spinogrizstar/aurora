# Aurora Checklist

Мини‑проект: **FastAPI** (backend) + простая страница (frontend), раздаётся одним сервером.

## Быстрый старт (Windows)
1) `pip install -r requirements.txt`
2) Запуск:
- `start_localhost.bat` — только на этом ПК
- `start_lan.bat` — доступно в домашней сети

Открой в браузере: `http://127.0.0.1:8000/`

## API
- `POST /calculate`

Пример JSON:
```json
{"cashboxes": 3, "support": true}
```
