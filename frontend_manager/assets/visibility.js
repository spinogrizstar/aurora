// ФАЙЛ: frontend/assets/visibility.js
// ------------------------------------------------------------
// Отвечает за то, какие блоки формы показывать.
// Например: "ККТ" показываем после выбора сегмента.
// ------------------------------------------------------------

import { state } from './state.js';
import { hasRetail, hasWholesaleOrProducer, hasProducer } from './helpers.js';

// Анимация появления/скрытия секций (медленная, «по красоте»)
export const SECTION_ANIM_MS = 1120; // было ~560, замедлили в 2 раза

export function visibilityFromState() {
  const hasSeg = (state.segments || []).length > 0;
  return {
    onec: hasSeg,
    kkt: hasSeg,
    devices: hasSeg,
    // Юрлица могут понадобиться в любой ветке (в том числе в рознице).
    orgs: hasSeg,
    // Агрегация и часть “оптовых” сценариев — только для опта/производителя.
    wholesaleAgg: hasSeg && hasWholesaleOrProducer(),
    products: hasSeg && hasProducer(),
    scenarios: hasSeg,
    support: hasSeg,
    contacts: hasSeg,
  };
}
