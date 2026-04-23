// Palette panel: grouped list of stitches with SVG previews, filterable.

import { STITCHES, CATEGORIES, renderPreview } from './stitches.js';

export function buildPalette(root, onSelect, opts = {}) {
  const listEl   = root.querySelector('#palette-list');
  const filterEl = root.querySelector('#palette-filter');
  const getStyle = opts.getStyle || (() => 'realistic');

  let filter = '';
  let selectedId = null;

  function render() {
    const groups = {};
    for (const id in STITCHES) {
      const def = STITCHES[id];
      const cat = def.category || 'Other';
      if (filter && !(
        def.name.toLowerCase().includes(filter) ||
        id.toLowerCase().includes(filter) ||
        cat.toLowerCase().includes(filter)
      )) continue;
      (groups[cat] ||= []).push(def);
    }

    let html = '';
    const ordered = [...CATEGORIES, ...Object.keys(groups).filter(c => !CATEGORIES.includes(c))];
    for (const cat of ordered) {
      if (!groups[cat]?.length) continue;
      html += `<div class="palette-category">${cat}</div>`;
      for (const def of groups[cat]) {
        const preview = renderPreview(def.id, 48, '#c084fc', getStyle());
        const fp = `${def.baseAnchors}→${def.topAnchors} · h${def.height}`;
        html += `
          <div class="palette-item ${def.id === selectedId ? 'is-selected' : ''}"
               data-stitch="${def.id}"
               title="${def.description || def.name}">
            <div class="palette-preview">${preview}</div>
            <div class="palette-meta">
              <span class="palette-name">${def.name}</span>
              <span class="palette-footprint">${fp}</span>
            </div>
          </div>`;
      }
    }
    listEl.innerHTML = html;
  }

  filterEl.addEventListener('input', () => {
    filter = filterEl.value.trim().toLowerCase();
    render();
  });

  listEl.addEventListener('click', (e) => {
    const item = e.target.closest('.palette-item');
    if (!item) return;
    selectedId = item.dataset.stitch;
    render();
    onSelect(selectedId);
  });

  render();

  return {
    getSelected: () => selectedId,
    setSelected: (id) => { selectedId = id; render(); },
    refresh: render,
  };
}
