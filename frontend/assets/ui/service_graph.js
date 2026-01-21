// ФАЙЛ: frontend/assets/ui/service_graph.js
// ------------------------------------------------------------
// «Матрица услуг» в виде графа (паутина).
// Источник данных: data.json -> segments[SEGMENT] -> packages[*].detail
//
// Идея: строим связи Пакет -> Работа(строка из detail).
// Если одна и та же работа встречается в нескольких пакетах — видно пересечение.
// ------------------------------------------------------------

import { el } from '../dom.js';
import { getDataSync } from '../data.js';
import { fmtRub, splitToBullets } from '../helpers.js';
import { state } from '../state.js';

let _graph = null;

export function initServiceGraphModal() {
  if (!el.graphBack) return;

  // закрытие по крестику
  if (el.graphClose) el.graphClose.onclick = () => (el.graphBack.style.display = 'none');

  // закрытие по клику на фон
  el.graphBack.onclick = (e) => {
    if (e.target === el.graphBack) el.graphBack.style.display = 'none';
  };

  // сброс
  if (el.graphReset) el.graphReset.onclick = () => {
    if (el.graphSearch) el.graphSearch.value = '';
    if (el.graphSegSelect) {
      // вернём авто-режим
      el.graphSegSelect.value = '__auto__';
    }
    if (_graph) _graph.rebuild({ highlightPackage: _graph.highlightPackage || '' });
  };

  // фильтр сегмента
  if (el.graphSegSelect) {
    el.graphSegSelect.onchange = () => {
      if (_graph) _graph.rebuild({ highlightPackage: _graph.highlightPackage || '' });
    };
  }

  // поиск
  if (el.graphSearch) {
    el.graphSearch.oninput = () => {
      if (_graph) _graph.rebuild({ highlightPackage: _graph.highlightPackage || '' });
    };
  }
}

/**
 * Открыть модалку графа.
 * @param {{highlightPackage?:string, preferSegment?:string}} opts
 */
export function openServiceGraphModal(opts = {}) {
  if (!el.graphBack) return;
  if (el.graphTitle) el.graphTitle.textContent = 'Матрица услуг — граф';

  // заполнить селект сегментов
  const DATA = getDataSync();
  const segNames = Object.keys(DATA.segments || {});
  if (el.graphSegSelect && !el.graphSegSelect.dataset.filled) {
    const sel = el.graphSegSelect;
    sel.innerHTML = '';
    const mk = (v, t) => {
      const o = document.createElement('option');
      o.value = v; o.textContent = t;
      return o;
    };
    sel.appendChild(mk('__auto__', 'Авто (по чек‑листу)'));
    sel.appendChild(mk('__all__', 'Все сегменты'));
    segNames.forEach(s => sel.appendChild(mk(s, s)));
    sel.dataset.filled = '1';
  }

  // авто-сегмент: если выбран один в чек-листе — берём его
  const autoSeg = (Array.isArray(state.segments) && state.segments.length === 1) ? state.segments[0] : '';
  if (el.graphSegSelect) {
    if (!el.graphSegSelect.value) el.graphSegSelect.value = '__auto__';
    if (opts.preferSegment) el.graphSegSelect.value = opts.preferSegment;
  }

  // создать/пересоздать граф
  if (!_graph) _graph = new ServiceGraph();
  _graph.highlightPackage = String(opts.highlightPackage || '');
  _graph.rebuild({ autoSeg });

  el.graphBack.style.display = 'flex';
}

/* -------------------- Реализация графа -------------------- */

class ServiceGraph {
  constructor() {
    this.svg = el.graphSvg;
    this.side = el.graphSide;
    this.highlightPackage = '';
    this._raf = 0;

    // pan/zoom state
    this.t = { x: 0, y: 0, k: 1 };
    this._pan = { active: false, sx: 0, sy: 0, ox: 0, oy: 0 };
    this._dragNode = null;

    this._wirePanZoom();
  }

  rebuild({ autoSeg = '', highlightPackage = '' } = {}) {
    if (!this.svg) return;
    if (highlightPackage !== undefined) this.highlightPackage = highlightPackage;

    const DATA = getDataSync();
    const filterSeg = this._getSelectedSegment(autoSeg);
    const q = (el.graphSearch?.value || '').trim().toLowerCase();

    const { nodes, links, meta } = buildGraphData(DATA, filterSeg, q);

    this.meta = meta;
    this.nodes = nodes;
    this.links = links;

    // заново центр/зум
    this.t = { x: 0, y: 0, k: 1 };
    this._render();
    this._startSim();
    this._renderSideHint(filterSeg, q);
  }

  _getSelectedSegment(autoSeg) {
    const v = el.graphSegSelect?.value || '__auto__';
    if (v === '__auto__') return autoSeg || '__all__';
    return v;
  }

  _renderSideHint(seg, q) {
    if (!this.side) return;
    const segTxt = seg === '__all__' ? 'Все сегменты' : seg || 'Авто';
    const qTxt = q ? ` • фильтр: “${escapeHtml(q)}”` : '';
    this.side.innerHTML = `<div class="small" style="opacity:.85;">Сегмент: <b>${escapeHtml(segTxt)}</b>${qTxt}</div>
      <div class="small" style="opacity:.75;margin-top:6px;">Клик по узлу покажет детали.</div>`;
  }

  _wirePanZoom() {
    if (!this.svg) return;

    // wheel zoom
    this.svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = Math.sign(e.deltaY);
      const k = this.t.k;
      const factor = delta > 0 ? 0.92 : 1.08;
      const nk = clamp(k * factor, 0.45, 2.6);

      // zoom about mouse
      const pt = this._screenToWorld(e.offsetX, e.offsetY);
      // adjust translation so that point stays under cursor
      this.t.k = nk;
      const npt = this._screenToWorld(e.offsetX, e.offsetY);
      this.t.x += (npt.x - pt.x) * nk;
      this.t.y += (npt.y - pt.y) * nk;

      this._applyTransform();
    }, { passive: false });

    // pan background
    this.svg.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      // ignore if node drag started
      if (e.target && e.target.dataset && e.target.dataset.nodeId) return;

      this._pan.active = true;
      this._pan.sx = e.clientX;
      this._pan.sy = e.clientY;
      this._pan.ox = this.t.x;
      this._pan.oy = this.t.y;
    });

    window.addEventListener('mousemove', (e) => {
      if (this._dragNode) {
        const w = this._clientToWorld(e.clientX, e.clientY);
        this._dragNode.x = w.x;
        this._dragNode.y = w.y;
        this._render(); // быстрый отклик
        return;
      }
      if (!this._pan.active) return;
      this.t.x = this._pan.ox + (e.clientX - this._pan.sx);
      this.t.y = this._pan.oy + (e.clientY - this._pan.sy);
      this._applyTransform();
    });

    window.addEventListener('mouseup', () => {
      this._pan.active = false;
      this._dragNode = null;
    });
  }

  _clientToWorld(cx, cy) {
    const rect = this.svg.getBoundingClientRect();
    return this._screenToWorld(cx - rect.left, cy - rect.top);
  }

  _screenToWorld(sx, sy) {
    // inverse of translate then scale
    const k = this.t.k || 1;
    return { x: (sx - this.t.x) / k, y: (sy - this.t.y) / k };
  }

  _applyTransform() {
    const g = this.svg.querySelector('g[data-graph-root="1"]');
    if (!g) return;
    g.setAttribute('transform', `translate(${this.t.x},${this.t.y}) scale(${this.t.k})`);
  }

  _render() {
    cancelAnimationFrame(this._raf);

    const svg = this.svg;
    svg.innerHTML = '';

    // defs (стрелки не нужны, но сделаем легкий glow)
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
      <filter id="nodeGlow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="2.2" result="b"/>
        <feMerge>
          <feMergeNode in="b"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    `;
    svg.appendChild(defs);

    const root = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    root.dataset.graphRoot = '1';
    svg.appendChild(root);

    // apply transform
    this._applyTransform();

    // links
    const linkG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    root.appendChild(linkG);

    // nodes
    const nodeG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    root.appendChild(nodeG);

    // draw links
    for (const L of this.links) {
      const a = this.nodesById[L.source];
      const b = this.nodesById[L.target];
      if (!a || !b) continue;
      const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      ln.setAttribute('x1', a.x.toFixed(2));
      ln.setAttribute('y1', a.y.toFixed(2));
      ln.setAttribute('x2', b.x.toFixed(2));
      ln.setAttribute('y2', b.y.toFixed(2));
      ln.setAttribute('stroke', 'rgba(255,255,255,.16)');
      ln.setAttribute('stroke-width', '1');
      linkG.appendChild(ln);
    }

    // draw nodes
    for (const n of this.nodes) {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.dataset.nodeId = n.id;

      const r = n.type === 'pkg' ? 12 : 7;
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', n.x.toFixed(2));
      c.setAttribute('cy', n.y.toFixed(2));
      c.setAttribute('r', r);
      c.setAttribute('filter', 'url(#nodeGlow)');

      // цветовые акценты
      const isHi = this.highlightPackage && n.type === 'pkg' && n.label === this.highlightPackage;
      const fill = n.type === 'pkg'
        ? (isHi ? 'rgba(83, 222, 170, .95)' : 'rgba(255,255,255,.42)')
        : 'rgba(255,255,255,.22)';
      const stroke = n.type === 'pkg'
        ? (isHi ? 'rgba(83, 222, 170, 1)' : 'rgba(255,255,255,.25)')
        : 'rgba(255,255,255,.18)';

      c.setAttribute('fill', fill);
      c.setAttribute('stroke', stroke);
      c.setAttribute('stroke-width', isHi ? '2.2' : '1.2');

      // label только для пакетов (чтобы не превращалось в кашу)
      if (n.type === 'pkg') {
        const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        t.setAttribute('x', (n.x + 16).toFixed(2));
        t.setAttribute('y', (n.y + 4).toFixed(2));
        t.setAttribute('fill', 'rgba(255,255,255,.86)');
        t.setAttribute('font-size', '12');
        t.setAttribute('font-family', 'system-ui, -apple-system, Segoe UI, Roboto, Arial');
        t.textContent = n.label;
        nodeG.appendChild(t);
      }

      // handlers
      g.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        if (e.button !== 0) return;
        this._dragNode = n;
      });

      g.addEventListener('click', (e) => {
        e.stopPropagation();
        this._selectNode(n.id);
      });

      g.appendChild(c);
      nodeG.appendChild(g);
    }

    // cache lookup for next render
    this._raf = requestAnimationFrame(() => {});
  }

  _selectNode(nodeId) {
    const n = this.nodesById?.[nodeId];
    if (!n) return;

    if (n.type === 'pkg') {
      const pkg = this.meta.packagesById[n.pkgId];
      const works = this.meta.pkgToWorks[n.pkgId] || [];
      const pills = works.slice(0, 120).map(w => `<span class="graphPill">${escapeHtml(w)}</span>`).join('');
      this.side.innerHTML = `
        <h4>${escapeHtml(pkg.name)}</h4>
        <div class="small" style="opacity:.85;">Сегмент: <b>${escapeHtml(pkg.segment)}</b></div>
        <div class="small" style="opacity:.85;margin-top:4px;">Цена: <b>${escapeHtml(fmtRub(pkg.price || 0))}</b></div>
        ${pkg.who ? `<div class="small" style="opacity:.8;margin-top:6px;">Для кого: ${escapeHtml(pkg.who)}</div>` : ''}
        <div class="small" style="opacity:.85;margin-top:10px;">Что входит (по detail):</div>
        <div class="graphPills">${pills || '<div class="small" style="opacity:.75;">Нет detail</div>'}</div>
      `;
    } else {
      const work = n.label;
      const pkgs = this.meta.workToPkgs[work] || [];
      const pills = pkgs.map(pid => {
        const p = this.meta.packagesById[pid];
        const isHi = this.highlightPackage && p?.name === this.highlightPackage;
        return `<span class="graphPill" style="${isHi ? 'border-color: rgba(83,222,170,.55); box-shadow: 0 0 0 2px rgba(83,222,170,.15) inset;' : ''}">${escapeHtml(p?.name || '—')}</span>`;
      }).join('');
      this.side.innerHTML = `
        <h4>Работа</h4>
        <div class="small" style="opacity:.92;">${escapeHtml(work)}</div>
        <div class="small" style="opacity:.85;margin-top:10px;">Встречается в пакетах:</div>
        <div class="graphPills">${pills || '<div class="small" style="opacity:.75;">Не найдено</div>'}</div>
      `;
    }
  }

  _startSim() {
    // начальная раскладка
    const nodes = this.nodes;
    const links = this.links;

    // build fast maps
    this.nodesById = Object.fromEntries(nodes.map(n => [n.id, n]));
    const linkPairs = links.map(l => [this.nodesById[l.source], this.nodesById[l.target]]).filter(x => x[0] && x[1]);

    const W = 1200, H = 720;
    // init positions
    const pkgs = nodes.filter(n => n.type === 'pkg');
    const works = nodes.filter(n => n.type === 'work');

    const cx = W/2, cy = H/2;
    const R = Math.min(W, H) * 0.33;

    pkgs.forEach((n, i) => {
      const a = (i / Math.max(1, pkgs.length)) * Math.PI * 2;
      n.x = cx + Math.cos(a) * R;
      n.y = cy + Math.sin(a) * R;
      n.vx = 0; n.vy = 0;
    });
    works.forEach((n) => {
      n.x = cx + (Math.random() - 0.5) * R * 0.9;
      n.y = cy + (Math.random() - 0.5) * R * 0.9;
      n.vx = 0; n.vy = 0;
    });

    // simulation loop
    const steps = 360; // ~6 сек на 60fps
    let step = 0;

    const tick = () => {
      step++;

      // repulsion
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i+1; j < nodes.length; j++) {
          const b = nodes[j];
          let dx = a.x - b.x;
          let dy = a.y - b.y;
          let d2 = dx*dx + dy*dy + 0.01;
          const min = (a.type === 'pkg' ? 26 : 18) + (b.type === 'pkg' ? 26 : 18);
          const k = 1300; // strength
          const f = k / d2;
          if (Math.sqrt(d2) < min) {
            // extra push if too close
            const push = (min - Math.sqrt(d2)) * 0.6;
            dx += (Math.random()-0.5)*0.01; dy += (Math.random()-0.5)*0.01;
            a.vx += (dx / Math.sqrt(d2)) * push;
            a.vy += (dy / Math.sqrt(d2)) * push;
            b.vx -= (dx / Math.sqrt(d2)) * push;
            b.vy -= (dy / Math.sqrt(d2)) * push;
          }
          a.vx += dx * f * 0.001;
          a.vy += dy * f * 0.001;
          b.vx -= dx * f * 0.001;
          b.vy -= dy * f * 0.001;
        }
      }

      // springs
      for (const [a, b] of linkPairs) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx*dx + dy*dy) + 0.001;
        const target = 78; // spring length
        const k = 0.015;
        const f = (dist - target) * k;
        const nx = dx / dist, ny = dy / dist;
        a.vx += nx * f;
        a.vy += ny * f;
        b.vx -= nx * f;
        b.vy -= ny * f;
      }

      // centering
      for (const n of nodes) {
        const dx = (cx - n.x) * 0.0009;
        const dy = (cy - n.y) * 0.0009;
        n.vx += dx; n.vy += dy;
      }

      // integrate
      const damp = 0.86;
      for (const n of nodes) {
        if (this._dragNode === n) {
          n.vx = 0; n.vy = 0;
          continue;
        }
        n.vx *= damp;
        n.vy *= damp;
        n.x += n.vx;
        n.y += n.vy;

        // keep in bounds
        n.x = clamp(n.x, 30, W-30);
        n.y = clamp(n.y, 30, H-30);
      }

      this._render();

      if (step < steps) {
        requestAnimationFrame(tick);
      }
    };

    requestAnimationFrame(tick);
  }
}

/* -------------------- data builder -------------------- */

function buildGraphData(DATA, segFilter, q) {
  const segments = DATA.segments || {};
  const nodes = [];
  const links = [];
  const packagesById = {};
  const pkgToWorks = {};
  const workToPkgs = {};

  const pickSegments = () => {
    if (!segFilter || segFilter === '__all__') return Object.keys(segments);
    if (segments[segFilter]) return [segFilter];
    return Object.keys(segments);
  };

  const segs = pickSegments();

  // packages
  let pkgIndex = 0;
  for (const seg of segs) {
    const pkgs = Array.isArray(segments[seg]) ? segments[seg] : [];
    for (const p of pkgs) {
      const pkgId = `pkg_${pkgIndex++}`;
      const pkg = { ...p, segment: seg, _id: pkgId };
      packagesById[pkgId] = pkg;

      const works = extractWorks(p.detail);
      const filteredWorks = q ? works.filter(w => w.toLowerCase().includes(q)) : works;

      // если есть поиск и пакет без подходящих работ — можно всё равно показать пакет (чтобы не терять контекст),
      // но без линков он будет "пустой". Оставим его, но это норм.
      pkgToWorks[pkgId] = filteredWorks;

      nodes.push({ id: `n_${pkgId}`, type: 'pkg', label: pkg.name || `Пакет ${pkgIndex}`, pkgId, x: 0, y: 0, vx: 0, vy: 0 });

      for (const w of filteredWorks) {
        const key = w; // нормализованный текст
        const wid = `work_${hashKey(key)}`;

        if (!workToPkgs[key]) workToPkgs[key] = [];
        if (!workToPkgs[key].includes(pkgId)) workToPkgs[key].push(pkgId);

        links.push({ source: `n_${pkgId}`, target: `n_${wid}` });

        if (!nodes.find(n => n.id === `n_${wid}`)) {
          nodes.push({ id: `n_${wid}`, type: 'work', label: key, workKey: key, x: 0, y: 0, vx: 0, vy: 0 });
        }
      }
    }
  }

  // also build work->packages by key
  const workToPkgsByText = {};
  for (const [k, arr] of Object.entries(workToPkgs)) workToPkgsByText[k] = arr;

  return {
    nodes,
    links,
    meta: {
      packagesById,
      pkgToWorks,
      workToPkgs: workToPkgsByText
    }
  };
}

function extractWorks(detail) {
  if (!detail) return [];
  // в проекте уже есть splitToBullets, он умеет вытаскивать «• ...»
  const arr = splitToBullets(String(detail));
  const cleaned = arr
    .map(x => String(x).replace(/^[-•\s]+/g, '').trim())
    .filter(Boolean);

  // убираем дубли в рамках одного пакета
  const seen = new Set();
  const out = [];
  for (const w of cleaned) {
    const k = w;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

function hashKey(s) {
  // короткий стабильный hash (не крипто)
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h.toString(16);
}

function clamp(x, a, b) {
  return Math.max(a, Math.min(b, x));
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
