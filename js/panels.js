// Panel tab bar: switch, add, rename (dblclick), delete.

const uid = () => 'p' + Math.random().toString(36).slice(2, 8);

export function buildPanelTabs({ state, rerender, onSwitch }) {
  const root = document.getElementById('panel-tabs');

  function makePanel(name = `Panel ${state.panels.length + 1}`) {
    return {
      id: uid(),
      name,
      mode: 'flat',
      rows: [[]],
      rounds: [[{ id: 'magic_ring' }]],
      folds: [],
      edges: {},
    };
  }

  function setActive(idx) {
    state.activePanelIdx = Math.max(0, Math.min(idx, state.panels.length - 1));
    state.__syncFromPanel?.();
    onSwitch?.();
    render();
    rerender();
  }

  function render() {
    let html = '';
    for (let i = 0; i < state.panels.length; i++) {
      const p = state.panels[i];
      const active = i === state.activePanelIdx;
      html += `
        <button class="panel-tab ${active ? 'is-active' : ''}"
                data-idx="${i}"
                title="Double-click to rename"
                data-role="tab">
          <span data-role="name">${escape(p.name)}</span>
          ${state.panels.length > 1
            ? `<span class="tab-close" data-role="close" title="Delete panel">✕</span>`
            : ''}
        </button>`;
    }
    html += `<button class="panel-tab-new" data-role="new" title="New panel">+ Panel</button>`;
    root.innerHTML = html;
  }

  function escape(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  root.addEventListener('click', (e) => {
    const newBtn = e.target.closest('[data-role="new"]');
    if (newBtn) {
      state.panels.push(makePanel());
      setActive(state.panels.length - 1);
      return;
    }
    const close = e.target.closest('[data-role="close"]');
    if (close) {
      e.stopPropagation();
      const idx = Number(close.closest('.panel-tab').dataset.idx);
      if (state.panels.length <= 1) return;
      if (!window.confirm(`Delete panel "${state.panels[idx].name}"?`)) return;
      // Also remove any seams that reference this panel.
      const removedId = state.panels[idx].id;
      state.seams = (state.seams || []).filter(
        s => s.a?.panelId !== removedId && s.b?.panelId !== removedId
      );
      state.panels.splice(idx, 1);
      setActive(Math.min(state.activePanelIdx, state.panels.length - 1));
      return;
    }
    const tab = e.target.closest('.panel-tab');
    if (tab) setActive(Number(tab.dataset.idx));
  });

  root.addEventListener('dblclick', (e) => {
    const tab = e.target.closest('.panel-tab');
    if (!tab) return;
    const idx = Number(tab.dataset.idx);
    const cur = state.panels[idx].name;
    const next = window.prompt('Rename panel:', cur);
    if (next && next.trim()) {
      state.panels[idx].name = next.trim();
      render();
    }
  });

  render();
  return { render, setActive };
}
