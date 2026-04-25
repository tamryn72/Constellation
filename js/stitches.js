// Stitch library. Every stitch is one or more thick "legs" drawn between
// anchor points the grid engine has already computed. Renderers return a
// <g> fragment in the grid's coordinate space.
//
// Renderers accept a `style` option:
//   'standard'  — traditional chart glyphs (leg + crossbars + hook/X cap)
//   'realistic' — stacked yarn-loop ovals shaped like the actual stitch:
//                 ch = horizontal oval at top; sc = 1 vertical loop;
//                 dc = 2 loops; tr = 3; dtr = 4; trtr = 5. Each loop
//                 comes from center-bottom and stacks upward; inc/dec
//                 pulls loops sideways because the top anchor moves.

const SW = (cellSize) => Math.max(1.2, cellSize * 0.12);   // stroke scales with zoom, with a floor for low-zoom readability

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

// ---------- realistic-style helpers ----------

// One vertical yarn-loop ellipse, oriented along the leg direction (b→t).
// Represents one "pull-through" in the stitch.
function loopOval(cx, cy, rx, ry, angleDeg, color, sw, fillOp) {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"
    transform="rotate(${angleDeg} ${cx} ${cy})"
    fill="${color}" fill-opacity="${fillOp}"
    stroke="${color}" stroke-width="${sw}"
    stroke-linejoin="round"/>`;
}

// Stack N loop-ovals along the leg from bottom anchor b to top anchor t.
// Loops slightly overlap so they read as one continuous stitch. If the top
// anchor is offset horizontally (increase/decrease), the whole stack tilts.
function stackedLoops(b, t, n, cellSize, color, opts = {}) {
  if (n <= 0) return '';
  const dx = t.x - b.x;
  const dy = t.y - b.y;
  const len = Math.hypot(dx, dy) || 1;
  // Ellipses are drawn with their long axis vertical (ry > rx), so the
  // rotation needed to align to (dx,dy) is atan2(dy,dx) - 90°.
  const angle = Math.atan2(dy, dx) * 180 / Math.PI - 90;

  const widthFrac = opts.widthFrac ?? 0.26;    // loop width relative to cellSize
  const overlap   = opts.overlap   ?? 0.22;    // 0 = touching, 0.25 = pleasant overlap
  const rx = cellSize * widthFrac;
  // Solve: n loops of height 2*ry overlapping by `overlap` share total len.
  // len = 2*ry*n - 2*ry*overlap*(n-1)  ⇒  ry = len / (2 * (n - overlap*(n-1)))
  const ry = len / (2 * (n - overlap * (n - 1)));
  const step = 2 * ry * (1 - overlap);
  const sw = SW(cellSize) * (opts.strokeScale ?? 0.85);
  const fillOp = opts.fillOp ?? 0.18;

  let out = '';
  // Center of the lowest loop sits ry from the bottom anchor along the leg.
  for (let i = 0; i < n; i++) {
    const d = ry + i * step;
    const cx = b.x + (dx / len) * d;
    const cy = b.y + (dy / len) * d;
    out += loopOval(cx, cy, rx, ry, angle, color, sw, fillOp);
  }
  return out;
}

// Horizontal chain-link oval centered at (cx, cy). Used for chain (top of cell)
// and for chain-space beads.
function chainOval(cx, cy, cellSize, color, opts = {}) {
  const rx = cellSize * (opts.rx ?? 0.36);
  const ry = cellSize * (opts.ry ?? 0.16);
  const sw = SW(cellSize) * (opts.strokeScale ?? 0.85);
  const fillOp = opts.fillOp ?? 0.18;
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"
    fill="${color}" fill-opacity="${fillOp}"
    stroke="${color}" stroke-width="${sw}"/>`;
}

// How many yarn-loops a stitch has in realistic mode. Follows the convention
// "(yarn-overs + 1) pull-throughs", which is why dc=2, tr=3, dtr=4, trtr=5.
const LOOP_COUNT = {
  sl: 1, sc: 1, hdc: 1,
  dc: 2, tr: 3, dtr: 4, trtr: 5,
};

// ---------- renderers ----------

function renderBasic({ bottomAnchors, topAnchors, cellSize, color, style, crossbars = 0, hasHook = true, hasXCap = false, loopCount = 1 }) {
  const b = bottomAnchors[0];
  const t = topAnchors[0];
  const sw = SW(cellSize);

  if (style === 'realistic') {
    return `<g>${stackedLoops(b, t, loopCount, cellSize, color)}</g>`;
  }

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

// Chain-space factory. Renders N tiny chain links in an upward arc between
// leftmost bottom anchor and rightmost top anchor — the standard lace glyph
// for "ch N, skip N below". Consumes N bases, produces N tops.
function makeChainSpace(N) {
  return {
    id: `ch_sp_${N}`, name: `ch-${N} space`, category: 'Lace',
    height: 1, baseAnchors: N, topAnchors: N,
    description: `Chain space of ${N}: ch ${N}, skip ${N} stitch${N === 1 ? '' : 'es'} below.`,
    renderSVG({ bottomAnchors, topAnchors, cellSize, color, style }) {
      const sw = SW(cellSize);
      const bL = bottomAnchors[0];
      const bR = bottomAnchors[bottomAnchors.length - 1];
      const tL = topAnchors[0];
      const tR = topAnchors[topAnchors.length - 1];
      // Upward arch from mid-bottom to mid-top covering the span
      const leftX  = Math.min(bL.x, tL.x);
      const rightX = Math.max(bR.x, tR.x);
      const midX = (leftX + rightX) / 2;
      const topY = Math.min(tL.y, tR.y);
      const bottomY = Math.max(bL.y, bR.y);
      const archY = topY - cellSize * 0.05;
      const arch = `<path d="M ${leftX} ${bottomY - cellSize*0.12}
        Q ${midX} ${archY - cellSize*0.4} ${rightX} ${bottomY - cellSize*0.12}"
        stroke="${color}" stroke-width="${sw*0.75}" stroke-linecap="round" fill="none"/>`;
      // Chain beads along the arch — horizontal ovals in realistic mode.
      let beads = '';
      for (let i = 0; i < N; i++) {
        const t = N === 1 ? 0.5 : i / (N - 1);
        const x = leftX + t * (rightX - leftX);
        const u = 1 - t;
        const y = u*u*(bottomY - cellSize*0.12) + 2*u*t*(archY - cellSize*0.4) + t*t*(bottomY - cellSize*0.12);
        if (style === 'realistic') {
          beads += chainOval(x, y, cellSize, color, { rx: 0.22, ry: 0.11 });
        } else {
          beads += `<ellipse cx="${x}" cy="${y}" rx="${cellSize*0.15}" ry="${cellSize*0.2}"
            transform="rotate(${-90 + (t-0.5)*60} ${x} ${y})"
            fill="none" stroke="${color}" stroke-width="${sw*0.6}"/>`;
        }
      }
      return `<g>${arch}${beads}</g>`;
    }
  };
}

// Post stitch: a leg that wraps around the post of the stitch below rather
// than going into its top. front = bulge forward (toward viewer), back = away.
// Crochet-chart convention: a little J hook at the bottom; front-post hooks
// open right-downward, back-post left-downward.
function renderPost({ bottomAnchors, topAnchors, cellSize, color, style, crossbars = 0, loopCount = 1, front = true }) {
  const b = bottomAnchors[0];
  const t = topAnchors[0];
  const sw = SW(cellSize);
  const side = front ? 1 : -1;
  const r = cellSize * 0.32;
  // J-hook at the base, kept in both styles so post vs. non-post reads at a
  // glance. front-post hook opens right; back-post opens left.
  const hx = b.x + side * r;
  const hy = b.y + cellSize * 0.12;
  const cx = b.x + side * r * 1.4;
  const cy = b.y - cellSize * 0.05;
  let out = `<path d="M ${hx} ${hy} Q ${cx} ${cy} ${b.x} ${b.y}"
    stroke="${color}" stroke-width="${sw}" stroke-linecap="round" fill="none"/>`;

  if (style === 'realistic') {
    out += stackedLoops(b, t, loopCount, cellSize, color);
    return `<g>${out}</g>`;
  }

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
    renderSVG({ bottomAnchors: [b], topAnchors: [t], cellSize, color, style }) {
      const sw = SW(cellSize);
      if (style === 'realistic') {
        // Horizontal oval sitting at the TOP of the cell.
        const cx = t.x;
        const cy = t.y + cellSize * 0.12;
        return `<g>${chainOval(cx, cy, cellSize, color)}</g>`;
      }
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
    renderSVG({ bottomAnchors: [b], topAnchors: [t], cellSize, color, style }) {
      const sw = SW(cellSize);
      if (style === 'realistic') {
        // Tight little loop — one small oval, more squashed than sc.
        return `<g>${stackedLoops(b, t, 1, cellSize, color, { widthFrac: 0.20, fillOp: 0.35 })}</g>`;
      }
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
    renderSVG(ctx) { return renderBasic({ ...ctx, crossbars: 0, hasHook: false, hasXCap: true, loopCount: LOOP_COUNT.sc }); }
  },

  hdc: {
    id: 'hdc', name: 'Half Double', category: 'Basic',
    height: 2, baseAnchors: 1, topAnchors: 1,
    description: 'Medium leg, hook top.',
    renderSVG(ctx) { return renderBasic({ ...ctx, crossbars: 0, hasHook: true, loopCount: LOOP_COUNT.hdc }); }
  },

  dc: {
    id: 'dc', name: 'Double Crochet', category: 'Basic',
    height: 3, baseAnchors: 1, topAnchors: 1,
    description: 'Tall leg, 1 crossbar, hook.',
    renderSVG(ctx) { return renderBasic({ ...ctx, crossbars: 1, hasHook: true, loopCount: LOOP_COUNT.dc }); }
  },

  tr: {
    id: 'tr', name: 'Treble', category: 'Basic',
    height: 4, baseAnchors: 1, topAnchors: 1,
    description: 'Very tall, 2 crossbars.',
    renderSVG(ctx) { return renderBasic({ ...ctx, crossbars: 2, hasHook: true, loopCount: LOOP_COUNT.tr }); }
  },

  dtr: {
    id: 'dtr', name: 'Double Treble', category: 'Basic',
    height: 5, baseAnchors: 1, topAnchors: 1,
    description: 'Extra tall, 3 crossbars.',
    renderSVG(ctx) { return renderBasic({ ...ctx, crossbars: 3, hasHook: true, loopCount: LOOP_COUNT.dtr }); }
  },

  trtr: {
    id: 'trtr', name: 'Triple Treble', category: 'Basic',
    height: 6, baseAnchors: 1, topAnchors: 1,
    description: 'Tallest basic stitch, 4 crossbars.',
    renderSVG(ctx) { return renderBasic({ ...ctx, crossbars: 4, hasHook: true, loopCount: LOOP_COUNT.trtr }); }
  },

  rsc: {
    id: 'rsc', name: 'Reverse SC (crab)', category: 'Basic',
    height: 1, baseAnchors: 1, topAnchors: 1,
    description: 'Reverse single crochet / crab stitch — worked left-to-right for a twisted edge.',
    renderSVG({ bottomAnchors: [b], topAnchors: [t], cellSize, color }) {
      const sw = SW(cellSize);
      // Wavy/twisted leg — a subtle s-curve plus a reversed-direction tick.
      const mx = (b.x + t.x) / 2;
      const my = (b.y + t.y) / 2;
      const px = cellSize * 0.18;
      const out = `<path d="M ${b.x} ${b.y} C ${b.x + px} ${(b.y+my)/2}, ${t.x - px} ${(t.y+my)/2}, ${t.x} ${t.y}"
        stroke="${color}" stroke-width="${sw}" stroke-linecap="round" fill="none"/>`;
      // little reverse arrow mark near top
      const arr = `<path d="M ${t.x - cellSize*0.22} ${t.y + cellSize*0.22} l ${cellSize*0.18} ${-cellSize*0.12} m ${-cellSize*0.18} ${cellSize*0.12} l ${cellSize*0.05} ${cellSize*0.18}"
        stroke="${color}" stroke-width="${sw*0.7}" stroke-linecap="round" fill="none"/>`;
      return `<g>${out}${arr}</g>`;
    }
  },

  spike: {
    id: 'spike', name: 'Spike Stitch', category: 'Basic',
    height: 2, baseAnchors: 1, topAnchors: 1,
    description: 'Long sc worked down into a row below current — creates a vertical spike.',
    renderSVG({ bottomAnchors: [b], topAnchors: [t], cellSize, color }) {
      const sw = SW(cellSize);
      // Extend the leg downward past the bottom anchor for the spike effect
      const extB = { x: b.x, y: b.y + cellSize * 0.55 };
      let out = `<line x1="${extB.x}" y1="${extB.y}" x2="${t.x}" y2="${t.y}"
        stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>`;
      // Pointed bottom mark
      out += `<path d="M ${extB.x - cellSize*0.15} ${extB.y - cellSize*0.1} L ${extB.x} ${extB.y + cellSize*0.05} L ${extB.x + cellSize*0.15} ${extB.y - cellSize*0.1}"
        stroke="${color}" stroke-width="${sw*0.85}" stroke-linecap="round" fill="none"/>`;
      // Small X cap near top (shares sc identity)
      out += xCap(t, b.x, b.y, cellSize, color, sw);
      return `<g>${out}</g>`;
    }
  },

  sc3tog: {
    id: 'sc3tog', name: 'SC 3-together', category: 'Shaping',
    height: 1, baseAnchors: 3, topAnchors: 1,
    description: '3 sc legs merging to one top — pulls 3 stitches below together.',
    renderSVG({ bottomAnchors, topAnchors: [t], cellSize, color, style }) {
      const sw = SW(cellSize);
      if (style === 'realistic') {
        return `<g>${bottomAnchors.map(b =>
          stackedLoops(b, t, LOOP_COUNT.sc, cellSize, color)
        ).join('')}</g>`;
      }
      return `<g>${bottomAnchors.map(b =>
        leg(b, t, color, sw) + xCap(t, b.x, b.y, cellSize, color, sw)
      ).join('')}</g>`;
    }
  },

  hdc3tog: {
    id: 'hdc3tog', name: 'HDC 3-together', category: 'Shaping',
    height: 2, baseAnchors: 3, topAnchors: 1,
    description: '3 hdc legs merging to one top.',
    renderSVG({ bottomAnchors, topAnchors: [t], cellSize, color, style }) {
      const sw = SW(cellSize);
      if (style === 'realistic') {
        return `<g>${bottomAnchors.map(b =>
          stackedLoops(b, t, LOOP_COUNT.hdc, cellSize, color)
        ).join('')}</g>`;
      }
      const legs = bottomAnchors.map(b => leg(b, t, color, sw)).join('');
      return `<g>${legs}${topHook(t, bottomAnchors[1].x, bottomAnchors[1].y, cellSize, color, sw)}</g>`;
    }
  },

  // TEXTURED — 1 → 1, bulge on stem
  puff: {
    id: 'puff', name: 'Puff Stitch', category: 'Textured',
    height: 2, baseAnchors: 1, topAnchors: 1,
    description: 'Leg with oval puff.',
    renderSVG({ bottomAnchors: [b], topAnchors: [t], cellSize, color, style }) {
      if (style === 'realistic') {
        // Three fat, fully-overlapped loops read as a puff.
        return `<g>${stackedLoops(b, t, 3, cellSize, color, { widthFrac: 0.32, overlap: 0.55, fillOp: 0.28 })}</g>`;
      }
      return `<g>${leg(b, t, color, SW(cellSize))}${bulge(b, t, cellSize, color, 'puff')}</g>`;
    }
  },

  bobble: {
    id: 'bobble', name: 'Bobble', category: 'Textured',
    height: 2, baseAnchors: 1, topAnchors: 1,
    description: 'Leg with rounded bump.',
    renderSVG({ bottomAnchors: [b], topAnchors: [t], cellSize, color, style }) {
      if (style === 'realistic') {
        return `<g>${stackedLoops(b, t, 4, cellSize, color, { widthFrac: 0.30, overlap: 0.6, fillOp: 0.35 })}</g>`;
      }
      return `<g>${leg(b, t, color, SW(cellSize))}${bulge(b, t, cellSize, color, 'bobble')}</g>`;
    }
  },

  popcorn: {
    id: 'popcorn', name: 'Popcorn', category: 'Textured',
    height: 2, baseAnchors: 1, topAnchors: 1,
    description: 'Leg with raised dome.',
    renderSVG({ bottomAnchors: [b], topAnchors: [t], cellSize, color, style }) {
      if (style === 'realistic') {
        return `<g>${stackedLoops(b, t, 5, cellSize, color, { widthFrac: 0.34, overlap: 0.65, fillOp: 0.45 })}</g>`;
      }
      return `<g>${leg(b, t, color, SW(cellSize))}${bulge(b, t, cellSize, color, 'popcorn')}</g>`;
    }
  },

  bullion: {
    id: 'bullion', name: 'Bullion', category: 'Textured',
    height: 3, baseAnchors: 1, topAnchors: 1,
    description: 'Elongated coiled stem.',
    renderSVG({ bottomAnchors: [b], topAnchors: [t], cellSize, color, style }) {
      if (style === 'realistic') {
        // Many tight coils up the leg.
        return `<g>${stackedLoops(b, t, 7, cellSize, color, { widthFrac: 0.22, overlap: 0.4, fillOp: 0.2 })}</g>`;
      }
      return `<g>${leg(b, t, color, SW(cellSize))}${bulge(b, t, cellSize, color, 'bullion')}</g>`;
    }
  },

  // SHAPING — these are the key cases for "pull stitches together"
  sc_inc: {
    id: 'sc_inc', name: 'SC Increase', category: 'Shaping',
    height: 1, baseAnchors: 1, topAnchors: 2,
    description: '2 sc legs splaying from one base.',
    renderSVG({ bottomAnchors: [b], topAnchors, cellSize, color, style }) {
      const sw = SW(cellSize);
      if (style === 'realistic') {
        return `<g>${topAnchors.map(t => stackedLoops(b, t, LOOP_COUNT.sc, cellSize, color)).join('')}</g>`;
      }
      return `<g>${topAnchors.map(t => leg(b, t, color, sw) + xCap(t, b.x, b.y, cellSize, color, sw)).join('')}</g>`;
    }
  },

  sc_dec: {
    id: 'sc_dec', name: 'SC Decrease', category: 'Shaping',
    height: 1, baseAnchors: 2, topAnchors: 1,
    description: '2 sc legs merging into one top — pulls base together.',
    renderSVG({ bottomAnchors, topAnchors: [t], cellSize, color, style }) {
      const sw = SW(cellSize);
      if (style === 'realistic') {
        return `<g>${bottomAnchors.map(b => stackedLoops(b, t, LOOP_COUNT.sc, cellSize, color)).join('')}</g>`;
      }
      return `<g>${bottomAnchors.map(b => leg(b, t, color, sw) + xCap(t, b.x, b.y, cellSize, color, sw)).join('')}</g>`;
    }
  },

  invdec: {
    id: 'invdec', name: 'Invisible Decrease', category: 'Shaping',
    height: 1, baseAnchors: 2, topAnchors: 1,
    description: 'Tighter merge variant.',
    renderSVG({ bottomAnchors, topAnchors: [t], cellSize, color, style }) {
      const sw = SW(cellSize);
      if (style === 'realistic') {
        // Slimmer loops so the merge reads as tighter than sc_dec.
        return `<g>${bottomAnchors.map(b =>
          stackedLoops(b, t, LOOP_COUNT.sc, cellSize, color, { widthFrac: 0.2 })
        ).join('')}</g>`;
      }
      const legs = bottomAnchors.map(b => leg(b, t, color, sw)).join('');
      return `<g>${legs}<circle cx="${t.x}" cy="${t.y}" r="${cellSize*0.12}" fill="${color}"/></g>`;
    }
  },

  hdc_inc: {
    id: 'hdc_inc', name: 'HDC Increase', category: 'Shaping',
    height: 2, baseAnchors: 1, topAnchors: 2,
    description: '2 hdc legs from one base.',
    renderSVG({ bottomAnchors: [b], topAnchors, cellSize, color, style }) {
      const sw = SW(cellSize);
      if (style === 'realistic') {
        return `<g>${topAnchors.map(t => stackedLoops(b, t, LOOP_COUNT.hdc, cellSize, color)).join('')}</g>`;
      }
      return `<g>${topAnchors.map(t => leg(b, t, color, sw) + topHook(t, b.x, b.y, cellSize, color, sw)).join('')}</g>`;
    }
  },

  hdc_dec: {
    id: 'hdc_dec', name: 'HDC Decrease', category: 'Shaping',
    height: 2, baseAnchors: 2, topAnchors: 1,
    description: '2 hdc legs merging to one top.',
    renderSVG({ bottomAnchors, topAnchors: [t], cellSize, color, style }) {
      const sw = SW(cellSize);
      if (style === 'realistic') {
        return `<g>${bottomAnchors.map(b => stackedLoops(b, t, LOOP_COUNT.hdc, cellSize, color)).join('')}</g>`;
      }
      const legs = bottomAnchors.map(b => leg(b, t, color, sw)).join('');
      return `<g>${legs}${topHook(t, bottomAnchors[0].x, bottomAnchors[0].y, cellSize, color, sw)}</g>`;
    }
  },

  dc_inc: {
    id: 'dc_inc', name: 'DC Increase', category: 'Shaping',
    height: 3, baseAnchors: 1, topAnchors: 2,
    description: '2 dc legs from one base.',
    renderSVG({ bottomAnchors: [b], topAnchors, cellSize, color, style }) {
      const sw = SW(cellSize);
      if (style === 'realistic') {
        return `<g>${topAnchors.map(t => stackedLoops(b, t, LOOP_COUNT.dc, cellSize, color)).join('')}</g>`;
      }
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
    renderSVG({ bottomAnchors, topAnchors: [t], cellSize, color, style }) {
      const sw = SW(cellSize);
      if (style === 'realistic') {
        return `<g>${bottomAnchors.map(b => stackedLoops(b, t, LOOP_COUNT.dc, cellSize, color)).join('')}</g>`;
      }
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
    renderSVG({ bottomAnchors, topAnchors: [t], cellSize, color, style }) {
      const sw = SW(cellSize);
      if (style === 'realistic') {
        return `<g>${bottomAnchors.map(b => stackedLoops(b, t, LOOP_COUNT.tr, cellSize, color)).join('')}</g>`;
      }
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
    renderSVG(ctx) { return renderPost({ ...ctx, crossbars: 0, loopCount: LOOP_COUNT.sc, front: true }); }
  },
  bpsc: {
    id: 'bpsc', name: 'Back Post SC', category: 'Post',
    height: 1, baseAnchors: 1, topAnchors: 1,
    description: 'Worked around the post from the back.',
    renderSVG(ctx) { return renderPost({ ...ctx, crossbars: 0, loopCount: LOOP_COUNT.sc, front: false }); }
  },
  fphdc: {
    id: 'fphdc', name: 'Front Post HDC', category: 'Post',
    height: 2, baseAnchors: 1, topAnchors: 1,
    description: 'HDC around post from the front.',
    renderSVG(ctx) { return renderPost({ ...ctx, crossbars: 0, loopCount: LOOP_COUNT.hdc, front: true }); }
  },
  bphdc: {
    id: 'bphdc', name: 'Back Post HDC', category: 'Post',
    height: 2, baseAnchors: 1, topAnchors: 1,
    description: 'HDC around post from the back.',
    renderSVG(ctx) { return renderPost({ ...ctx, crossbars: 0, loopCount: LOOP_COUNT.hdc, front: false }); }
  },
  fpdc: {
    id: 'fpdc', name: 'Front Post DC', category: 'Post',
    height: 3, baseAnchors: 1, topAnchors: 1,
    description: 'DC around post from the front — raised stitch for ribbing/cables.',
    renderSVG(ctx) { return renderPost({ ...ctx, crossbars: 1, loopCount: LOOP_COUNT.dc, front: true }); }
  },
  bpdc: {
    id: 'bpdc', name: 'Back Post DC', category: 'Post',
    height: 3, baseAnchors: 1, topAnchors: 1,
    description: 'DC around post from the back — recessed stitch for ribbing/cables.',
    renderSVG(ctx) { return renderPost({ ...ctx, crossbars: 1, loopCount: LOOP_COUNT.dc, front: false }); }
  },

  // DECORATIVE — fans and gathers
  shell: {
    id: 'shell', name: 'Shell', category: 'Decorative',
    height: 3, baseAnchors: 1, topAnchors: 5,
    description: '5 dc legs fanning from one base anchor.',
    renderSVG({ bottomAnchors: [b], topAnchors, cellSize, color, style }) {
      const sw = SW(cellSize);
      if (style === 'realistic') {
        // Fan of dc loops — each pair of ovals tilts toward its top anchor,
        // so they splay out like a real shell.
        return `<g>${topAnchors.map(t =>
          stackedLoops(b, t, LOOP_COUNT.dc, cellSize, color, { widthFrac: 0.20 })
        ).join('')}</g>`;
      }
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
    renderSVG({ bottomAnchors: [b], topAnchors, cellSize, color, style }) {
      const sw = SW(cellSize);
      if (style === 'realistic') {
        return `<g>${topAnchors.map(t =>
          stackedLoops(b, t, LOOP_COUNT.hdc, cellSize, color, { widthFrac: 0.22 })
        ).join('')}</g>`;
      }
      return `<g>${topAnchors.map(t => leg(b, t, color, sw)).join('')}</g>`;
    }
  },

  v_stitch: {
    id: 'v_stitch', name: 'V-Stitch', category: 'Decorative',
    height: 3, baseAnchors: 1, topAnchors: 2,
    description: '2 dc legs from one base with a visible V gap.',
    renderSVG({ bottomAnchors: [b], topAnchors, cellSize, color, style }) {
      const sw = SW(cellSize);
      if (style === 'realistic') {
        return `<g>${topAnchors.map(t =>
          stackedLoops(b, t, LOOP_COUNT.dc, cellSize, color)
        ).join('')}</g>`;
      }
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
    renderSVG({ bottomAnchors, topAnchors: [t], cellSize, color, style }) {
      const sw = SW(cellSize);
      if (style === 'realistic') {
        return `<g>${bottomAnchors.map(b =>
          stackedLoops(b, t, LOOP_COUNT.dc, cellSize, color, { widthFrac: 0.20 })
        ).join('')}</g>`;
      }
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
    renderSVG({ bottomAnchors: [b], topAnchors: [t], cellSize, color, style }) {
      const sw = SW(cellSize);
      const r = cellSize * 0.22;
      if (style === 'realistic') {
        // Single sc loop plus a small filled chain oval on top.
        return `<g>${stackedLoops(b, t, 1, cellSize, color)}
          ${chainOval(t.x, t.y - r*0.5, cellSize, color, { rx: 0.2, ry: 0.12, fillOp: 0.3 })}</g>`;
      }
      return `<g>${leg(b, t, color, sw)}
        <circle cx="${t.x}" cy="${t.y - r*0.4}" r="${r}" fill="none"
          stroke="${color}" stroke-width="${sw}"/></g>`;
    }
  },

  // LACE / FILET — chain-space presets. A ch-N spans N stitches below
  // (skipped) and produces N tops above, rendered as a thin arch.
  ch_sp_2: makeChainSpace(2),
  ch_sp_3: makeChainSpace(3),
  ch_sp_5: makeChainSpace(5),

  // Skip: consumes one base anchor below, produces no tops above. Renders as
  // a faint dotted dot at the bottom of the cell so you can see what you've
  // placed but it doesn't read as a stitch in the chart.
  sk: {
    id: 'sk', name: 'Skip', category: 'Lace',
    height: 1, baseAnchors: 1, topAnchors: 0,
    description: 'Skip the next stitch (sk 1) — base consumed, no stitch worked.',
    renderSVG({ bottomAnchors: [b], cellSize, color }) {
      const r = cellSize * 0.10;
      return `<g><circle cx="${b.x}" cy="${b.y - cellSize*0.25}" r="${r}"
        fill="none" stroke="${color}" stroke-width="${SW(cellSize)*0.55}"
        stroke-dasharray="2 2" opacity="0.55"/></g>`;
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
export function renderPreview(stitchId, size = 48, color = '#c084fc', style = 'realistic') {
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
  const body = def.renderSVG({ bottomAnchors, topAnchors, cellSize, color, style });
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>`;
}
