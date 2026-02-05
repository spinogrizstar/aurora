// ФАЙЛ: frontend/assets/visibility.js
// ------------------------------------------------------------
// Отвечает за то, какие блоки формы показывать.
// Например: "ККТ" показываем после выбора сегмента.
// ------------------------------------------------------------

import { state } from './state.js';
import { isEquipmentAvailable } from './services.js';

// Анимация появления/скрытия секций (медленная, «по красоте»)
export const SECTION_ANIM_MS = 1120; // было ~560, замедлили в 2 раза

export function visibilityFromState() {
  const hasSeg = (state.segments || []).length > 0;
  const packageId = state.selectedPackageId;
  const equipmentAllowed = isEquipmentAvailable(packageId);
  return {
    equipment: hasSeg && (equipmentAllowed || state.equipmentEnabled),
    custom: hasSeg,
  };
}
