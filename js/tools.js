// Tools: interaction layer. Active row, click-to-append, delete mode, colors.

export function createTools({ state, rerender, getSelectedStitch }) {
  let activeRow = (state.mode === 'round' ? state.rounds : state.rows).length - 1;
  let deleteMode = false;

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
    document.body.classList.toggle('is-delete-mode', deleteMode);
    const btn = document.getElementById('tool-delete');
    if (btn) btn.classList.toggle('is-active', deleteMode);
  }

  function appendStitch(stitchId) {
    if (!stitchId) return;
    const row = list()[activeRow];
    if (!row) return;
    row.push({ id: stitchId, color: state.selectedColor });
    rerender();
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
        } else {
          setActiveRow(r);
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
    appendStitch,
    deleteStitch,
    onModeChange,
    getActiveRow: () => activeRow,
    isDeleteMode: () => deleteMode,
  };
}
