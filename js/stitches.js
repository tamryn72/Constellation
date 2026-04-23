// Stitch library. Every stitch is one or more thick "legs" drawn between
// anchor points the grid engine has already computed. Renderers return a
// <g> fragment in the grid's coordinate space.

const SW = (cellSize) => cellSize * 0.18;   // stroke width scales with zoom

// ---------- leg helpers ----------

// Straight leg from bottom anchor b to top anchor t (thick, round caps).
function leg(b, t, color, sw) {
  return `<line x1="${b.x}" y1="${b.y}" x2="${t.x}" y2="${t.y}"
    stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>`;
}

// Perpendicular crossbar centered on (cx, cy), aligned to the leg direction.
function crossbar(cx, cy, bx, by, tx, ty, len, color, sw) {
  // leg direction
  let dx = tx - bx, dy = ty - by;
  const n = Math.hypot(dx, dy) || 1;
  dx /= n; dy /= n;
  // perpendicular
  const px = -dy, py = dx;
  const half = len / 2;
  return `<line x1="${cx - px*half}" y1="${cy - py*half}"
                x2="${cx + px*half}" y2="${cy + py*half}"
                stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>`;
}

// Small hook arc at the top of the leg.
function topHook(t, bx, by, cellSize, color, sw) {
  let dx = t.x - bx, dy = t.y - by;
  const n = Math.hypot(dx, dy) || 1;
  dx /= n; dy /= n;
  const px = -dy, py = dx;  // perpendicular, "outward" side
  const r = cellSize * 0.22;
  const hx = t.x + px * r;
  const hy = t.y + py * r;
  return `<path d="M ${t.x} ${t.y} q ${px*r*0.5 + dx*r*0.1} ${py*r*0.5 + dy*r*0.1}
                        ${px*r + dx*r*0.3} ${py*r + dy*r*0.3}"
           stroke="${color}" stroke-width="${sw}" stroke-linecap="round" fill="none"/>
          <circle cx="${hx}" cy="${hy}" r="${sw*0.35}" fill="${color}"/>`;
}

// X cap near top of a leg (sc / slip style).
function xCap(t, bx, by, cellSize, color, sw) {
  let dx = t.x - bx, dy = t.y - by;
  const n = Math.hypot(dx, dy) || 1;
  dx /= n; dy /= n;
  const px = -dy, py = dx;
  const capOffset = cellSize * 0.18;
  const capHalf = cellSize * 0.20;
  const cx = t.x - dx * capOffset;
  const cy = t.y - dy * capOffset;
  // two diagonals through (cx, cy) relative to leg frame
  const a = { x: cx - px*capHalf - dx*capHalf, y: cy - py*capHalf - dy*capHalf };
  const b = { x: cx + px*capHalf + dx*capHalf, y: cy + py*capHalf + dy*capHalf };
  const c = { x: cx - px*capHalf + dx*capHalf, y: cy - py*capHalf + dy*capHalf };
  const d = { x: cx + px*capHalf - dx*capHalf, y: cy + py*capHalf - dy*capHalf };
  return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"
            stroke="${color}" stroke-width="${sw*0.85}" stroke-linecap="round"/>
          <line x1="${c.x}" y1="${c.y}" x2="${d.x}" y2="${d.y}"
            stroke="${color}" stroke-width="${sw*0.85}" stroke-linecap="round"/>`;
}

// Bulge (for puff/bobble/popcorn) — ellipse centered on leg midpoint.
function bulge(b, t, cellSize, color, kind) {
  const midX = (b.x + t.x) / 2;
  const midY = (b.y + t.y) / 2;
  const rx = cellSize * (kind === 'popcorn' ? 0.36 : 0.28);
  const ry = cellSize * (kind === 'bullion' ? 0.45 : 0.34);
  const fillOp = kind === 'popcorn' ? 0.55 : kind === 'bobble' ? 0.45 : 0.30;
  // rotate to leg direction
  let dx = t.x - b.x, dy = t.y - b.y;
  const ang = Math.atan2(dy, dx) * 180 / Math.PI - 90;
  return `<ellipse cx="${midX}" cy="${midY}" rx="${rx}" ry="${ry}"
            transform="rotate(${ang} ${midX} ${midY})"
            fill="${color}" fill-opacity="${fillOp}"
            stroke="${color}" stroke-width="${SW(cellSize)*0.8}"/>`;
}

// ---------- renderers ----------

function renderBasic({ bottomAnchors, topAnchors, cellSize, color, crossbars = 0, hasHook = true, hasXCap = false }) {
  const b = bottomAnchors[0];
  const t = topAnchors[0];
  const sw = SW(cellSize);
  let out = leg(b, t, color, sw);

  // crossbars evenly spaced along the leg
  for (let i = 0; i < crossbars; i++) {
    const f = (i + 1) / (crossbars + 1);
    const cx = b.x + (t.x - b.x) * f;
    const cy = b.y + (t.y - b.y) * f;
    out += crossbar(cx, cy, b.x, b.y, t.x, t.y, cellSize * 0.55, color, sw);
  }
  if (hasHook) out += topHook(t, b.x, b.y, cellSize, color, sw);
  if (hasXCap) out += xCap(t, b.x, b.y, cellSize, color, sw);
  return `<g>${out}</g>`;
}

// Post stitch: a leg that wraps around the post of the stitch below rather
// than going into its top. front = bulge forward (toward viewer), back = away.
// Crochet-chart convention: a little J hook at the bottom; front-post hooks
// open right-downward, back-post left-downward.
function renderPost({ bottomAnchors, topAnchors, cellSize, color, crossbars = 0, front = true }) {
  const b = bottomAnchors[0];
  const t = topAnchors[0];
  const sw = SW(cellSize);
  const side = front ? 1 : -1;
  const r = cellSize * 0.32;
  // J-hook at the base: quadratic curve from a point offset sideways,
  // wrapping under "the post" back up to the stem.
  const hx = b.x + side * r;
  const hy = b.y + cellSize * 0.12;
  const cx = b.x + side * r * 1.4;
  const cy = b.y - cellSize * 0.05;
  let out = `<path d="M ${hx} ${hy} Q ${cx} ${cy} ${b.x} ${b.y}"
    stroke="${color}" stroke-width="${sw}" stroke-linecap="round" fill="none"/>`;
  out += leg(b, t, color, sw);
  for (let i = 0; i < crossbars; i++) {
    const f = (i + 1) / (crossbars + 1);
    const mx = b.x + (t.x - b.x) * f;
    const my = b.y + (t.y - b.y) * f;
    out += crossbar(mx, my, b.x, b.y, t.x, t.y, cellSize * 0.55, color, sw);
  }
  out += topHook(t, b.x, b.y, cellSize, color, sw);
  return `<g>${out}</g>`;
}

// ---------- stitch catalogue ----------

export const STITCHES = {

  // FOUNDATION
  ch: {
    id: 'ch', name: 'Chain', category: 'Foundation',
    height: 1, baseAnchors: 1, topAnchors: 1,
    description: 'A single chain link.',
    renderSVG({ bottomAnchors: [b], topAnchors: [t], cellSize, color }) {
      const sw = SW(cellSize);
      const cx = (b.x + t.x) / 2;
      const cy = (b.y + t.y) / 2;
      const rx = cellSize * 0.28;
      const ry = cellSize * 0.38;
      let dx = t.x - b.x, dy = t.y - b.y;
      const ang = Math.atan2(dy, dx) * 180 / Math.PI - 90;
      return `<g><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"
        transform="rotate(${ang} ${cx} ${cy})"
        fill="none" stroke="${color}" stroke-width="${sw}"/></g>`;
    }
  },

  sl: {
    id: 'sl', name: 'Slip Stitch', category: 'Foundation',
    height: 1, baseAnchors: 1, topAnchors: 1,
    description: 'Tiny filled bar.',
    renderSVG({ bottomAnchors: [b], topAnchors: [t], cellSize, color }) {
      const sw = SW(cellSize);
      const mx = (b.x + t.x) / 2, my = (b.y + t.y) / 2;
      return `<g>${leg(b, t, color, sw)}
        <circle cx="${mx}" cy="${my}" r="${cellSize*0.18}" fill="${color}"/></g>`;
    }
  },

  // BASIC — 1 → 1, varying height
  sc: {
    id: 'sc', name: 'Single Crochet', category: 'Basic',
    height: 1, baseAnchors: 1, topAnchors: 1,
    description: 'Short leg with X cap.',
    renderSVG(ctx) { return renderBasic({ ...ctx, crossbars: 0, hasHook: false, hasXCap: true }); }
  },

  hdc: {
    id: 'hdc', name: 'Half Double', category: 'Basic',
    height: 2, baseAnchors: 1, topAnchors: 1,
    description: 'Medium leg, hook top.',
    renderSVG(ctx) { return renderBasic({ ...ctx, crossbars: 0, hasHook: true }); }
  },

  dc: {
    id: 'dc', name: 'Double Crochet', category: 'Basic',
    height: 3, baseAnchors: 1, topAnchors: 1,
    description: 'Tall leg, 1 crossbar, hook.',
    renderSVG(ctx) { return renderBasic({ ...ctx, crossbars: 1, hasHook: true }); }
  },

  tr: {
    id: 'tr', name: 'Treble', category: 'Basic',
    height: 4, baseAnchors: 1, topAnchors: 1,
    description: 'Very tall, 2 crossbars.',
    renderSVG(ctx) { return renderBasic({ ...ctx, crossbars: 2, hasHook: true }); }
  },

  dtr: {
    id: 'dtr', name: 'Double Treble', category: 'Basic',
    height: 5, baseAnchors: 1, topAnchors: 1,
    description: 'Extra tall, 3 crossbars.',
    renderSVG(ctx) { return renderBasic({ ...ctx, crossbars: 3, hasHook: true }); }
  },

  // TEXTURED — 1 → 1, bulge on stem
  puff: {
    id: 'puff', name: 'Puff Stitch', category: 'Textured',
    height: 2, baseAnchors: 1, topAnchors: 1,
    description: 'Leg with oval puff.',
    renderSVG({ bottomAnchors: [b], topAnchors: [t], cellSize, color }) {
      return `<g>${leg(b, t, color, SW(cellSize))}${bulge(b, t, cellSize, color, 'puff')}</g>`;
    }
  },

  bobble: {
    id: 'bobble', name: 'Bobble', category: 'Textured',
    height: 2, baseAnchors: 1, topAnchors: 1,
    description: 'Leg with rounded bump.',
    renderSVG({ bottomAnchors: [b], topAnchors: [t], cellSize, color }) {
      return `<g>${leg(b, t, color, SW(cellSize))}${bulge(b, t, cellSize, color, 'bobble')}</g>`;
    }
  },

  popcorn: {
    id: 'popcorn', name: 'Popcorn', category: 'Textured',
    height: 2, baseAnchors: 1, topAnchors: 1,
    description: 'Leg with raised dome.',
    renderSVG({ bottomAnchors: [b], topAnchors: [t], cellSize, color }) {
      return `<g>${leg(b, t, color, SW(cellSize))}${bulge(b, t, cellSize, color, 'popcorn')}</g>`;
    }
  },

  bullion: {
    id: 'bullion', name: 'Bullion', category: 'Textured',
    height: 3, baseAnchors: 1, topAnchors: 1,
    description: 'Elongated coiled stem.',
    renderSVG({ bottomAnchors: [b], topAnchors: [t], cellSize, color }) {
      return `<g>${leg(b, t, color, SW(cellSize))}${bulge(b, t, cellSize, color, 'bullion')}</g>`;
    }
  },

  // SHAPING — these are the key cases for "pull stitches together"
  sc_inc: {
    id: 'sc_inc', name: 'SC Increase', category: 'Shaping',
    height: 1, baseAnchors: 1, topAnchors: 2,
    description: '2 sc legs splaying from one base.',
    renderSVG({ bottomAnchors: [b], topAnchors, cellSize, color }) {
      const sw = SW(cellSize);
      return `<g>${topAnchors.map(t => leg(b, t, color, sw) + xCap(t, b.x, b.y, cellSize, color, sw)).join('')}</g>`;
    }
  },

  sc_dec: {
    id: 'sc_dec', name: 'SC Decrease', category: 'Shaping',
    height: 1, baseAnchors: 2, topAnchors: 1,
    description: '2 sc legs merging into one top — pulls base together.',
    renderSVG({ bottomAnchors, topAnchors: [t], cellSize, color }) {
      const sw = SW(cellSize);
      return `<g>${bottomAnchors.map(b => leg(b, t, color, sw) + xCap(t, b.x, b.y, cellSize, color, sw)).join('')}</g>`;
    }
  },

  invdec: {
    id: 'invdec', name: 'Invisible Decrease', category: 'Shaping',
    height: 1, baseAnchors: 2, topAnchors: 1,
    description: 'Tighter merge variant.',
    renderSVG({ bottomAnchors, topAnchors: [t], cellSize, color }) {
      const sw = SW(cellSize);
      const legs = bottomAnchors.map(b => leg(b, t, color, sw)).join('');
      return `<g>${legs}<circle cx="${t.x}" cy="${t.y}" r="${cellSize*0.12}" fill="${color}"/></g>`;
    }
  },

  hdc_inc: {
    id: 'hdc_inc', name: 'HDC Increase', category: 'Shaping',
    height: 2, baseAnchors: 1, topAnchors: 2,
    description: '2 hdc legs from one base.',
    renderSVG({ bottomAnchors: [b], topAnchors, cellSize, color }) {
      const sw = SW(cellSize);
      return `<g>${topAnchors.map(t => leg(b, t, color, sw) + topHook(t, b.x, b.y, cellSize, color, sw)).join('')}</g>`;
    }
  },

  hdc_dec: {
    id: 'hdc_dec', name: 'HDC Decrease', category: 'Shaping',
    height: 2, baseAnchors: 2, topAnchors: 1,
    description: '2 hdc legs merging to one top.',
    renderSVG({ bottomAnchors, topAnchors: [t], cellSize, color }) {
      const sw = SW(cellSize);
      const legs = bottomAnchors.map(b => leg(b, t, color, sw)).join('');
      return `<g>${legs}${topHook(t, bottomAnchors[0].x, bottomAnchors[0].y, cellSize, color, sw)}</g>`;
    }
  },

  dc_inc: {
    id: 'dc_inc', name: 'DC Increase', category: 'Shaping',
    height: 3, baseAnchors: 1, topAnchors: 2,
    description: '2 dc legs from one base.',
    renderSVG({ bottomAnchors: [b], topAnchors, cellSize, color }) {
      const sw = SW(cellSize);
      const parts = topAnchors.map(t => {
        const mx = (b.x + t.x) / 2, my = (b.y + t.y) / 2;
        return leg(b, t, color, sw)
             + crossbar(mx, my, b.x, b.y, t.x, t.y, cellSize * 0.45, color, sw)
             + topHook(t, b.x, b.y, cellSize, color, sw);
      }).join('');
      return `<g>${parts}</g>`;
    }
  },

  dc_dec: {
    id: 'dc_dec', name: 'DC Decrease', category: 'Shaping',
    height: 3, baseAnchors: 2, topAnchors: 1,
    description: '2 dc legs merging into one top — pulls 2 stitches below together.',
    renderSVG({ bottomAnchors, topAnchors: [t], cellSize, color }) {
      const sw = SW(cellSize);
      const parts = bottomAnchors.map(b => {
        const mx = (b.x + t.x) / 2, my = (b.y + t.y) / 2;
        return leg(b, t, color, sw)
             + crossbar(mx, my, b.x, b.y, t.x, t.y, cellSize * 0.45, color, sw);
      }).join('');
      return `<g>${parts}${topHook(t, bottomAnchors[0].x, bottomAnchors[0].y, cellSize, color, sw)}</g>`;
    }
  },

  tr_dec: {
    id: 'tr_dec', name: 'TR Decrease', category: 'Shaping',
    height: 4, baseAnchors: 2, topAnchors: 1,
    description: '2 tr legs merging to one top.',
    renderSVG({ bottomAnchors, topAnchors: [t], cellSize, color }) {
      const sw = SW(cellSize);
      const parts = bottomAnchors.map(b => {
        let out = leg(b, t, color, sw);
        for (let i = 1; i <= 2; i++) {
          const f = i / 3;
          const cx = b.x + (t.x - b.x) * f;
          const cy = b.y + (t.y - b.y) * f;
          out += crossbar(cx, cy, b.x, b.y, t.x, t.y, cellSize * 0.4, color, sw);
        }
        return out;
      }).join('');
      return `<g>${parts}${topHook(t, bottomAnchors[0].x, bottomAnchors[0].y, cellSize, color, sw)}</g>`;
    }
  },

  // POST STITCHES — leg wraps around the post of the stitch below rather
  // than going into its top. Huge coverage for ribbing, cables, basketweave.
  fpsc: {
    id: 'fpsc', name: 'Front Post SC', category: 'Post',
    height: 1, baseAnchors: 1, topAnchors: 1,
    description: 'Worked around the post of the prev-row stitch from the front.',
    renderSVG(ctx) { return renderPost({ ...ctx, crossbars: 0, front: true }); }
  },
  bpsc: {
    id: 'bpsc', name: 'Back Post SC', category: 'Post',
    height: 1, baseAnchors: 1, topAnchors: 1,
    description: 'Worked around the post from the back.',
    renderSVG(ctx) { return renderPost({ ...ctx, crossbars: 0, front: false }); }
  },
  fphdc: {
    id: 'fphdc', name: 'Front Post HDC', category: 'Post',
    height: 2, baseAnchors: 1, topAnchors: 1,
    description: 'HDC around post from the front.',
    renderSVG(ctx) { return renderPost({ ...ctx, crossbars: 0, front: true }); }
  },
  bphdc: {
    id: 'bphdc', name: 'Back Post HDC', category: 'Post',
    height: 2, baseAnchors: 1, topAnchors: 1,
    description: 'HDC around post from the back.',
    renderSVG(ctx) { return renderPost({ ...ctx, crossbars: 0, front: false }); }
  },
  fpdc: {
    id: 'fpdc', name: 'Front Post DC', category: 'Post',
    height: 3, baseAnchors: 1, topAnchors: 1,
    description: 'DC around post from the front — raised stitch for ribbing/cables.',
    renderSVG(ctx) { return renderPost({ ...ctx, crossbars: 1, front: true }); }
  },
  bpdc: {
    id: 'bpdc', name: 'Back Post DC', category: 'Post',
    height: 3, baseAnchors: 1, topAnchors: 1,
    description: 'DC around post from the back — recessed stitch for ribbing/cables.',
    renderSVG(ctx) { return renderPost({ ...ctx, crossbars: 1, front: false }); }
  },

  // DECORATIVE — fans and gathers
  shell: {
    id: 'shell', name: 'Shell', category: 'Decorative',
    height: 3, baseAnchors: 1, topAnchors: 5,
    description: '5 dc legs fanning from one base anchor.',
    renderSVG({ bottomAnchors: [b], topAnchors, cellSize, color }) {
      const sw = SW(cellSize);
      const parts = topAnchors.map(t => {
        const mx = (b.x + t.x) / 2, my = (b.y + t.y) / 2;
        return leg(b, t, color, sw)
             + crossbar(mx, my, b.x, b.y, t.x, t.y, cellSize * 0.3, color, sw);
      }).join('');
      return `<g>${parts}</g>`;
    }
  },

  mini_shell: {
    id: 'mini_shell', name: 'Mini Shell', category: 'Decorative',
    height: 2, baseAnchors: 1, topAnchors: 3,
    description: '3 hdc legs fanning from one base.',
    renderSVG({ bottomAnchors: [b], topAnchors, cellSize, color }) {
      const sw = SW(cellSize);
      return `<g>${topAnchors.map(t => leg(b, t, color, sw)).join('')}</g>`;
    }
  },

  v_stitch: {
    id: 'v_stitch', name: 'V-Stitch', category: 'Decorative',
    height: 3, baseAnchors: 1, topAnchors: 2,
    description: '2 dc legs from one base with a visible V gap.',
    renderSVG({ bottomAnchors: [b], topAnchors, cellSize, color }) {
      const sw = SW(cellSize);
      const parts = topAnchors.map(t => {
        const mx = (b.x + t.x) / 2, my = (b.y + t.y) / 2;
        return leg(b, t, color, sw)
             + crossbar(mx, my, b.x, b.y, t.x, t.y, cellSize * 0.4, color, sw);
      }).join('');
      return `<g>${parts}</g>`;
    }
  },

  cluster3: {
    id: 'cluster3', name: 'Cluster (3-st)', category: 'Decorative',
    height: 3, baseAnchors: 3, topAnchors: 1,
    description: '3 dc legs merging to one top — inverted fan.',
    renderSVG({ bottomAnchors, topAnchors: [t], cellSize, color }) {
      const sw = SW(cellSize);
      const parts = bottomAnchors.map(b => {
        const mx = (b.x + t.x) / 2, my = (b.y + t.y) / 2;
        return leg(b, t, color, sw)
             + crossbar(mx, my, b.x, b.y, t.x, t.y, cellSize * 0.3, color, sw);
      }).join('');
      return `<g>${parts}</g>`;
    }
  },

  picot: {
    id: 'picot', name: 'Picot', category: 'Decorative',
    height: 1, baseAnchors: 1, topAnchors: 1,
    description: 'Short leg with a decorative loop on top.',
    renderSVG({ bottomAnchors: [b], topAnchors: [t], cellSize, color }) {
      const sw = SW(cellSize);
      const r = cellSize * 0.22;
      return `<g>${leg(b, t, color, sw)}
        <circle cx="${t.x}" cy="${t.y - r*0.4}" r="${r}" fill="none"
          stroke="${color}" stroke-width="${sw}"/></g>`;
    }
  },

  // ROUND-MODE CENTER
  magic_ring: {
    id: 'magic_ring', name: 'Magic Ring', category: 'Foundation',
    height: 1, baseAnchors: 0, topAnchors: 6,   // default; round mode lets user override
    description: 'Starting ring — 0 base anchors, N top anchors (default 6).',
    renderSVG({ topAnchors, cellSize, color }) {
      // Draw at the centroid of the top anchors.
      const cx = topAnchors.reduce((s, a) => s + a.x, 0) / topAnchors.length;
      const cy = topAnchors.reduce((s, a) => s + a.y, 0) / topAnchors.length;
      const r = cellSize * 0.45;
      const sw = SW(cellSize);
      const ticks = topAnchors.map(a => {
        const dx = a.x - cx, dy = a.y - cy;
        const n = Math.hypot(dx, dy) || 1;
        const ux = dx/n, uy = dy/n;
        return `<line x1="${cx + ux*r*0.6}" y1="${cy + uy*r*0.6}"
                      x2="${cx + ux*r*1.05}" y2="${cy + uy*r*1.05}"
                      stroke="${color}" stroke-width="${sw*0.8}" stroke-linecap="round"/>`;
      }).join('');
      return `<g><circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
        stroke="${color}" stroke-width="${sw}"/>${ticks}</g>`;
    }
  },
};

// Category order for palette grouping
export const CATEGORIES = ['Foundation', 'Basic', 'Shaping', 'Post', 'Textured', 'Decorative', 'Lace'];

// Helper: render a stitch into a standalone <svg> for palette previews.
export function renderPreview(stitchId, size = 48, color = '#c084fc') {
  const def = STITCHES[stitchId];
  if (!def) return '';
  const cellSize = size / Math.max(def.height, 2);
  const pad = cellSize * 0.3;
  const w = Math.max(
    (def.topAnchors || 1),
    (def.baseAnchors || 1)
  ) * cellSize + pad * 2;
  const h = def.height * cellSize + pad * 2;

  const bottomY = h - pad;
  const topY    = pad;
  const baseN = def.baseAnchors || 1;
  const topN  = def.topAnchors  || 1;
  const bottomAnchors = [];
  const topAnchors = [];
  const widest = Math.max(baseN, topN, 1);
  const spanW = (widest - 1) * cellSize;
  const spanLeft = (w - spanW) / 2;
  // Bottom anchors evenly spaced inside the footprint
  for (let i = 0; i < baseN; i++) {
    const t = baseN === 1 ? 0.5 : i / (baseN - 1);
    bottomAnchors.push({ x: spanLeft + t * spanW, y: bottomY });
  }
  for (let i = 0; i < topN; i++) {
    const t = topN === 1 ? 0.5 : i / (topN - 1);
    topAnchors.push({ x: spanLeft + t * spanW, y: topY });
  }
  if (baseN === 0) {
    // magic ring — fake bottom for rendering center
  }
  const body = def.renderSVG({ bottomAnchors, topAnchors, cellSize, color });
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>`;
}
