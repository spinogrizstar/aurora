# Инструкции для Codex (менеджер)

## Где править UI менеджера
- Левый чек-лист: `frontend_manager/assets/ui/checklist.js` (карточки пакета, ККТ, доп.работы, устройства и т.д.).
- Правая панель (итоги): `frontend_manager/assets/ui/summary.js` + разметка в `frontend_manager/index.html`.
- Стили: `frontend_manager/assets/styles.css`.
- Состояние: `frontend_manager/assets/state.js`.
- Расчёты: `frontend_manager/assets/calc.js`.

## Версия и чейнджлог
- Текущая версия хранится в `VERSION.txt`.
- После каждого изменения увеличивай версию:
  - обычные правки: +0.0.1 (patch);
  - «мажорные» изменения (архитектура/крупная UI-реформа/ломает совместимость): +0.1.0 (minor), patch обнуляется.
- Каждое изменение фиксируй в `CHANGELOG_RU.md`:
  - дата (YYYY-MM-DD), версия и список пунктов на русском.

## Как добавлять новые допы/опции
1. Добавь флаг в `state.addons` (в `frontend_manager/assets/state.js`).
2. Добавь чекбокс в блок «Доп.работы» (`frontend_manager/assets/ui/checklist.js`) с нужными условиями показа.
3. Учти часы/стоимость в `calcManagerTotals()` (`frontend_manager/assets/calc.js`).
4. При необходимости отобрази доп в правой панели (`frontend_manager/assets/ui/summary.js`).
