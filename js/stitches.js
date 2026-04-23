// Stitch library. Every stitch is an ICON — built from ovals, arcs, and
// circles — placed in a grid cell and pulled toward its base/top anchors.
// Ovals rotate along the leg direction so they lean with inc/dec naturally.

const SW = (cellSize) => Math.max(1.2, cellSize * 0.09);

// ---------- primitives ----------

// N ovals stacked along the leg from b to t. Each oval's long axis is
// aligned with the leg direction, so if the leg leans, the ovals lean too.
function stackedOvals(b, t, n, cellSize, color, { filled = false, rxFactor = 0.22, squeeze = 0.88 } = {}) {
  const dx = t.x - b.x, dy = t.y - b.y;
  const len = Math.hypot(dx, dy) || cellSize;
  const legAngDeg = Math.atan2(dy, dx) * 180 / Math.PI + 90; // rotate so ellipse ry aligns with leg
  const rx = cellSize * rxFactor;
  const ry = (len / n) * 0.5 * squeeze;
  const sw = SW(cellSize);
  let out = '';
  for (let i = 0; i < n; i++) {
    const f = (i + 0.5) / n;
    const cx = b.x + f * dx;
    const cy = b.y + f * dy;
    if (filled) {
      out += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"
        transform="rotate(${legAngDeg} ${cx} ${cy})" fill="${color}"/>`;
    } else {
      out += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"
        transform="rotate(${legAngDeg} ${cx} ${cy})"
        fill="none" stroke="${color}" stroke-width="${sw}" stroke-linejoin="round"/>`;
    }
  }
  return out;
}

// One horizontal oval centered at p (used for chain at top of cell).
function horizOval(p, cellSize, color, { rxFactor = 0.38, ryFactor = 0.16, filled = false } = {}) {
  const rx = cellSize * rxFactor;
  const ry = cellSize * ryFactor;
  const sw = SW(cellSize);
  const fill = filled ? color : 'none';
  return `<ellipse cx="${p.x}" cy="${p.y}" rx="${rx}" ry="${ry}"
    fill="${fill}" stroke="${color}" stroke-width="${sw}"/>`;
}

// Round bump / ball (puff, popcorn, bobble).
function bump(b, t, cellSize, color, style = 'puff') {
  const midX = (b.x + t.x) / 2;
  const midY = (b.y + t.y) / 2;
  const dx = t.x - b.x, dy = t.y - b.y;
  const legLen = Math.hypot(dx, dy) || cellSize;
  const ang = Math.atan2(dy, dx) * 180 / Math.PI + 90;
  const rx = cellSize * 0.38;
  const ry = legLen * 0.38;
  const sw = SW(cellSize);
  if (style === 'popcorn') {
    return `<ellipse cx="${midX}" cy="${midY}" rx="${rx}" ry="${ry}"
        transform="rotate(${ang} ${midX} ${midY})"
        fill="${color}" fill-opacity="0.18" stroke="${color}" stroke-width="${sw}"/>
      <circle cx="${midX}" cy="${midY}" r="${cellSize*0.11}" fill="${color}"/>`;
  }
  if (style === 'bobble') {
    let out = '';
    for (let i = 0; i < 3; i++) {
      const f = 0.2 + 0.3 * i;
      const cx = b.x + f * dx;
      const cy = b.y + f * dy;
      const r = cellSize * 0.18;
      out += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" fill-opacity="${0.3 + i*0.1}"/>`;
    }
    return out;
  }
  return `<ellipse cx="${midX}" cy="${midY}" rx="${rx}" ry="${ry}"
    transform="rotate(${ang} ${midX} ${midY})"
    fill="${color}" fill-opacity="0.30" stroke="${color}" stroke-width="${sw}"/>`;
}

function postHook(b, cellSize, color, front) {
  const side = front ? 1 : -1;
  const r = cellSize * 0.30;
  const sw = SW(cellSize);
  const startX = b.x + side * r;
  const startY = b.y + cellSize * 0.14;
  const ctrlX = b.x + side * r * 1.4;
  const ctrlY = b.y - cellSize * 0.02;
  return `<path d="M ${startX} ${startY} Q ${ctrlX} ${ctrlY} ${b.x} ${b.y - cellSize*0.04}"
    stroke="${color}" stroke-width="${sw}" stroke-linecap="round" fill="none"/>`;
}

export const STITCHES = {
  ch: { id: 'ch', name: 'Chain', category: 'Foundation', height: 1, baseAnchors: 1, topAnchors: 1,
    description: 'A chain — horizontal oval at the top of the cell.',
    renderSVG({ topAnchors: [t], cellSize, color }) {
      return `<g>${horizOval(t, cellSize, color, { rxFactor: 0.40, ryFactor: 0.18 })}</g>`;
    } },
  sl: { id: 'sl', name: 'Slip Stitch', category: 'Foundation', height: 1, baseAnchors: 1, topAnchors: 1,
    description: 'Slip stitch — tiny filled dot.',
    renderSVG({ bottomAnchors: [b], topAnchors: [t], cellSize, color }) {
      const mx = (b.x + t.x) / 2, my = (b.y + t.y) / 2;
      return `<g><circle cx="${mx}" cy="${my}" r="${cellSize*0.16}" fill="${color}"/></g>`;
    } },
  magic_ring: { id: 'magic_ring', name: 'Magic Ring', category: 'Foundation', height: 1, baseAnchors: 0, topAnchors: 6,
    description: 'Starting ring for round work.',
    renderSVG({ topAnchors, cellSize, color }) {
      const cx = topAnchors.reduce((s, a) => s + a.x, 0) / topAnchors.length;
      const cy = topAnchors.reduce((s, a) => s + a.y, 0) / topAnchors.length;
      const r = cellSize * 0.42;
      const sw = SW(cellSize);
      return `<g><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${sw}"/>
        <circle cx="${cx}" cy="${cy}" r="${r*0.35}" fill="${color}" fill-opacity="0.25"/></g>`;
    } },
  sc: { id: 'sc', name: 'Single Crochet', category: 'Basic', height: 1, baseAnchors: 1, topAnchors: 1,
    description: '1 vertical oval.',
    renderSVG({ bottomAnchors: [b], topAnchors: [t], cellSize, color }) { return `<g>${stackedOvals(b, t, 1, cellSize, color)}</g>`; } },
  hdc: { id: 'hdc', name: 'Half Double', category: 'Basic', height: 2, baseAnchors: 1, topAnchors: 1,
    description: '1 tall vertical oval.',
    renderSVG({ bottomAnchors: [b], topAnchors: [t], cellSize, color }) { return `<g>${stackedOvals(b, t, 1, cellSize, color)}</g>`; } },
  dc: { id: 'dc', name: 'Double Crochet', category: 'Basic', height: 3, baseAnchors: 1, topAnchors: 1,
    description: '2 vertical ovals stacked.',
    renderSVG({ bottomAnchors: [b], topAnchors: [t], cellSize, color }) { return `<g>${stackedOvals(b, t, 2, cellSize, color)}</g>`; } },
  tr: { id: 'tr', name: 'Treble', category: 'Basic', height: 4, baseAnchors: 1, topAnchors: 1,
    description: '3 vertical ovals stacked.',
    renderSVG({ bottomAnchors: [b], topAnchors: [t], cellSize, color }) { return `<g>${stackedOvals(b, t, 3, cellSize, color)}</g>`; } },
  dtr: { id: 'dtr', name: 'Double Treble', category: 'Basic', height: 5, baseAnchors: 1, topAnchors: 1,
    description: '4 vertical ovals stacked.',
    renderSVG({ bottomAnchors: [b], topAnchors: [t], cellSize, color }) { return `<g>${stackedOvals(b, t, 4, cellSize, color)}</g>`; } },
  trtr: { id: 'trtr', name: 'Triple Treble', category: 'Basic', height: 6, baseAnchors: 1, topAnchors: 1,
    description: '5 vertical ovals stacked.',
    renderSVG({ bottomAnchors: [b], topAnchors: [t], cellSize, color }) { return `<g>${stackedOvals(b, t, 5, cellSize, color)}</g>`; } },
  rsc: { id: 'rsc', name: 'Reverse SC (crab)', category: 'Basic', height: 1, baseAnchors: 1, topAnchors: 1,
    description: 'Reverse SC — single oval with a twist tick.',
    renderSVG({ bottomAnchors: [b], topAnchors: [t], cellSize, color }) {
      const midX = (b.x + t.x) / 2, midY = (b.y + t.y) / 2;
      return `<g>${stackedOvals(b, t, 1, cellSize, color)}
        <path d="M ${midX - cellSize*0.22} ${midY + cellSize*0.05} q ${cellSize*0.22} ${-cellSize*0.12} ${cellSize*0.44} ${0}"
          stroke="${color}" stroke-width="${SW(cellSize)*0.75}" fill="none" stroke-linecap="round"/></g>`;
    } },
  spike: { id: 'spike', name: 'Spike Stitch', category: 'Basic', height: 2, baseAnchors: 1, topAnchors: 1,
    description: 'Long oval dropping below into lower row.',
    renderSVG({ bottomAnchors: [b], topAnchors: [t], cellSize, color }) {
      const extB = { x: b.x, y: b.y + cellSize * 0.6 };
      return `<g>${stackedOvals(extB, t, 1, cellSize, color, { rxFactor: 0.18 })}
        <path d="M ${extB.x - cellSize*0.16} ${extB.y - cellSize*0.12} L ${extB.x} ${extB.y + cellSize*0.06} L ${extB.x + cellSize*0.16} ${extB.y - cellSize*0.12}"
          stroke="${color}" stroke-width="${SW(cellSize)*0.85}" fill="none" stroke-linecap="round"/></g>`;
    } },
  fpsc: { id: 'fpsc', name: 'Front Post SC', category: 'Post', height: 1, baseAnchors: 1, topAnchors: 1,
    description: 'SC around the post, from the front.',
    renderSVG({ bottomAnchors: [b], topAnchors: [t], cellSize, color }) { return `<g>${postHook(b, cellSize, color, true)}${stackedOvals(b, t, 1, cellSize, color)}</g>`; } },
  bpsc: { id: 'bpsc', name: 'Back Post SC', category: 'Post', height: 1, baseAnchors: 1, topAnchors: 1,
    description: 'SC around the post, from the back.',
    renderSVG({ bottomAnchors: [b], topAnchors: [t], cellSize, color }) { return `<g>${postHook(b, cellSize, color, false)}${stackedOvals(b, t, 1, cellSize, color)}</g>`; } },
  fphdc: { id: 'fphdc', name: 'Front Post HDC', category: 'Post', height: 2, baseAnchors: 1, topAnchors: 1,
    description: 'HDC around the post, from the front.',
    renderSVG({ bottomAnchors: [b], topAnchors: [t], cellSize, color }) { return `<g>${postHook(b, cellSize, color, true)}${stackedOvals(b, t, 1, cellSize, color)}</g>`; } },
  bphdc: { id: 'bphdc', name: 'Back Post HDC', category: 'Post', height: 2, baseAnchors: 1, topAnchors: 1,
    description: 'HDC around the post, from the back.',
    renderSVG({ bottomAnchors: [b], topAnchors: [t], cellSize, color }) { return `<g>${postHook(b, cellSize, color, false)}${stackedOvals(b, t, 1, cellSize, color)}</g>`; } },
  fpdc: { id: 'fpdc', name: 'Front Post DC', category: 'Post', height: 3, baseAnchors: 1, topAnchors: 1,
    description: 'DC around the post — raised (front).',
    renderSVG({ bottomAnchors: [b], topAnchors: [t], cellSize, color }) { return `<g>${postHook(b, cellSize, color, true)}${stackedOvals(b, t, 2, cellSize, color)}</g>`; } },
  bpdc: { id: 'bpdc', name: 'Back Post DC', category: 'Post', height: 3, baseAnchors: 1, topAnchors: 1,
    description: 'DC around the post — recessed (back).',
    renderSVG({ bottomAnchors: [b], topAnchors: [t], cellSize, color }) { return `<g>${postHook(b, cellSize, color, false)}${stackedOvals(b, t, 2, cellSize, color)}</g>`; } },
  puff: { id: 'puff', name: 'Puff Stitch', category: 'Textured', height: 2, baseAnchors: 1, topAnchors: 1,
    description: 'Fat puff bulge.',
    renderSVG({ bottomAnchors: [b], topAnchors: [t], cellSize, color }) { return `<g>${bump(b, t, cellSize, color, 'puff')}</g>`; } },
  bobble: { id: 'bobble', name: 'Bobble', category: 'Textured', height: 2, baseAnchors: 1, topAnchors: 1,
    description: 'Cluster of 3 small rounded bumps.',
    renderSVG({ bottomAnchors: [b], topAnchors: [t], cellSize, color }) { return `<g>${bump(b, t, cellSize, color, 'bobble')}</g>`; } },
  popcorn: { id: 'popcorn', name: 'Popcorn', category: 'Textured', height: 2, baseAnchors: 1, topAnchors: 1,
    description: 'Raised dome with a center dot.',
    renderSVG({ bottomAnchors: [b], topAnchors: [t], cellSize, color }) { return `<g>${bump(b, t, cellSize, color, 'popcorn')}</g>`; } },
  bullion: { id: 'bullion', name: 'Bullion', category: 'Textured', height: 3, baseAnchors: 1, topAnchors: 1,
    description: 'Elongated coiled stitch.',
    renderSVG({ bottomAnchors: [b], topAnchors: [t], cellSize, color }) { return `<g>${stackedOvals(b, t, 6, cellSize, color, { rxFactor: 0.18 })}</g>`; } },
  sc_inc: { id: 'sc_inc', name: 'SC Increase', category: 'Shaping', height: 1, baseAnchors: 1, topAnchors: 2,
    description: '2 sc legs splaying from one base.',
    renderSVG({ bottomAnchors: [b], topAnchors, cellSize, color }) { return `<g>${topAnchors.map(t => stackedOvals(b, t, 1, cellSize, color)).join('')}</g>`; } },
  sc_dec: { id: 'sc_dec', name: 'SC Decrease', category: 'Shaping', height: 1, baseAnchors: 2, topAnchors: 1,
    description: '2 sc legs leaning inward — pulls the 2 below together.',
    renderSVG({ bottomAnchors, topAnchors: [t], cellSize, color }) { return `<g>${bottomAnchors.map(b => stackedOvals(b, t, 1, cellSize, color)).join('')}</g>`; } },
  invdec: { id: 'invdec', name: 'Invisible Decrease', category: 'Shaping', height: 1, baseAnchors: 2, topAnchors: 1,
    description: 'Tighter merge variant.',
    renderSVG({ bottomAnchors, topAnchors: [t], cellSize, color }) {
      return `<g>${bottomAnchors.map(b => stackedOvals(b, t, 1, cellSize, color, { rxFactor: 0.16 })).join('')}
        <circle cx="${t.x}" cy="${t.y}" r="${cellSize*0.10}" fill="${color}"/></g>`;
    } },
  hdc_inc: { id: 'hdc_inc', name: 'HDC Increase', category: 'Shaping', height: 2, baseAnchors: 1, topAnchors: 2,
    description: '2 hdc legs splaying from one base.',
    renderSVG({ bottomAnchors: [b], topAnchors, cellSize, color }) { return `<g>${topAnchors.map(t => stackedOvals(b, t, 1, cellSize, color)).join('')}</g>`; } },
  hdc_dec: { id: 'hdc_dec', name: 'HDC Decrease', category: 'Shaping', height: 2, baseAnchors: 2, topAnchors: 1,
    description: '2 hdc legs merging to one top.',
    renderSVG({ bottomAnchors, topAnchors: [t], cellSize, color }) { return `<g>${bottomAnchors.map(b => stackedOvals(b, t, 1, cellSize, color)).join('')}</g>`; } },
  dc_inc: { id: 'dc_inc', name: 'DC Increase', category: 'Shaping', height: 3, baseAnchors: 1, topAnchors: 2,
    description: '2 dc legs splaying from one base.',
    renderSVG({ bottomAnchors: [b], topAnchors, cellSize, color }) { return `<g>${topAnchors.map(t => stackedOvals(b, t, 2, cellSize, color)).join('')}</g>`; } },
  dc_dec: { id: 'dc_dec', name: 'DC Decrease', category: 'Shaping', height: 3, baseAnchors: 2, topAnchors: 1,
    description: '2 dc legs leaning inward — pulls 2 stitches below together.',
    renderSVG({ bottomAnchors, topAnchors: [t], cellSize, color }) { return `<g>${bottomAnchors.map(b => stackedOvals(b, t, 2, cellSize, color)).join('')}</g>`; } },
  tr_dec: { id: 'tr_dec', name: 'TR Decrease', category: 'Shaping', height: 4, baseAnchors: 2, topAnchors: 1,
    description: '2 tr legs leaning inward.',
    renderSVG({ bottomAnchors, topAnchors: [t], cellSize, color }) { return `<g>${bottomAnchors.map(b => stackedOvals(b, t, 3, cellSize, color)).join('')}</g>`; } },
  sc3tog: { id: 'sc3tog', name: 'SC 3-together', category: 'Shaping', height: 1, baseAnchors: 3, topAnchors: 1,
    description: '3 sc legs merging to one top.',
    renderSVG({ bottomAnchors, topAnchors: [t], cellSize, color }) { return `<g>${bottomAnchors.map(b => stackedOvals(b, t, 1, cellSize, color)).join('')}</g>`; } },
  hdc3tog: { id: 'hdc3tog', name: 'HDC 3-together', category: 'Shaping', height: 2, baseAnchors: 3, topAnchors: 1,
    description: '3 hdc legs merging to one top.',
    renderSVG({ bottomAnchors, topAnchors: [t], cellSize, color }) { return `<g>${bottomAnchors.map(b => stackedOvals(b, t, 1, cellSize, color)).join('')}</g>`; } },
  shell: { id: 'shell', name: 'Shell', category: 'Decorative', height: 3, baseAnchors: 1, topAnchors: 5,
    description: '5 dc legs fanning from one base — shares a base dot.',
    renderSVG({ bottomAnchors: [b], topAnchors, cellSize, color }) {
      const fan = topAnchors.map(t => stackedOvals(b, t, 2, cellSize, color, { rxFactor: 0.17 })).join('');
      return `<g>${fan}<circle cx="${b.x}" cy="${b.y}" r="${cellSize*0.08}" fill="${color}"/></g>`;
    } },
  mini_shell: { id: 'mini_shell', name: 'Mini Shell', category: 'Decorative', height: 2, baseAnchors: 1, topAnchors: 3,
    description: '3 hdc legs fanning from one base.',
    renderSVG({ bottomAnchors: [b], topAnchors, cellSize, color }) {
      const fan = topAnchors.map(t => stackedOvals(b, t, 1, cellSize, color, { rxFactor: 0.18 })).join('');
      return `<g>${fan}<circle cx="${b.x}" cy="${b.y}" r="${cellSize*0.07}" fill="${color}"/></g>`;
    } },
  v_stitch: { id: 'v_stitch', name: 'V-Stitch', category: 'Decorative', height: 3, baseAnchors: 1, topAnchors: 2,
    description: '2 dc legs from one base with a visible V gap.',
    renderSVG({ bottomAnchors: [b], topAnchors, cellSize, color }) {
      return `<g>${topAnchors.map(t => stackedOvals(b, t, 2, cellSize, color)).join('')}
        <circle cx="${b.x}" cy="${b.y}" r="${cellSize*0.07}" fill="${color}"/></g>`;
    } },
  cluster3: { id: 'cluster3', name: 'Cluster (3-st)', category: 'Decorative', height: 3, baseAnchors: 3, topAnchors: 1,
    description: '3 dc legs merging to one top — shares a top dot.',
    renderSVG({ bottomAnchors, topAnchors: [t], cellSize, color }) {
      return `<g>${bottomAnchors.map(b => stackedOvals(b, t, 2, cellSize, color, { rxFactor: 0.17 })).join('')}
        <circle cx="${t.x}" cy="${t.y}" r="${cellSize*0.08}" fill="${color}"/></g>`;
    } },
  picot: { id: 'picot', name: 'Picot', category: 'Decorative', height: 1, baseAnchors: 1, topAnchors: 1,
    description: 'Chain with a little loop on top.',
    renderSVG({ bottomAnchors: [b], topAnchors: [t], cellSize, color }) {
      const sw = SW(cellSize);
      const r = cellSize * 0.22;
      return `<g>${horizOval(t, cellSize, color, { rxFactor: 0.25, ryFactor: 0.12 })}
        <circle cx="${t.x}" cy="${t.y - r*0.7}" r="${r*0.9}" fill="none" stroke="${color}" stroke-width="${sw*0.8}"/></g>`;
    } },
  ch_sp_2: makeChainSpace(2),
  ch_sp_3: makeChainSpace(3),
  ch_sp_5: makeChainSpace(5),
};

function makeChainSpace(N) {
  return {
    id: `ch_sp_${N}`, name: `ch-${N} space`, category: 'Lace',
    height: 1, baseAnchors: N, topAnchors: N,
    description: `Chain space: ch ${N}, skip ${N} below.`,
    renderSVG({ bottomAnchors, topAnchors, cellSize, color }) {
      const sw = SW(cellSize);
      const tops = topAnchors.length ? topAnchors : bottomAnchors;
      const beads = tops.map(t =>
        `<ellipse cx="${t.x}" cy="${t.y}" rx="${cellSize*0.26}" ry="${cellSize*0.12}"
          fill="none" stroke="${color}" stroke-width="${sw*0.7}"/>`
      ).join('');
      return `<g>${beads}</g>`;
    }
  };
}

export const CATEGORIES = ['Foundation', 'Basic', 'Shaping', 'Post', 'Textured', 'Decorative', 'Lace'];

export function renderPreview(stitchId, size = 48, color = '#c084fc') {
  const def = STITCHES[stitchId];
  if (!def) return '';
  const cellSize = size / Math.max(def.height, 2) * 0.9;
  const pad = cellSize * 0.3;
  const widest = Math.max(def.topAnchors || 1, def.baseAnchors || 1, 1);
  const w = widest * cellSize + pad * 2;
  const h = def.height * cellSize + pad * 2;
  const bottomY = h - pad;
  const topY = pad;
  const spanLeft = pad + cellSize * 0.5;
  const spanRight = w - pad - cellSize * 0.5;
  const span = spanRight - spanLeft;
  const mkAnchors = (n, y) => {
    const out = [];
    if (n <= 0) return out;
    for (let i = 0; i < n; i++) {
      const f = n === 1 ? 0.5 : i / (n - 1);
      out.push({ x: spanLeft + f * span, y });
    }
    return out;
  };
  const bottomAnchors = def.baseAnchors === 0 ? [] : mkAnchors(def.baseAnchors, bottomY);
  const topAnchors = mkAnchors(def.topAnchors, topY);
  const body = def.renderSVG({ bottomAnchors, topAnchors, cellSize, color });
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>`;
}
