// Flat grid engine. Walks row-by-row, computes anchor positions, hands each
// stitch its bottomAnchors / topAnchors, then asks the stitch to render.

import { STITCHES } from './stitches.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const PADDING = 2;   // in cell-units, on each side of the grid

function escapeXml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// Small half-moon mark under the bottom anchor indicating FLO/BLO.
export function renderLoopMark(s, cellSize, color) {
  const loop = s.placed?.loop;
  if (!loop || loop === 'both') return '';
  const b = s.bottomAnchors[0];
  if (!b) return '';
  const r = cellSize * 0.16;
  const y = b.y + cellSize * 0.24;
  // FLO → half-moon opens upward (drawn as top half filled); BLO → opposite.
  if (loop === 'flo') {
    return `<path d="M ${b.x - r} ${y} A ${r} ${r} 0 0 1 ${b.x + r} ${y} Z"
      fill="${color}" opacity="0.85"/>`;
  }
  // BLO
  return `<path d="M ${b.x - r} ${y} A ${r} ${r} 0 0 0 ${b.x + r} ${y} Z"
    fill="none" stroke="${color}" stroke-width="${cellSize*0.08}"/>`;
}

// --- pure: layout ---

// rows[0] is the foundation; rows[i>0] builds on rows[i-1]. Each stitch is
// { id, color? }.
export function layout(state) {
  const { rows, cellSize } = state;
  if (!rows.length) return { rows: [], width: 0, height: 0 };

  // Foundation row produces top anchors spaced 1 cell apart.
  const foundation = rows[0];
  const foundationTopCount = foundation.reduce(
    (n, p) => n + (STITCHES[p.id]?.topAnchors ?? 1), 0
  );

  const leftPad = PADDING * cellSize;
  // height = total of max row heights + padding; foundation sits at the bottom.
  const rowHeights = rows.map((row, i) => {
    if (i === 0) return 1;
    return row.reduce((h, p) => Math.max(h, STITCHES[p.id]?.height ?? 1), 0) || 1;
  });
  const totalRowH = rowHeights.reduce((s, h) => s + h, 0);
  const height = (totalRowH + PADDING * 2) * cellSize;

  // Compute foundation anchor positions (top of foundation row).
  const laidRows = [];
  const warnings = [];

  // Baseline for row i: distance from the top.
  // foundation baseline = height - PADDING*cellSize (bottom of foundation)
  // foundation top anchors y = foundation baseline - rowHeights[0]*cellSize
  let baselineY = height - PADDING * cellSize;

  // Layout foundation
  const foundationLaid = [];
  let cursorX = leftPad;
  const foundationTopAnchors = [];
  for (const placed of foundation) {
    const def = STITCHES[placed.id];
    if (!def) continue;
    const bY = baselineY;
    const tY = baselineY - def.height * cellSize;
    // Foundation stitches have baseAnchors=1 (conceptual) but no row below to
    // attach to — we give them a synthetic bottom anchor aligned with the top.
    const width = Math.max(def.topAnchors, def.baseAnchors, 1) * cellSize;
    const left = cursorX;
    const right = cursorX + width;

    const bottomAnchors = [];
    for (let i = 0; i < (def.baseAnchors || 1); i++) {
      const f = (def.baseAnchors || 1) === 1 ? 0.5 : i / (def.baseAnchors - 1);
      bottomAnchors.push({ x: left + f * width, y: bY });
    }
    const topAnchors = [];
    for (let i = 0; i < def.topAnchors; i++) {
      const f = def.topAnchors === 1 ? 0.5 : i / (def.topAnchors - 1);
      topAnchors.push({ x: left + f * width, y: tY });
    }
    foundationLaid.push({ placed, def, bottomAnchors, topAnchors });
    foundationTopAnchors.push(...topAnchors);
    cursorX += width;
  }
  laidRows.push({ stitches: foundationLaid, valid: true, baselineY });
  baselineY -= rowHeights[0] * cellSize;

  // Subsequent rows
  let prevTops = foundationTopAnchors;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rowH = rowHeights[i];
    const bY = baselineY;                   // this row's bottom
    const tY = baselineY - rowH * cellSize; // this row's top

    let baseCursor = 0;
    const laid = [];
    const thisTops = [];
    for (const placed of row) {
      const def = STITCHES[placed.id];
      if (!def) continue;
      const baseN = def.baseAnchors;
      const topN  = def.topAnchors;

      // Consume baseN anchors from prev row
      const bottomAnchorsRaw = prevTops.slice(baseCursor, baseCursor + baseN);
      baseCursor += baseN;

      // If prev row is short, synthesize trailing anchors so we can still render
      const bottomAnchors = [...bottomAnchorsRaw];
      while (bottomAnchors.length < baseN) {
        const lastX = bottomAnchors.length
          ? bottomAnchors[bottomAnchors.length - 1].x
          : (prevTops.at(-1)?.x ?? leftPad);
        bottomAnchors.push({ x: lastX + cellSize, y: bY });
      }
      // Clamp all bottoms to this row's bY (robustness)
      for (const b of bottomAnchors) b.y = bY;

      // Footprint: horizontal extent of the stitch at this row
      let left, right;
      if (baseN > 0) {
        left  = bottomAnchors[0].x;
        right = bottomAnchors[bottomAnchors.length - 1].x;
        // Decrease collapses horizontally → give it at least a min width
        if (right - left < cellSize * 0.001) {
          left -= cellSize * 0.5;
          right += cellSize * 0.5;
        }
      } else {
        // No base (e.g. magic ring) — anchor from prev cursor
        const baseX = prevTops.at(-1)?.x ?? leftPad;
        left = baseX;
        right = baseX + Math.max(topN - 1, 0) * cellSize;
      }

      const topAnchors = [];
      for (let k = 0; k < topN; k++) {
        const f = topN === 1 ? 0.5 : k / (topN - 1);
        topAnchors.push({ x: left + f * (right - left), y: tY });
      }

      laid.push({ placed, def, bottomAnchors, topAnchors });
      thisTops.push(...topAnchors);
    }

    const valid = baseCursor === prevTops.length;
    if (!valid) {
      warnings.push({
        row: i,
        consumed: baseCursor,
        available: prevTops.length,
        delta: prevTops.length - baseCursor
      });
    }
    laidRows.push({ stitches: laid, valid, baselineY: bY });
    baselineY -= rowH * cellSize;
    prevTops = thisTops;
  }

  // Width: widest row extent
  let width = 0;
  for (const lr of laidRows) {
    for (const s of lr.stitches) {
      for (const a of [...s.bottomAnchors, ...s.topAnchors]) {
        if (a.x + cellSize > width) width = a.x + cellSize;
      }
    }
  }
  width += leftPad;

  return { rows: laidRows, width, height, warnings };
}

// --- render: SVG string -> DOM ---

export function render(canvas, state) {
  const laid = layout(state);
  canvas.setAttribute('viewBox', `0 0 ${laid.width} ${laid.height}`);
  canvas.setAttribute('width',  laid.width);
  canvas.setAttribute('height', laid.height);

  let out = '';

  // Background + grid guides
  const fabric = state.fabricColor || '#faf7f2';
  out += `<rect x="0" y="0" width="${laid.width}" height="${laid.height}" fill="${fabric}"/>`;

  // Row baselines
  for (let i = 0; i < laid.rows.length; i++) {
    const r = laid.rows[i];
    out += `<line class="row-baseline" x1="0" y1="${r.baselineY}" x2="${laid.width}" y2="${r.baselineY}"/>`;
    out += `<text class="row-label" x="6" y="${r.baselineY - 4}">R${i}${r.valid ? '' : ' ⚠'}</text>`;
  }

  // Fold lines on the active panel (flat only): horizontal between rows.
  const panel = window.__constellation__?.state
    ? window.__constellation__.state.panels[window.__constellation__.state.activePanelIdx]
    : null;
  const folds = panel?.folds ?? [];
  for (const f of folds) {
    if (f.axis !== 'row') continue;   // row folds only for flat mode
    const at = Math.max(0, Math.min(f.at, laid.rows.length));
    // Line between row (at-1) and row (at), so y = row at's baseline (which is row at's bottom)
    const y = at < laid.rows.length
      ? laid.rows[at].baselineY
      : laid.rows[laid.rows.length - 1].baselineY - state.cellSize;  // fold above last row
    out += `<line x1="0" y1="${y}" x2="${laid.width}" y2="${y}"
      stroke="#7c3aed" stroke-width="2" stroke-dasharray="8 4" opacity="0.7"/>`;
    out += `<text x="${laid.width - 8}" y="${y - 4}"
      fill="#7c3aed" font-size="11" text-anchor="end" style="font-style:italic;">
      ${escapeXml(f.label || 'fold')}</text>`;
  }

  // Invalid row underlines
  for (let i = 0; i < laid.rows.length; i++) {
    if (!laid.rows[i].valid) {
      out += `<line class="row-invalid" x1="0" y1="${laid.rows[i].baselineY + 1}"
        x2="${laid.width}" y2="${laid.rows[i].baselineY + 1}"/>`;
    }
  }

  // Row click targets (below baseline) for appending/selecting
  for (let i = 0; i < laid.rows.length; i++) {
    const r = laid.rows[i];
    const top = i === laid.rows.length - 1 ? 0 : laid.rows[i + 1].baselineY;
    out += `<rect class="row-click-target" data-row="${i}"
      x="0" y="${top}" width="${laid.width}" height="${r.baselineY - top}"/>`;
  }

  // Stitches
  for (let i = 0; i < laid.rows.length; i++) {
    for (let j = 0; j < laid.rows[i].stitches.length; j++) {
      const s = laid.rows[i].stitches[j];
      const color = s.placed.color || state.selectedColor || '#c084fc';
      const frag = s.def.renderSVG({
        bottomAnchors: s.bottomAnchors,
        topAnchors:    s.topAnchors,
        cellSize:      state.cellSize,
        color,
      });
      const loopMark = renderLoopMark(s, state.cellSize, color);
      // Bounding box hit target for delete/hover
      const xs = [...s.bottomAnchors, ...s.topAnchors].map(a => a.x);
      const ys = [...s.bottomAnchors, ...s.topAnchors].map(a => a.y);
      const xMin = Math.min(...xs) - state.cellSize * 0.25;
      const xMax = Math.max(...xs) + state.cellSize * 0.25;
      const yMin = Math.min(...ys) - state.cellSize * 0.15;
      const yMax = Math.max(...ys) + state.cellSize * 0.15;
      out += `<g class="stitch" data-row="${i}" data-index="${j}">
        <rect class="stitch-bg" x="${xMin}" y="${yMin}"
          width="${xMax - xMin}" height="${yMax - yMin}" rx="3"
          fill="transparent"/>
        ${frag}${loopMark}
      </g>`;
    }
  }

  canvas.innerHTML = out;
  return laid;
}
