// ФАЙЛ: frontend/assets/dom.js
// ------------------------------------------------------------
// ЗАЧЕМ НУЖЕН:
//   Здесь мы собираем все нужные элементы страницы по id.
//   Если ты в HTML переименуешь id — правь ТОЛЬКО здесь.
// ------------------------------------------------------------

export const el = {
  checklistMain: document.getElementById('checklistMain'),
  checklistExtra: document.getElementById('checklistExtra'),

  // Summary (правая панель)
  segBadge: document.getElementById('segBadge'),
  pkgTitle: document.getElementById('pkgTitle'),
  pkgPills: document.getElementById('pkgPills'),
  pkgWho: document.getElementById('pkgWho'),
  pkgDetailed: document.getElementById('pkgDetailed'),
  recHint: document.getElementById('recHint'),
  diagBanner: document.getElementById('diagBanner'),
  projAlert: document.getElementById('projAlert'),

  sumBase: document.getElementById('sumBase'),
  sumDiag: document.getElementById('sumDiag'),
  sumSupport: document.getElementById('sumSupport'),
  sumServices: document.getElementById('sumServices'),
  servicesBreakdown: document.getElementById('servicesBreakdown'),
  sumLic: document.getElementById('sumLic'),
  licBreakdown: document.getElementById('licBreakdown'),
  sumTotal: document.getElementById('sumTotal'),
  sumHours: document.getElementById('sumHours'),
  pkgHours: document.getElementById('pkgHours'),
  addonsHours: document.getElementById('addonsHours'),
  kktPrepHours: document.getElementById('kktPrepHours'),
  totalHours: document.getElementById('totalHours'),
  addonsList: document.getElementById('addonsList'),

  // Кнопки
  copyBtn: document.getElementById('copyBtn'),
  presaleBtn: document.getElementById('presaleBtn'),
  wordBtn: document.getElementById('wordBtn'),
  whyBtn: document.getElementById('whyBtn'),
  matrixBtn: document.getElementById('matrixBtn'),

  // Modal (сейчас фактически не используется, но оставляем)
  modalBack: document.getElementById('modalBack'),
  modalClose: document.getElementById('modalClose'),
  modalCopy: document.getElementById('modalCopy'),

  // Универсальная модалка «подробности»
  infoBack: document.getElementById('infoBack'),
  infoClose: document.getElementById('infoClose'),
  infoTitle: document.getElementById('infoTitle'),
  infoBody: document.getElementById('infoBody'),

  // Матрица услуг (граф)
  graphBack: document.getElementById('graphBack'),
  graphClose: document.getElementById('graphClose'),
  graphTitle: document.getElementById('graphTitle'),
  graphSegSelect: document.getElementById('graphSegSelect'),
  graphSearch: document.getElementById('graphSearch'),
  graphReset: document.getElementById('graphReset'),
  graphSvg: document.getElementById('graphSvg'),
  graphSide: document.getElementById('graphSide'),
};
