// Tools: interaction layer. Active row, click-to-append, delete mode, colors.

export function createTools({ state, rerender, getSelectedStitch }) {
  let activeRow = (state.mode === 'round' ? state.rounds : state.rows).length - 1;
  let deleteMode = false;
  let paintMode  = false;

  // The "rows" we operate on depend on mode.
  function list() { return state.mode === 'round' ? state.rounds : state.rows; }

  function setActiveRow(i) {
    activeRow = Math.max(0, Math.min(i, list().length - 1));
    syncActiveRowHighlight();
  }

  function syncActiveRowHighlight() {
    const canvas = document.getElementById('canvas');
    if (!canvas) return;
    canvas.querySelectorAll('.row-click-target').forEach(el => {
      el.classList.toggle('is-active', Number(el.dataset.row) === activeRow);
    });
  }

  function addRow() {
    list().push([]);
    activeRow = list().length - 1;
    rerender();
  }

  function clearAll(confirm = true) {
    if (confirm && !window.confirm('Clear the entire pattern?')) return;
    if (state.mode === 'round') {
      state.rounds = [[{ id: 'magic_ring' }]];
    } else {
      state.rows = [[]];
    }
    activeRow = 0;
    rerender();
  }

  function toggleDeleteMode() {
    deleteMode = !deleteMode;
    if (deleteMode && paintMode) togglePaintMode();
    document.body.classList.toggle('is-delete-mode', deleteMode);
    const btn = document.getElementById('tool-delete');
    if (btn) btn.classList.toggle('is-active', deleteMode);
  }

  function togglePaintMode() {
    paintMode = !paintMode;
    if (paintMode && deleteMode) toggleDeleteMode();
    document.body.classList.toggle('is-paint-mode', paintMode);
    const btn = document.getElementById('tool-paint');
    if (btn) btn.classList.toggle('is-active', paintMode);
  }

  function paintStitch(rowIdx, stitchIdx) {
    const row = list()[rowIdx];
    if (!row || !row[stitchIdx]) return;
    row[stitchIdx].color = state.selectedColor;
    rerender();
  }

  function paintActiveRow() {
    const row = list()[activeRow];
    if (!row) return;
    row.forEach(p => { p.color = state.selectedColor; });
    rerender();
  }

  function paintAll() {
    for (const row of list()) {
      for (const p of row) p.color = state.selectedColor;
    }
    rerender();
  }

  function appendStitch(stitchId) {
    if (!stitchId) return;
    const row = list()[activeRow];
    if (!row) return;
    row.push(makePlaced(stitchId));
    rerender();
  }

  function insertStitchAt(rowIdx, stitchIdx, stitchId) {
    if (!stitchId) return;
    const row = list()[rowIdx];
    if (!row) return;
    row.splice(stitchIdx, 0, makePlaced(stitchId));
    rerender();
  }

  function makePlaced(stitchId) {
    const placed = { id: stitchId, color: state.selectedColor };
    if (state.selectedLoop && state.selectedLoop !== 'both') {
      placed.loop = state.selectedLoop;
    }
    return placed;
  }

  function deleteStitch(rowIdx, stitchIdx) {
    const row = list()[rowIdx];
    if (!row) return;
    row.splice(stitchIdx, 1);
    rerender();
  }

  // Canvas event delegation: click a row target to make it active & append;
  // click a stitch in delete mode to remove.
  function bindCanvas() {
    const canvas = document.getElementById('canvas');
    if (!canvas) return;

    canvas.addEventListener('click', (e) => {
      const stitchEl = e.target.closest('.stitch');
      const rowEl    = e.target.closest('.row-click-target');

      if (stitchEl) {
        const r = Number(stitchEl.dataset.row);
        const j = Number(stitchEl.dataset.index);
        if (deleteMode) {
          deleteStitch(r, j);
        } else if (paintMode) {
          paintStitch(r, j);
        } else {
          // Tap an existing stitch with a palette item selected → insert
          // the new stitch BEFORE the tapped one. Lets you place into the
          // middle of a row (e.g. drop a shell between two stitches, then
          // tap it to add sk's around it).
          setActiveRow(r);
          const sel = getSelectedStitch();
          if (sel) insertStitchAt(r, j, sel);
        }
        return;
      }
      if (rowEl) {
        const r = Number(rowEl.dataset.row);
        setActiveRow(r);
        const sel = getSelectedStitch();
        if (sel && !deleteMode) appendStitch(sel);
      }
    });
  }

  function onModeChange() {
    activeRow = list().length - 1;
  }

  return {
    bindCanvas,
    setActiveRow,
    syncActiveRowHighlight,
    addRow,
    clearAll,
    toggleDeleteMode,
    togglePaintMode,
    paintActiveRow,
    paintAll,
    appendStitch,
    insertStitchAt,
    deleteStitch,
    onModeChange,
    getActiveRow: () => activeRow,
    isDeleteMode: () => deleteMode,
    isPaintMode: () => paintMode,
  };
}
