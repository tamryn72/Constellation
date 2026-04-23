// Save/load JSON; PNG export (rasterize the SVG canvas into a PNG).

export function setupExport({ state, canvas }) {
  const saveBtn = document.getElementById('tool-save');
  const loadInput = document.getElementById('tool-load');
  const pngBtn = document.getElementById('tool-png');

  saveBtn?.addEventListener('click', () => {
    const payload = {
      constellation: 2,
      cellSize: state.cellSize,
      selectedColor: state.selectedColor,
      fabricColor: state.fabricColor,
      panels: state.panels,
      activePanelIdx: state.activePanelIdx,
      seams: state.seams,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pattern.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  loadInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (data.cellSize) state.cellSize = data.cellSize;
      if (data.selectedColor) state.selectedColor = data.selectedColor;
      if (data.fabricColor) state.fabricColor = data.fabricColor;

      if (Array.isArray(data.panels)) {
        // v2: full project file
        state.panels = data.panels.map(p => ({
          id: p.id ?? ('p' + Math.random().toString(36).slice(2, 7)),
          name: p.name ?? 'Panel',
          mode: p.mode ?? 'flat',
          rows: p.rows ?? [[]],
          rounds: p.rounds ?? [[{ id: 'magic_ring' }]],
          folds: p.folds ?? [],
          edges: p.edges ?? {},
        }));
        state.activePanelIdx = Math.min(data.activePanelIdx ?? 0, state.panels.length - 1);
        state.seams = Array.isArray(data.seams) ? data.seams : [];
      } else if (Array.isArray(data.rows) || Array.isArray(data.rounds)) {
        // v1: single-panel legacy file. Wrap it.
        state.panels = [{
          id: 'p1',
          name: 'Panel 1',
          mode: data.mode ?? 'flat',
          rows:   Array.isArray(data.rows)   ? data.rows   : [[]],
          rounds: Array.isArray(data.rounds) ? data.rounds : [[{ id: 'magic_ring' }]],
          folds: [],
          edges: {},
        }];
        state.activePanelIdx = 0;
        state.seams = [];
      }
      // Re-point shared refs to the active panel.
      state.__syncFromPanel?.();
      window.__constellation__?.rerender?.();
      window.__constellation__?.refreshChrome?.();
    } catch (err) {
      alert('Could not load pattern: ' + err.message);
    } finally {
      loadInput.value = '';
    }
  });

  pngBtn?.addEventListener('click', () => {
    // Serialize the current SVG to a PNG via canvas element.
    const svg = canvas;
    const clone = svg.cloneNode(true);
    // Inline the canvas background color since we used a CSS var.
    clone.querySelectorAll('rect').forEach(r => {
      if (r.getAttribute('fill')?.startsWith('var(')) r.setAttribute('fill', '#faf7f2');
    });
    const serializer = new XMLSerializer();
    const src = serializer.serializeToString(clone);
    const blob = new Blob([src], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const img = new Image();
    img.onload = () => {
      const w = Number(svg.getAttribute('width'))  || svg.clientWidth  || 1024;
      const h = Number(svg.getAttribute('height')) || svg.clientHeight || 768;
      const c = document.createElement('canvas');
      c.width = w * 2;       // 2x for crisp export
      c.height = h * 2;
      const ctx = c.getContext('2d');
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0, w, h);
      c.toBlob(png => {
        const pngUrl = URL.createObjectURL(png);
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = 'pattern.png';
        a.click();
        URL.revokeObjectURL(pngUrl);
        URL.revokeObjectURL(url);
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      alert('PNG export failed.');
    };
    img.src = url;
  });
}
