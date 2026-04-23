// Main: boots the app, owns state, wires palette + tools + grid together.

import { STITCHES } from './stitches.js';
import * as flatGrid from './grid.js';
import * as radial from './radial.js';
import { buildPalette } from './palette.js';
import { createTools } from './tools.js';
import { setupExport } from './export.js';
import { showPatternModal } from './pattern.js';
import { buildPanelTabs } from './panels.js';

// ---------- initial state ----------

function makePanel({ id, name, mode = 'flat', rows, rounds }) {
  return {
    id,
    name,
    mode,
    rows:   rows   ?? [[]],
    rounds: rounds ?? [[{ id: 'magic_ring' }]],
    folds:  [],
    edges:  {},    // e.g. { top: 'neckline', left: 'side-seam' }
  };
}

const demoPanel = makePanel({
  id: 'p1',
  name: 'Panel 1',
  mode: 'flat',
  rows: [
    Array.from({ length: 10 }, () => ({ id: 'ch' })),
    [
      { id: 'sc' }, { id: 'sc' },
      { id: 'sc_dec' },
      { id: 'dc' },
      { id: 'dc_dec' },
      { id: 'dc' },
      { id: 'shell' },
      { id: 'sc' },
    ],
  ],
  rounds: [
    [ { id: 'magic_ring' } ],
    Array.from({ length: 6 }, () => ({ id: 'sc_inc' })),
    Array.from({ length: 6 }, () => [{ id: 'sc' }, { id: 'sc_inc' }]).flat(),
  ],
});

const state = {
  cellSize: 28,
  selectedColor: '#c084fc',
  fabricColor: '#faf7f2',
  panels: [demoPanel],
  activePanelIdx: 0,
  seams: [],          // { a:{panelId, edge}, b:{panelId, edge}, note }
  // These three are shared references to the active panel's fields, kept in
  // sync on panel switch so every existing module keeps working unchanged.
  mode:   demoPanel.mode,
  rows:   demoPanel.rows,
  rounds: demoPanel.rounds,
};

export function activePanel() { return state.panels[state.activePanelIdx]; }

function syncStateToPanel() {
  const p = activePanel();
  state.mode   = p.mode;
  state.rows   = p.rows;
  state.rounds = p.rounds;
}
// Expose so tools can call it after mode change (mode lives on the panel now).
state.__syncFromPanel = syncStateToPanel;

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
  activePanel().mode = mode;
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
document.getElementById('fabric-color').addEventListener('input', (e) => {
  state.fabricColor = e.target.value;
  rerender();
});
document.getElementById('tool-add-row').addEventListener('click', () => tools.addRow());
document.getElementById('tool-clear').addEventListener('click', () => tools.clearAll());
document.getElementById('tool-delete').addEventListener('click', () => tools.toggleDeleteMode());
document.getElementById('tool-paint').addEventListener('click', () => tools.togglePaintMode());
document.getElementById('tool-paint-row').addEventListener('click', () => tools.paintActiveRow());

setupExport({ state, canvas });

document.getElementById('tool-pattern').addEventListener('click', () => {
  showPatternModal(state);
});

// ---------- panel tabs ----------

function refreshChrome() {
  // Sync mode toggle buttons to active panel's mode.
  const mode = activePanel().mode;
  document.getElementById('mode-flat').classList.toggle('is-active', mode === 'flat');
  document.getElementById('mode-round').classList.toggle('is-active', mode === 'round');
  document.getElementById('mode-flat').setAttribute('aria-selected', String(mode === 'flat'));
  document.getElementById('mode-round').setAttribute('aria-selected', String(mode === 'round'));
}

const panelTabs = buildPanelTabs({
  state,
  rerender,
  onSwitch: () => {
    tools?.onModeChange?.();
    refreshChrome();
  },
});

// ---------- first render ----------

rerender();

// Expose for debugging + cross-module helpers (e.g. export.js reload).
window.__constellation__ = {
  state,
  rerender,
  refreshChrome: () => { refreshChrome(); panelTabs.render(); },
  STITCHES,
};
