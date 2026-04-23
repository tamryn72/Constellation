// Round mode. Same anchor-and-leg model as flat, but x-positions become
// angles around a center and "row baseline y" becomes a radius.

import { STITCHES } from './stitches.js';
import { renderLoopMark } from './grid.js';

const RING_GAP = 0.15;    // fraction of cellSize to leave between rings
const PAD = 1.5;          // cell-units of padding around the outermost ring

// Flat-lay tolerance. If actualCount / idealCount is in this band, the round
// will lie flat. Outside → ruffles (too many) or cups (too few).
const FLAT_TOLERANCE = 0.15;

// Ideal stitch count for a round at outer radius r, so that each stitch
// occupies one cellSize of arc: circumference / cellSize = 2π·r / cellSize.
function idealStitchCount(outerR, cellSize) {
  if (outerR <= 0) return 0;
  return Math.round((2 * Math.PI * outerR) / cellSize);
}

function lieStatus(actual, ideal) {
  if (ideal === 0) return 'flat';
  const ratio = actual / ideal;
  if (ratio > 1 + FLAT_TOLERANCE) return 'ruffle';
  if (ratio < 1 - FLAT_TOLERANCE) return 'cup';
  return 'flat';
}

// --- layout ---

export function layout(state) {
  const { rounds, cellSize } = state;
  const warnings = [];

  if (!rounds.length) return { ringsLaid: [], size: 400, warnings };

  // Figure out each round's ring height (max stitch height in that round).
  const ringHeights = rounds.map((round, i) => {
    if (i === 0) return 1;    // center (magic ring) takes 1 ring
    return round.reduce((h, p) => Math.max(h, STITCHES[p.id]?.height ?? 1), 0) || 1;
  });

  // Cumulative radii: round i occupies the band from innerR to outerR.
  const radii = [0];
  for (let i = 0; i < rounds.length; i++) {
    radii.push(radii[i] + ringHeights[i] * cellSize);
  }
  const outerR = radii[radii.length - 1];
  const size = (outerR + PAD * cellSize) * 2;
  const cx = size / 2, cy = size / 2;

  // --- Round 0 (center) ---
  // Usually magic_ring: baseAnchors=0, topAnchors=N.
  const center = rounds[0];
  const centerLaid = [];
  let prevTops = [];   // angles in radians
  for (const placed of center) {
    const def = STITCHES[placed.id];
    if (!def) continue;
    const topN = def.topAnchors;
    const innerR = radii[0];
    const outerRing = radii[1] - RING_GAP * cellSize;
    const topAnchors = [];
    const topAngles = [];
    for (let k = 0; k < topN; k++) {
      const a = (k + 0.5) * (2 * Math.PI / topN) - Math.PI / 2;
      topAngles.push(a);
      topAnchors.push({ x: cx + Math.cos(a) * outerRing, y: cy + Math.sin(a) * outerRing });
    }
    // Magic ring has no real bottom anchors — use a tiny ring at the center
    const bottomAnchors = topAnchors.map(t => ({ x: cx, y: cy }));
    centerLaid.push({ placed, def, bottomAnchors, topAnchors, angles: topAngles });
    prevTops.push(...topAngles);
  }

  // Round 0 (magic ring) — circumference measurement applies at its OUTER radius
  const centerActual = centerLaid.reduce((n, s) => n + (s.def.topAnchors ?? 1), 0);
  const centerIdeal = idealStitchCount(radii[1], cellSize);
  const ringsLaid = [{
    stitches: centerLaid,
    innerR: radii[0],
    outerR: radii[1],
    valid: true,
    actualCount: centerActual,
    idealCount: centerIdeal,
    lie: lieStatus(centerActual, centerIdeal),
  }];

  // --- Subsequent rounds ---
  for (let i = 1; i < rounds.length; i++) {
    const round = rounds[i];
    const innerR = radii[i] + (RING_GAP * cellSize) / 2;
    const outerRingR = radii[i + 1] - (RING_GAP * cellSize) / 2;

    // Total top anchors this round — determines angular spacing of THIS round's tops.
    const totalTopN = round.reduce((n, p) => n + (STITCHES[p.id]?.topAnchors ?? 1), 0);
    const dθ = totalTopN > 0 ? (2 * Math.PI / totalTopN) : 0;

    const totalBaseN = round.reduce((n, p) => n + (STITCHES[p.id]?.baseAnchors ?? 1), 0);
    const valid = totalBaseN === prevTops.length;
    if (!valid) {
      warnings.push({
        round: i,
        consumed: totalBaseN,
        available: prevTops.length,
        delta: prevTops.length - totalBaseN,
      });
    }

    const laid = [];
    const thisTops = [];
    let baseCursor = 0;
    let topCursor = 0;
    for (const placed of round) {
      const def = STITCHES[placed.id];
      if (!def) continue;
      const baseN = def.baseAnchors;
      const topN = def.topAnchors;

      // Bottom angles consumed from previous round's top angles
      const baseAngles = [];
      for (let k = 0; k < baseN; k++) {
        baseAngles.push(prevTops[baseCursor + k] ?? (prevTops.at(-1) ?? 0) + (k + 1) * 0.1);
      }
      baseCursor += baseN;

      // Top angles: evenly spaced slots in this round
      const topAngles = [];
      for (let k = 0; k < topN; k++) {
        topAngles.push((topCursor + k + 0.5) * dθ - Math.PI / 2);
      }
      topCursor += topN;
      thisTops.push(...topAngles);

      const bottomAnchors = baseAngles.map(a => ({
        x: cx + Math.cos(a) * innerR,
        y: cy + Math.sin(a) * innerR,
      }));
      const topAnchors = topAngles.map(a => ({
        x: cx + Math.cos(a) * outerRingR,
        y: cy + Math.sin(a) * outerRingR,
      }));

      laid.push({ placed, def, bottomAnchors, topAnchors, angles: topAngles });
    }
    const idealCount = idealStitchCount(outerRingR, cellSize);
    ringsLaid.push({
      stitches: laid,
      innerR,
      outerR: outerRingR,
      valid,
      actualCount: totalTopN,
      idealCount,
      lie: lieStatus(totalTopN, idealCount),
    });
    prevTops = thisTops;
  }

  // Summary of flat-lay status for the UI.
  const flatLay = ringsLaid.slice(1).map((r, i) => ({
    round: i + 1,
    actual: r.actualCount,
    ideal: r.idealCount,
    delta: r.actualCount - r.idealCount,
    lie: r.lie,
  }));

  return { ringsLaid, size, cx, cy, outerR, warnings, flatLay };
}

// --- render ---

export function render(canvas, state) {
  const laid = layout(state);
  canvas.setAttribute('viewBox', `0 0 ${laid.size} ${laid.size}`);
  canvas.setAttribute('width',  laid.size);
  canvas.setAttribute('height', laid.size);

  let out = '';

  // Background
  const fabric = state.fabricColor || '#faf7f2';
  out += `<rect x="0" y="0" width="${laid.size}" height="${laid.size}" fill="${fabric}"/>`;

  // Concentric ring guides, color-coded by flat-lay status
  const LIE_COLORS = { flat: '#2cb67d', cup: '#e0ac3a', ruffle: '#ef4444' };
  const LIE_ICON   = { flat: '·',       cup: '▼',       ruffle: '▲'      };
  const LIE_HINT   = {
    flat: 'lies flat',
    cup: 'too few → cups up',
    ruffle: 'too many → ruffles'
  };

  if (laid.ringsLaid) {
    for (let i = 0; i < laid.ringsLaid.length; i++) {
      const r = laid.ringsLaid[i];
      const guideColor = r.idealCount === 0 ? '#d7cec7' : LIE_COLORS[r.lie];
      const guideOp = r.lie === 'flat' ? 0.35 : 0.6;
      out += `<circle cx="${laid.cx}" cy="${laid.cy}" r="${r.outerR}"
        fill="none" stroke="${guideColor}" stroke-width="1.25" opacity="${guideOp}"/>`;

      // Optional dashed "ideal circumference" ring for non-flat rounds
      if (r.idealCount > 0 && r.lie !== 'flat') {
        const idealR = r.actualCount > 0 ? (r.actualCount * state.cellSize) / (2 * Math.PI) : 0;
        if (idealR > 0 && Math.abs(idealR - r.outerR) > 2) {
          out += `<circle cx="${laid.cx}" cy="${laid.cy}" r="${idealR}"
            fill="none" stroke="${LIE_COLORS[r.lie]}" stroke-width="1"
            stroke-dasharray="3 4" opacity="0.55"/>`;
        }
      }

      // Per-ring label: "R2  12/18 ▼ cups"
      if (i > 0 && r.idealCount > 0) {
        const delta = r.actualCount - r.idealCount;
        const deltaStr = delta === 0 ? '' : (delta > 0 ? ` (+${delta})` : ` (${delta})`);
        out += `<text class="row-label" x="${laid.cx + 6}" y="${laid.cy - r.outerR + 13}"
          fill="${LIE_COLORS[r.lie]}">R${i} · ${r.actualCount}/${r.idealCount}${deltaStr} ${LIE_ICON[r.lie]}</text>`;
      } else {
        out += `<text class="row-label" x="${laid.cx + 6}" y="${laid.cy - r.outerR + 13}">R${i}${r.valid ? '' : ' ⚠'}</text>`;
      }
    }
  }

  // Invalid-round highlight (red dashed ring)
  for (let i = 0; i < (laid.ringsLaid?.length || 0); i++) {
    const r = laid.ringsLaid[i];
    if (!r.valid) {
      out += `<circle cx="${laid.cx}" cy="${laid.cy}" r="${r.outerR - 2}"
        fill="none" stroke="#ef4444" stroke-width="2" stroke-dasharray="4 3" opacity="0.7"/>`;
    }
  }

  // Click targets: annular sectors per round. Kept simple as an annulus
  // (whole-ring) — clicking anywhere in the ring selects it as active.
  for (let i = 0; i < (laid.ringsLaid?.length || 0); i++) {
    const r = laid.ringsLaid[i];
    // Annulus path: outer circle - inner circle
    out += `<path class="row-click-target" data-row="${i}"
      d="M ${laid.cx - r.outerR} ${laid.cy}
         a ${r.outerR} ${r.outerR} 0 1 0 ${r.outerR * 2} 0
         a ${r.outerR} ${r.outerR} 0 1 0 ${-r.outerR * 2} 0
         M ${laid.cx - r.innerR} ${laid.cy}
         a ${r.innerR} ${r.innerR} 0 1 1 ${r.innerR * 2} 0
         a ${r.innerR} ${r.innerR} 0 1 1 ${-r.innerR * 2} 0 Z"
      fill-rule="evenodd"/>`;
  }

  // Stitches
  for (let i = 0; i < laid.ringsLaid.length; i++) {
    for (let j = 0; j < laid.ringsLaid[i].stitches.length; j++) {
      const s = laid.ringsLaid[i].stitches[j];
      const color = s.placed.color || state.selectedColor || '#c084fc';
      const frag = s.def.renderSVG({
        bottomAnchors: s.bottomAnchors,
        topAnchors:    s.topAnchors,
        cellSize:      state.cellSize,
        color,
      });
      const loopMark = renderLoopMark(s, state.cellSize, color);
      const xs = [...s.bottomAnchors, ...s.topAnchors].map(a => a.x);
      const ys = [...s.bottomAnchors, ...s.topAnchors].map(a => a.y);
      const xMin = Math.min(...xs) - state.cellSize * 0.25;
      const xMax = Math.max(...xs) + state.cellSize * 0.25;
      const yMin = Math.min(...ys) - state.cellSize * 0.25;
      const yMax = Math.max(...ys) + state.cellSize * 0.25;
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
