// Overview/preview: all panels drawn together in one SVG, with their fold
// lines and (in chunk 2) seam connectors linking labeled edges.

import { STITCHES } from './stitches.js';
import { layout as flatLayout } from './grid.js';
import { layout as roundLayout } from './radial.js';

const GAP = 40;             // px between panels
const LABEL_H = 28;          // space above each panel for its name
const PREVIEW_CELL = 18;     // smaller cellSize for the preview

function escape(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// Layout a panel (at preview cellSize) and produce { svg, w, h, panel, bbox }.
// bbox has {top, bottom, left, right} edge midpoints in preview coords.
function renderPanelFragment(panel, fabricColor, stitchStyle = 'realistic') {
  const miniState = {
    cellSize: PREVIEW_CELL,
    fabricColor,
    mode: panel.mode,
    rows:   panel.rows,
    rounds: panel.rounds,
    stitchStyle,
  };

  let body = '';
  let w, h, edges;

  if (panel.mode === 'flat') {
    const laid = flatLayout(miniState);
    w = laid.width; h = laid.height;
    body += `<rect x="0" y="0" width="${w}" height="${h}" fill="${fabricColor}"/>`;
    for (const lr of laid.rows) {
      body += `<line x1="0" y1="${lr.baselineY}" x2="${w}" y2="${lr.baselineY}"
        stroke="#e8dccf" stroke-width="1" stroke-dasharray="2 3"/>`;
    }
    for (const lr of laid.rows) {
      for (const s of lr.stitches) {
        const color = s.placed.color || '#c084fc';
        body += s.def.renderSVG({
          bottomAnchors: s.bottomAnchors,
          topAnchors:    s.topAnchors,
          cellSize: PREVIEW_CELL,
          color,
          style: miniState.stitchStyle,
        });
      }
    }
    // Fold lines
    for (const f of panel.folds || []) {
      if (f.axis !== 'row') continue;
      const at = Math.max(0, Math.min(f.at, laid.rows.length));
      const y = at < laid.rows.length
        ? laid.rows[at].baselineY
        : laid.rows[laid.rows.length - 1].baselineY - PREVIEW_CELL;
      body += `<line x1="0" y1="${y}" x2="${w}" y2="${y}"
        stroke="#7c3aed" stroke-width="1.5" stroke-dasharray="6 3" opacity="0.75"/>`;
      body += `<text x="${w - 4}" y="${y - 3}" fill="#7c3aed" font-size="10"
        text-anchor="end" font-style="italic">${escape(f.label || 'fold')}</text>`;
    }
    edges = {
      top:    { x: w / 2, y: 0 },
      bottom: { x: w / 2, y: h },
      left:   { x: 0,     y: h / 2 },
      right:  { x: w,     y: h / 2 },
    };
  } else {
    const laid = roundLayout(miniState);
    w = laid.size; h = laid.size;
    body += `<rect x="0" y="0" width="${w}" height="${h}" fill="${fabricColor}"/>`;
    for (const r of laid.ringsLaid || []) {
      const op = r.lie === 'flat' ? 0.3 : 0.55;
      const stroke = r.lie === 'flat' ? '#d7cec7'
                   : r.lie === 'cup' ? '#e0ac3a' : '#ef4444';
      body += `<circle cx="${laid.cx}" cy="${laid.cy}" r="${r.outerR}"
        fill="none" stroke="${stroke}" stroke-width="1" opacity="${op}"/>`;
    }
    for (const ring of laid.ringsLaid) {
      for (const s of ring.stitches) {
        const color = s.placed.color || '#c084fc';
        body += s.def.renderSVG({
          bottomAnchors: s.bottomAnchors,
          topAnchors:    s.topAnchors,
          cellSize: PREVIEW_CELL,
          color,
          style: miniState.stitchStyle,
        });
      }
    }
    edges = {
      outer: { x: laid.cx + (laid.outerR || w / 2), y: laid.cy },
    };
  }

  // Edge label annotations on panel
  for (const eName of Object.keys(panel.edges || {})) {
    const label = panel.edges[eName];
    if (!label || !edges[eName]) continue;
    const p = edges[eName];
    const dx = eName === 'right' ? -6 : eName === 'left' ? 6 : 0;
    const dy = eName === 'top'   ? 14 : eName === 'bottom' ? -6 : 4;
    const anchor = eName === 'right' ? 'end'
                 : eName === 'left'  ? 'start'
                 : 'middle';
    body += `<text x="${p.x + dx}" y="${p.y + dy}" font-size="10"
      fill="#7f7168" text-anchor="${anchor}">${escape(label)}</text>`;
  }

  return { svg: body, w, h, panel, edges };
}

function arrangePanels(fragments) {
  // Simple wrapping flow by fixed wrap width.
  const WRAP_AT = 900;
  let rowW = 0;
  let rowH = 0;
  let maxW = 0;
  let yCursor = 0;
  const placements = [];

  for (const f of fragments) {
    const totalW = f.w;
    const totalH = f.h + LABEL_H;
    if (rowW > 0 && rowW + GAP + totalW > WRAP_AT) {
      // wrap
      yCursor += rowH + GAP;
      rowW = 0;
      rowH = 0;
    }
    const x = rowW === 0 ? 0 : rowW + GAP;
    const y = yCursor;
    placements.push({ fragment: f, x, y });
    rowW = x + totalW;
    rowH = Math.max(rowH, totalH);
    maxW = Math.max(maxW, rowW);
  }
  const totalHOut = yCursor + rowH;
  return { placements, width: maxW, height: totalHOut };
}

// Compute each edge's absolute coords (in the preview's global space) for
// each panel placement. Used by seam connectors in chunk 2.
function absoluteEdges(placements) {
  const byPanelId = {};
  for (const pl of placements) {
    const { fragment, x, y } = pl;
    const abs = {};
    for (const [name, pt] of Object.entries(fragment.edges)) {
      abs[name] = { x: pt.x + x, y: pt.y + y + LABEL_H };
    }
    byPanelId[fragment.panel.id] = abs;
  }
  return byPanelId;
}

function drawSeams(state, edgesByPanel) {
  const seams = state.seams || [];
  if (!seams.length) return '';
  let out = '';
  // Marker arrow head reused
  out += `<defs>
    <marker id="seam-arrow" viewBox="0 0 10 10" refX="8" refY="5"
      markerWidth="8" markerHeight="8" orient="auto-start-reverse">
      <path d="M0 0 L10 5 L0 10 Z" fill="#f25f4c"/>
    </marker>
  </defs>`;

  for (const s of seams) {
    const a = edgesByPanel[s.a?.panelId]?.[s.a?.edge];
    const b = edgesByPanel[s.b?.panelId]?.[s.b?.edge];
    if (!a || !b) continue;
    // Cubic bezier with control points pulled horizontally
    const dx = b.x - a.x, dy = b.y - a.y;
    const bend = Math.min(Math.hypot(dx, dy) * 0.35, 120);
    const c1 = { x: a.x + Math.sign(dx || 1) * bend, y: a.y };
    const c2 = { x: b.x - Math.sign(dx || 1) * bend, y: b.y };
    out += `<path d="M ${a.x} ${a.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${b.x} ${b.y}"
      fill="none" stroke="#f25f4c" stroke-width="1.5" stroke-dasharray="4 3"
      marker-end="url(#seam-arrow)" opacity="0.85"/>`;
    // Midpoint note
    if (s.note) {
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2 - 4;
      out += `<text x="${mx}" y="${my}" font-size="10" fill="#f25f4c"
        text-anchor="middle" font-style="italic">${escape(s.note)}</text>`;
    }
  }
  return out;
}

export function showPreviewModal(state) {
  document.getElementById('preview-modal')?.remove();

  const fabric = state.fabricColor || '#faf7f2';
  const fragments = state.panels.map(p => renderPanelFragment(p, fabric, state.stitchStyle || 'realistic'));
  const { placements, width, height } = arrangePanels(fragments);
  const edgesByPanel = absoluteEdges(placements);

  const padding = 16;
  const totalW = Math.max(width + padding * 2, 320);
  const totalH = Math.max(height + padding * 2, 200);

  let body = '';
  body += `<rect x="0" y="0" width="${totalW}" height="${totalH}" fill="#1a1825"/>`;
  body += drawSeams(state, Object.fromEntries(
    Object.entries(edgesByPanel).map(([id, edges]) => [
      id, Object.fromEntries(Object.entries(edges).map(([k, v]) => [k, { x: v.x + padding, y: v.y + padding }]))
    ])
  ));
  for (const pl of placements) {
    const { fragment: f, x, y } = pl;
    // Label
    body += `<text x="${x + padding}" y="${y + padding + 16}" font-size="13"
      fill="#c084fc" font-weight="600">${escape(f.panel.name)}
      <tspan fill="#a7a9be" font-weight="400"> · ${f.panel.mode}</tspan></text>`;
    // Panel group translated into place (below the label area).
    body += `<g transform="translate(${x + padding} ${y + padding + LABEL_H})">
      ${f.svg}
    </g>`;
  }

  const modal = document.createElement('div');
  modal.id = 'preview-modal';
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <div class="modal modal-wide" role="dialog" aria-labelledby="preview-title">
      <div class="modal-header">
        <h2 id="preview-title">Project Overview</h2>
        <button class="modal-close" aria-label="Close">✕</button>
      </div>
      <div class="preview-body">
        <svg viewBox="0 0 ${totalW} ${totalH}"
          width="${totalW}" height="${totalH}"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="xMidYMid meet">${body}</svg>
      </div>
      <div class="modal-footer">
        <button id="preview-download" class="tool-btn">Download SVG</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  modal.querySelector('.modal-close').addEventListener('click', close);

  modal.querySelector('#preview-download').addEventListener('click', () => {
    const svgEl = modal.querySelector('svg');
    const src = new XMLSerializer().serializeToString(svgEl);
    const full = `<?xml version="1.0" encoding="UTF-8"?>\n` + src;
    const blob = new Blob([full], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'project-overview.svg';
    a.click();
    URL.revokeObjectURL(url);
  });

  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
  });
}
