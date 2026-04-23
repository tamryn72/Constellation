// Main: boots the app, owns state, wires palette + tools + grid together.

import { STITCHES } from './stitches.js';
import * as flatGrid from './grid.js';
import * as radial from './radial.js';
import { buildPalette } from './palette.js';
import { createTools } from './tools.js';
import { setupExport } from './export.js';
import { showPatternModal } from './pattern.js';

// ---------- initial state ----------

const state = {
  mode: 'flat',                  // 'flat' | 'round'
  cellSize: 28,
  selectedColor: '#c084fc',
  rows: [                        // flat mode
    // Demo: 10-chain foundation + a row that consumes exactly 10 so it's valid.
    Array.from({ length: 10 }, () => ({ id: 'ch' })),
    [
      { id: 'sc' }, { id: 'sc' },
      { id: 'sc_dec' },            // 2 → 1, legs lean inward
      { id: 'dc' },
      { id: 'dc_dec' },            // 2 → 1
      { id: 'dc' },
      { id: 'shell' },             // 1 → 5, fan
      { id: 'sc' },                // base total: 1+1+2+1+2+1+1+1 = 10 ✓
    ],
  ],
  rounds: [                      // round mode
    // Standard amigurumi increase pattern: 6, 12, 18 — each round lies flat.
    [ { id: 'magic_ring' } ],                                             // → 6 tops
    Array.from({ length: 6 }, () => ({ id: 'sc_inc' })),                  // 6 → 12 tops
    Array.from({ length: 6 }, () => [{ id: 'sc' }, { id: 'sc_inc' }]).flat(), // 12 → 18 tops
  ],
};

// ---------- DOM refs ----------

const canvas = document.getElementById('canvas');
const statusBar = document.getElementById('status-bar');

// ---------- render ----------

function rerender() {
  let laid;
  if (state.mode === 'flat') {
    laid = flatGrid.render(canvas, state);
  } else {
    laid = radial.render(canvas, state);
  }
  tools?.syncActiveRowHighlight?.();

  // Status bar: mode, active row, warnings
  const parts = [];
  parts.push(state.mode === 'flat' ? 'Flat mode' : 'Round mode');
  const arr = state.mode === 'flat' ? state.rows : state.rounds;
  parts.push(`${state.mode === 'flat' ? 'rows' : 'rounds'}: ${arr.length}`);
  parts.push(`active: R${tools?.getActiveRow?.() ?? 0}`);
  if (laid.warnings?.length) {
    const w = laid.warnings[0];
    const where = w.row !== undefined ? `row ${w.row}` : `round ${w.round}`;
    parts.push(`⚠ ${where}: base=${w.consumed}, prev tops=${w.available} (Δ${w.delta})`);
  }

  // Round-mode flat-lay hint: show the first off-target round.
  if (state.mode === 'round' && laid.flatLay?.length) {
    const bad = laid.flatLay.find(r => r.lie !== 'flat');
    if (bad) {
      const verb = bad.lie === 'cup' ? 'cups up' : 'ruffles';
      const fix = bad.delta < 0
        ? `add ${-bad.delta} increase${-bad.delta === 1 ? '' : 's'}`
        : `remove ${bad.delta} stitch${bad.delta === 1 ? '' : 'es'}`;
      parts.push(`↻ R${bad.round} ${verb}: ${bad.actual}/${bad.ideal} — ${fix} to lie flat`);
    } else {
      parts.push('↻ all rounds lie flat ✓');
    }
  }

  statusBar.textContent = parts.join(' · ');
}

// ---------- palette ----------

const paletteApi = buildPalette(document.getElementById('palette'), (stitchId) => {
  // Immediately append on selection when a row is active? No — require a click
  // on the canvas. But update cursor/status.
  statusBar.textContent = `Selected ${STITCHES[stitchId]?.name}. Click a row to place.`;
});

// ---------- tools ----------

const tools = createTools({
  state,
  rerender,
  getSelectedStitch: () => paletteApi.getSelected(),
});
tools.bindCanvas();

// ---------- header controls ----------

function setMode(mode) {
  state.mode = mode;
  const flatBtn = document.getElementById('mode-flat');
  const roundBtn = document.getElementById('mode-round');
  flatBtn.classList.toggle('is-active', mode === 'flat');
  roundBtn.classList.toggle('is-active', mode === 'round');
  flatBtn.setAttribute('aria-selected', String(mode === 'flat'));
  roundBtn.setAttribute('aria-selected', String(mode === 'round'));
  tools?.onModeChange?.();
  rerender();
}
document.getElementById('mode-flat').addEventListener('click', () => setMode('flat'));
document.getElementById('mode-round').addEventListener('click', () => setMode('round'));

const zoomInput = document.getElementById('zoom');
const zoomReadout = document.getElementById('zoom-readout');
zoomInput.addEventListener('input', () => {
  state.cellSize = Number(zoomInput.value);
  zoomReadout.textContent = state.cellSize;
  rerender();
});

// ---------- toolbar ----------

document.getElementById('color').addEventListener('input', (e) => {
  state.selectedColor = e.target.value;
});
document.getElementById('tool-add-row').addEventListener('click', () => tools.addRow());
document.getElementById('tool-clear').addEventListener('click', () => tools.clearAll());
document.getElementById('tool-delete').addEventListener('click', () => tools.toggleDeleteMode());

setupExport({ state, canvas });

document.getElementById('tool-pattern').addEventListener('click', () => {
  showPatternModal(state);
});

// ---------- first render ----------

rerender();

// Expose for quick debugging in console
window.__constellation__ = { state, rerender, STITCHES };
