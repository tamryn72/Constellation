// Assembly editor: name the edges of each panel, and declare seams that
// join edge X of panel A to edge Y of panel B.

const FLAT_EDGES  = ['top', 'bottom', 'left', 'right'];
const ROUND_EDGES = ['outer'];

function edgesFor(panel) {
  return panel.mode === 'round' ? ROUND_EDGES : FLAT_EDGES;
}

function uid() { return 's' + Math.random().toString(36).slice(2, 8); }

function escape(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export function showAssemblyModal(state, onChange) {
  document.getElementById('assembly-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'assembly-modal';
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <div class="modal modal-wide" role="dialog" aria-labelledby="assembly-title">
      <div class="modal-header">
        <h2 id="assembly-title">Assembly</h2>
        <button class="modal-close" aria-label="Close">✕</button>
      </div>
      <div class="modal-body">
        <section class="assembly-section">
          <h3>Edge labels</h3>
          <p class="assembly-hint">Name any edge to reference it in a seam. Labels are free text.</p>
          <div id="assembly-edges"></div>
        </section>
        <section class="assembly-section">
          <div class="assembly-row">
            <h3>Seams</h3>
            <button id="seam-add" class="tool-btn" type="button">+ Add seam</button>
          </div>
          <p class="assembly-hint">Each seam joins one edge of a panel to another.</p>
          <div id="assembly-seams"></div>
        </section>
      </div>
      <div class="modal-footer">
        <button id="assembly-done" class="tool-btn">Done</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  const close = () => { modal.remove(); onChange?.(); };
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  modal.querySelector('.modal-close').addEventListener('click', close);
  modal.querySelector('#assembly-done').addEventListener('click', close);

  function renderEdges() {
    const host = modal.querySelector('#assembly-edges');
    let html = '';
    for (const p of state.panels) {
      const edges = edgesFor(p);
      html += `<div class="edges-panel">
        <div class="edges-panel-name">${escape(p.name)} <span class="edges-panel-mode">(${p.mode})</span></div>
        <div class="edges-row">`;
      for (const e of edges) {
        const val = p.edges?.[e] ?? '';
        html += `
          <label class="edges-field">
            <span>${e}</span>
            <input type="text" data-panel="${p.id}" data-edge="${e}"
              value="${escape(val)}" placeholder="e.g. side-seam-A">
          </label>`;
      }
      html += `</div></div>`;
    }
    host.innerHTML = html;
    host.querySelectorAll('input').forEach(inp => {
      inp.addEventListener('input', () => {
        const panel = state.panels.find(p => p.id === inp.dataset.panel);
        if (!panel) return;
        panel.edges = panel.edges || {};
        panel.edges[inp.dataset.edge] = inp.value;
      });
    });
  }

  function renderSeams() {
    const host = modal.querySelector('#assembly-seams');
    if (!state.seams) state.seams = [];
    if (!state.seams.length) {
      host.innerHTML = `<div class="empty-state">No seams yet. Click "+ Add seam" to join two edges.</div>`;
      return;
    }
    let html = '';
    for (const s of state.seams) {
      html += `<div class="seam-row" data-seam="${s.id}">
        ${sidePicker(s, 'a')}
        <span class="seam-join">↔</span>
        ${sidePicker(s, 'b')}
        <input type="text" class="seam-note" data-seam="${s.id}" placeholder="note (optional)"
          value="${escape(s.note ?? '')}">
        <button class="tool-btn seam-remove" data-seam="${s.id}" type="button">Remove</button>
      </div>`;
    }
    host.innerHTML = html;

    host.querySelectorAll('select, input.seam-note').forEach(inp => {
      inp.addEventListener('change', () => applyFieldChange(inp));
      inp.addEventListener('input',  () => applyFieldChange(inp));
    });
    host.querySelectorAll('.seam-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        state.seams = state.seams.filter(s => s.id !== btn.dataset.seam);
        renderSeams();
      });
    });
  }

  function applyFieldChange(inp) {
    const row = inp.closest('.seam-row');
    if (!row) return;
    const seam = state.seams.find(s => s.id === row.dataset.seam);
    if (!seam) return;
    if (inp.classList.contains('seam-note')) {
      seam.note = inp.value;
      return;
    }
    const side = inp.dataset.side;       // 'a' | 'b'
    const field = inp.dataset.field;     // 'panelId' | 'edge'
    seam[side] = seam[side] || { panelId: '', edge: '' };
    seam[side][field] = inp.value;
  }

  function sidePicker(seam, side) {
    const sel = seam[side] || { panelId: '', edge: '' };
    const panelOptions = state.panels.map(p =>
      `<option value="${p.id}" ${p.id === sel.panelId ? 'selected' : ''}>${escape(p.name)}</option>`
    ).join('');
    const panel = state.panels.find(p => p.id === sel.panelId) || state.panels[0];
    const edges = panel ? edgesFor(panel) : FLAT_EDGES;
    const edgeOptions = edges.map(e =>
      `<option value="${e}" ${e === sel.edge ? 'selected' : ''}>${e}${panel?.edges?.[e] ? ` — ${escape(panel.edges[e])}` : ''}</option>`
    ).join('');
    return `
      <select data-side="${side}" data-field="panelId">
        <option value="">— panel —</option>
        ${panelOptions}
      </select>
      <select data-side="${side}" data-field="edge">
        ${edgeOptions}
      </select>`;
  }

  modal.querySelector('#seam-add').addEventListener('click', () => {
    state.seams.push({
      id: uid(),
      a: { panelId: state.panels[0]?.id ?? '', edge: 'right' },
      b: { panelId: state.panels[1]?.id ?? state.panels[0]?.id ?? '', edge: 'left' },
      note: '',
    });
    renderSeams();
  });

  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', escHandler);
    }
  });

  renderEdges();
  renderSeams();
}
