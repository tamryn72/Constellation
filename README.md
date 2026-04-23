# Constellation
Crochet pattern planner
# Crochet Pattern Designer — Full Technical Specification

---

## Project Overview

A browser-based visual crochet pattern designer. Two modes: flat grid and radial/round. Stitches are SVG icons that look like real stitches and occupy proportional grid space. Built as a single HTML/CSS/JS file (no framework dependencies for v1).

---

## File Structure

```
crochet-designer/
├── index.html          # Main app shell
├── css/
│   ├── app.css         # Layout, grid, UI
│   └── palette.css     # Stitch palette panel
├── js/
│   ├── main.js         # App init, mode switching
│   ├── grid.js         # Flat grid engine
│   ├── radial.js       # Round grid engine
│   ├── stitches.js     # Stitch definitions + SVG renderers
│   ├── palette.js      # Palette UI + selection state
│   ├── tools.js        # Place, erase, color, pan, zoom
│   └── export.js       # PNG + JSON save/load
└── assets/
    └── icons/          # Any static fallback icons
```

---

## Data Architecture

### Core Concept: Anchors and Legs

Every stitch is built from one or more **legs** — thick lines drawn between two **anchor points**. A leg's bottom connects to an anchor in the row below; its top exposes an anchor for the row above. This is the whole model:

- **Basic stitch (sc, hdc, dc, tr...):** 1 leg, 1 bottom anchor → 1 top anchor. Height varies.
- **Increase:** 2 legs sharing 1 bottom anchor → 2 top anchors. Legs splay outward.
- **Decrease:** 2 legs sharing 1 top anchor ← 2 bottom anchors. Legs lean inward and pull the stitches below together (mathematically correct — the top anchor sits midway between the two base anchors).
- **Shell:** 5 legs sharing 1 bottom anchor → 5 top anchors. Natural fan.
- **Cluster:** N legs sharing 1 top anchor ← N bottom anchors. Inverted fan (multi-decrease).
- **V-stitch:** 2 legs sharing 1 bottom anchor → 2 top anchors with a visual gap.
- **Puff / bobble / popcorn:** 1 leg, 1 → 1, rendered with a bulge on the stem.
- **Chain / slip stitch:** 1 leg, 1 → 1, very short.

Layout math: each row is a sequence of stitches. Walking the row left to right, each stitch consumes `baseAnchors` anchors from the row below and emits `topAnchors` anchors upward. Row width (in anchor units) = sum of `topAnchors`. The row below must expose at least that many top anchors. Anchor x-positions are computed, not stored — which means decreases/increases naturally reshape row widths.

### Stitch Definition Object
```javascript
{
  id: "dc_dec",
  name: "DC Decrease (dc2tog)",
  category: "shaping",
  height: 3,                // in cells (vertical units)
  baseAnchors: 2,           // anchors consumed from row below
  topAnchors: 1,            // anchors exposed upward
  // Renderer receives absolute pixel coords for its anchors + cellSize + color.
  // It draws legs between them. The math (which bottom connects to which top)
  // is the renderer's job and is what gives each stitch its visual identity.
  renderSVG: ({ bottomAnchors, topAnchors, cellSize, color }) => `<svg>...</svg>`,
  description: "Two DC legs merging into one top — pulls 2 stitches below together"
}
```

### Placed Stitch Object (flat mode)
```javascript
// Stored per-row, in order. No absolute x — position is computed from the row.
{
  id: "dc_dec",
  color: "#c084fc"
}
```

### Grid State Object
```javascript
{
  mode: "flat",                      // or "round"
  cellSize: 24,                      // px per vertical/horizontal unit
  rows: [                            // row 0 = foundation chain, row 1 = first worked row, ...
    [ { id: "ch", color: "#000" }, /* ... */ ],
    [ { id: "sc" }, { id: "sc_inc" }, { id: "sc" }, { id: "sc_dec" }, /* ... */ ]
  ],
  selectedStitch: null,
  selectedColor: "#c084fc"
}
```

Row validity: a row is valid iff `sum(baseAnchors) of row N == sum(topAnchors) of row N-1`. The UI surfaces invalid rows (red underline on the row + count mismatch readout) but still renders what's there so the user can fix it live.

### Round Mode State
```javascript
{
  mode: "round",
  cellSize: 24,
  rounds: [                          // round 0 = magic ring / starting ring
    [ { id: "magic_ring" } ],
    [ { id: "sc_inc" }, { id: "sc_inc" }, /* ...6 incs = 12 top anchors */ ],
    [ { id: "sc" }, { id: "sc_inc" }, /* ... */ ]
  ],
  selectedStitch: null,
  selectedColor: "#c084fc"
}
```

Round layout is identical to flat, but anchor x becomes an angle. Round N's circumference is divided evenly by `sum(topAnchors)` of round N; each stitch's top anchors sit at their angular slice, radius = `(N+1) * cellSize`. Increases widen the circle; decreases pull it in.

---

## Stitch Library — Full Catalogue

Columns:
- **h** — height in cells
- **base→top** — anchor count on row below → anchor count exposed upward (the math that determines how the stitch reshapes the row)

### Category: Foundation
| Stitch | h | base→top | Shape |
|--------|---|----------|-------|
| Magic Ring | 1 | 0→N | Circle; N chosen at placement (typically 6 or 8) |
| Chain | 1 | 1→1 | Oval/link leg |
| Slip Stitch | 1 | 1→1 | Tiny filled bar |

### Category: Basic (all 1→1, single leg, varying height)
| Stitch | h | base→top | Shape |
|--------|---|----------|-------|
| Single Crochet | 1 | 1→1 | Short stem + small X cap |
| Half Double | 2 | 1→1 | Stem with short bar near top |
| Double | 3 | 1→1 | Stem with one crossbar + hook top |
| Treble | 4 | 1→1 | Stem with two crossbars |
| Double Treble | 5 | 1→1 | Stem with three crossbars |
| Triple Treble | 6 | 1→1 | Stem with four crossbars |

### Category: Textured (1→1, leg with a bulge on the stem)
| Stitch | h | base→top | Shape |
|--------|---|----------|-------|
| Bobble | 2 | 1→1 | Rounded bulge at stem midpoint |
| Puff Stitch | 2 | 1→1 | Oval puff on stem |
| Popcorn | 2 | 1→1 | Round raised dome on stem |
| Bullion | 3 | 1→1 | Elongated coiled-roll stem |
| Berry Stitch | 2 | 1→1 | Small knot on stem |

### Category: Decorative
| Stitch | h | base→top | Shape |
|--------|---|----------|-------|
| Shell | 3 | 1→5 | 5 dc legs fanning from one base anchor |
| Mini Shell | 2 | 1→3 | 3 hdc legs fanning from one base |
| V-Stitch | 3 | 1→2 | 2 dc legs from one base, with visual gap |
| Picot | 1 | 1→1 | Small loop decoration on top of leg |
| Cluster (3-st) | 3 | 3→1 | 3 dc legs merging to one top (inverted fan) |
| Suzette | 1 | 1→2 | sc + ch legs sharing base |
| Moss/Granite | 1 | 1→1 | Alternating sc/ch pattern (renders with ch gap) |

### Category: Shaping (increases / decreases)
| Stitch | h | base→top | Shape |
|--------|---|----------|-------|
| SC Increase | 1 | 1→2 | 2 sc legs splaying outward from one base |
| SC Decrease | 1 | 2→1 | 2 sc legs leaning inward to shared top — pulls base together |
| Invisible Decrease | 1 | 2→1 | Same math, tighter visual merge |
| HDC Increase | 2 | 1→2 | 2 hdc legs from one base |
| HDC Decrease | 2 | 2→1 | 2 hdc legs to one top |
| DC Increase | 3 | 1→2 | 2 dc legs from one base |
| DC Decrease | 3 | 2→1 | 2 dc legs to one top |
| TR Decrease | 4 | 2→1 | 2 tr legs to one top |

### Category: Specialty
| Stitch | h | base→top | Shape / Notes |
|--------|---|----------|---------------|
| Spike Stitch | 2–4 | 1→1 | Leg anchors into a row *below* current (special: stores target row offset) |
| Crocodile Scale | 4 | 2→1 | Pair of stacked dc flipped downward; renders as overlapping scale |
| Star Stitch | 3 | 5→1 | 5-loop gather to one top (multi-decrease variant) |
| Jasmine | 4 | 1→5 | Gathered 5-petal cluster (shell variant with puff petals) |
| Tunisian Simple | 2 | 1→1 | Forward/return bar; separate mode, same anchor math |

### Motifs (not single stitches — preset row-groups)
Granny Square, Pineapple, Bavarian, Broomstick Lace, Hairpin Lace, Waffle, Tunisian Smock — these are multi-row compositions, not single stitches. They're stored as named presets: a bundle of rows you stamp onto the grid, and each cell inside the preset is a normal anchor-modeled stitch. Defer to v2.

---

## Grid Engine — Flat Mode

### Responsibilities
- Render the grid as an SVG canvas
- For each row, compute the x-position of every anchor
- For each stitch, compute its leg endpoints (bottom anchors from row below, top anchors for next row) and hand them to the stitch's `renderSVG`
- Flag rows where `sum(baseAnchors)` doesn't match the previous row's `sum(topAnchors)` (visual warning + readout)
- Zoom (cellSize 12–48px) and pan (drag)

### Layout Math
Each row is rendered left-to-right. Anchor positions are computed, not stored.

```javascript
// Walk a row to produce anchor x-positions for top edge of that row,
// AND the leg endpoints for each stitch in the row.
function layoutRow(row, prevRowTopAnchors, cellSize, rowIndex) {
  const bottomY = (totalRows - rowIndex) * cellSize;     // row baseline
  let baseCursor = 0;                                     // index into prevRowTopAnchors
  let topCursor = 0;                                      // running top-anchor count in this row
  const topAnchorsOut = [];
  const laidOut = [];

  for (const placed of row) {
    const def = stitchDefs[placed.id];
    const topY = bottomY - def.height * cellSize;

    // Bottom anchors: take the next `def.baseAnchors` from prev row's top anchors
    const bottom = prevRowTopAnchors.slice(baseCursor, baseCursor + def.baseAnchors);
    baseCursor += def.baseAnchors;

    // Top anchors: evenly spaced above this stitch's footprint.
    // Footprint width = max(baseAnchors, topAnchors) cell-units, or span of bottom anchors.
    const footprintLeft  = bottom.length ? bottom[0]               : topCursor * cellSize;
    const footprintRight = bottom.length ? bottom[bottom.length-1] : (topCursor + def.topAnchors) * cellSize;
    const top = [];
    for (let i = 0; i < def.topAnchors; i++) {
      const t = def.topAnchors === 1 ? 0.5 : i / (def.topAnchors - 1);
      top.push({ x: footprintLeft + t * (footprintRight - footprintLeft), y: topY });
    }
    topCursor += def.topAnchors;
    topAnchorsOut.push(...top);

    laidOut.push({
      placed, def,
      bottomAnchors: bottom.map(x => ({ x, y: bottomY })),
      topAnchors: top,
    });
  }

  return { laidOut, topAnchorsOut, valid: baseCursor === prevRowTopAnchors.length };
}
```

Key properties of this math:
- A **decrease** (base=2, top=1) has `footprintLeft` and `footprintRight` at the two base anchor x's, and its single top anchor sits at their midpoint — so its legs physically lean inward and the top aligns between them. That *is* "pulling stitches together," straight from the numbers.
- An **increase** (base=1, top=2) has a zero-width footprint at the base, but its top anchors are spread across one cell-width to the right — legs splay outward, row widens by 1 anchor.
- A **shell** (base=1, top=5) fans 5 top anchors across a 5-unit span from a single base point — a natural fan.
- A **cluster** (base=N, top=1) collapses N base anchors into a single top midpoint — an inverted fan.

### Placement & Editing
Stitches are appended to rows, not dropped at arbitrary xy. The user selects a row (or a cell in it) and inserts/replaces/deletes at that position. The grid engine then re-runs `layoutRow` for the affected row and all rows above it (since top-anchor counts can change).

### Visual Feedback
- Hover: ghost preview shows the stitch drawn at the would-be anchor positions for that insertion point
- Red underline on a row whose base-anchor sum doesn't match the row below's top-anchor sum, with a `−2` or `+1` readout showing the mismatch
- Placed stitches render in full color

---

## SVG Stitch Rendering

Every stitch is rendered as one or more **thick legs** drawn between anchor points the grid engine has already computed. The renderer receives absolute coordinates — it doesn't do layout, only shape.

```javascript
renderSVG({ bottomAnchors, topAnchors, cellSize, color }) => svgString
// bottomAnchors: [{x, y}, ...] — one per baseAnchors
// topAnchors:    [{x, y}, ...] — one per topAnchors
```

All coordinates are in the same SVG coordinate space as the grid, so the renderer returns `<g>...</g>` fragments (not standalone `<svg>`s) that the grid layer composites.

### Example — Single Crochet (1→1, h=1)
One short thick leg, with a small X cap near the top to mark it as sc.
```javascript
renderSVG: ({ bottomAnchors: [b], topAnchors: [t], cellSize, color }) => {
  const sw = cellSize * 0.18;              // stroke width scales with zoom
  const capY = t.y + cellSize * 0.15;
  const capHalf = cellSize * 0.22;
  return `<g stroke="${color}" stroke-width="${sw}" stroke-linecap="round" fill="none">
    <line x1="${b.x}" y1="${b.y}" x2="${t.x}" y2="${t.y}"/>
    <line x1="${t.x - capHalf}" y1="${capY - capHalf}" x2="${t.x + capHalf}" y2="${capY + capHalf}"/>
    <line x1="${t.x - capHalf}" y1="${capY + capHalf}" x2="${t.x + capHalf}" y2="${capY - capHalf}"/>
  </g>`;
}
```

### Example — Double Crochet (1→1, h=3)
One tall thick leg, crossbar at midpoint, hook at top.
```javascript
renderSVG: ({ bottomAnchors: [b], topAnchors: [t], cellSize, color }) => {
  const sw = cellSize * 0.18;
  const midY = (b.y + t.y) / 2;
  const half = cellSize * 0.3;
  return `<g stroke="${color}" stroke-width="${sw}" stroke-linecap="round" fill="none">
    <line x1="${b.x}" y1="${b.y}" x2="${t.x}" y2="${t.y}"/>
    <line x1="${t.x - half}" y1="${midY}" x2="${t.x + half}" y2="${midY}"/>
    <path d="M${t.x} ${t.y} q ${cellSize*0.3} ${-cellSize*0.15} ${cellSize*0.45} ${cellSize*0.05}"/>
  </g>`;
}
```
Because `b` and `t` come from the grid engine, a dc sitting above an increase/decrease can lean naturally — the same renderer handles any pair of endpoints.

### Example — DC Decrease (2→1, h=3) — THE key case
Two dc legs sharing one top anchor. The grid engine gives us two bottom anchors and one top anchor (positioned at their midpoint). Drawing a leg from each bottom to the shared top produces legs that physically lean inward and pull the base stitches together.
```javascript
renderSVG: ({ bottomAnchors: [bL, bR], topAnchors: [t], cellSize, color }) => {
  const sw = cellSize * 0.18;
  const half = cellSize * 0.25;
  const leg = (b) => {
    const midY = (b.y + t.y) / 2;
    const midX = (b.x + t.x) / 2;
    return `
      <line x1="${b.x}" y1="${b.y}" x2="${t.x}" y2="${t.y}"/>
      <line x1="${midX - half}" y1="${midY}" x2="${midX + half}" y2="${midY}"/>`;
  };
  return `<g stroke="${color}" stroke-width="${sw}" stroke-linecap="round" fill="none">
    ${leg(bL)}${leg(bR)}
    <path d="M${t.x} ${t.y} q ${cellSize*0.3} ${-cellSize*0.15} ${cellSize*0.45} ${cellSize*0.05}"/>
  </g>`;
}
```
Note: no hard-coded angle. The lean is entirely a function of where the base anchors sit, which is entirely a function of the row below — mathematically accurate.

### Example — Shell (1→5, h=3)
One base anchor, five top anchors spread in a fan. Five legs, one per top.
```javascript
renderSVG: ({ bottomAnchors: [b], topAnchors, cellSize, color }) => {
  const sw = cellSize * 0.18;
  const midY = (b.y + topAnchors[0].y) / 2;
  const half = cellSize * 0.15;
  const legs = topAnchors.map(t => {
    const midX = (b.x + t.x) / 2;
    return `
      <line x1="${b.x}" y1="${b.y}" x2="${t.x}" y2="${t.y}"/>
      <line x1="${midX - half}" y1="${midY}" x2="${midX + half}" y2="${midY}"/>`;
  }).join('');
  return `<g stroke="${color}" stroke-width="${sw}" stroke-linecap="round" fill="none">${legs}</g>`;
}
```

### Example — Puff / Bobble (1→1, h=2)
One leg with a bulge on the stem.
```javascript
renderSVG: ({ bottomAnchors: [b], topAnchors: [t], cellSize, color }) => {
  const sw = cellSize * 0.18;
  const midX = (b.x + t.x) / 2;
  const midY = (b.y + t.y) / 2;
  const r = cellSize * 0.28;
  return `<g stroke="${color}" stroke-width="${sw}" stroke-linecap="round" fill="none">
    <line x1="${b.x}" y1="${b.y}" x2="${t.x}" y2="${t.y}"/>
    <ellipse cx="${midX}" cy="${midY}" rx="${r}" ry="${r * 1.2}" fill="${color}" fill-opacity="0.25"/>
  </g>`;
}
```

### Style rules
- Stroke width scales with `cellSize` so thickness is proportional at every zoom (`cellSize * 0.18` is a good default)
- `stroke-linecap="round"` on all legs — real crochet stitches look rounded, not blocky
- Never hard-code pixel values; everything derives from anchors or `cellSize`
- Leg shapes lean by geometry, never by stored rotation angles

---

## UI Layout

```
┌─────────────────────────────────────────────────┐
│  HEADER: title | Mode toggle (Flat/Round) | Zoom │
├──────────┬──────────────────────────────────────┤
│ PALETTE  │                                       │
│          │          GRID CANVAS                  │
│ [Filter] │                                       │
│          │   (stitches render here as SVGs)       │
│ stitch   │                                       │
│ stitch   │                                       │
│ stitch   │                                       │
│          │                                       │
├──────────┴──────────────────────────────────────┤
│ TOOLBAR: Place | Erase | Color | Pan | Export    │
└─────────────────────────────────────────────────┘
```

### Palette Panel
- Filterable by category
- Each stitch shows: mini SVG preview + name + footprint (e.g. "5×3")
- Click to select, selected state highlighted
- Color swatch visible on selected stitch

### Toolbar
- **Place** — default mode, click grid to place selected stitch
- **Erase** — click placed stitch to remove
- **Color** — color picker, applies to next placement
- **Pan** — drag to scroll large grids
- **Clear All** — with confirmation
- **Export PNG** — uses html2canvas or canvas drawImage
- **Save** — downloads pattern.json
- **Load** — uploads pattern.json

---

## Round Mode

Same anchor-and-leg model as flat, with one substitution: anchor x-positions become **angles** around a center point, and row baseline y becomes **radius**. Every piece of math and every stitch renderer carries over unchanged.

### Radial Layout
- Center = round 0 (magic ring, which emits N top anchors as the starting count)
- Round N's baseline radius = `(N + 1) * cellSize`
- Round N's stitches have bottom anchors on radius N, top anchors on radius N+1
- Angular position for each anchor: evenly divided around 2π by `sum(topAnchors)` of that round

```javascript
function layoutRound(round, prevRoundTopAnchorAngles, roundIndex, cellSize) {
  const rBottom = (roundIndex)     * cellSize;
  const rTop    = (roundIndex + 1) * cellSize;
  const totalTop = round.reduce((n, p) => n + stitchDefs[p.id].topAnchors, 0);
  const dθ = (2 * Math.PI) / totalTop;

  let baseCursor = 0;
  let topCursor = 0;
  const topAnglesOut = [];
  const laidOut = [];

  for (const placed of round) {
    const def = stitchDefs[placed.id];
    const baseAngles = prevRoundTopAnchorAngles.slice(baseCursor, baseCursor + def.baseAnchors);
    baseCursor += def.baseAnchors;

    const topAngles = [];
    for (let i = 0; i < def.topAnchors; i++) {
      topAngles.push((topCursor + i + 0.5) * dθ);
    }
    topCursor += def.topAnchors;
    topAnglesOut.push(...topAngles);

    laidOut.push({
      placed, def,
      bottomAnchors: baseAngles.map(a => ({ x: Math.cos(a) * rBottom, y: Math.sin(a) * rBottom })),
      topAnchors:    topAngles.map(a => ({ x: Math.cos(a) * rTop,    y: Math.sin(a) * rTop    })),
    });
  }
  return { laidOut, topAnglesOut, valid: baseCursor === prevRoundTopAnchorAngles.length };
}
```

### Consequences (which are also the crochet physics)
- **Increases widen the circle.** Each round's circumference grows because `sum(topAnchors)` grows — exactly what happens when you crochet extra stitches into a round.
- **Decreases pull it in.** `sum(topAnchors)` shrinks, so the next round's radius-to-circumference ratio tightens — the fabric cinches, just like real decreasing rounds.
- **A shell in round mode** fans 5 top anchors across an angular arc from one base angle. Same renderer, same math.
- **Stitches lean along their legs** — no rotation field needed. The line from bottom-anchor-at-angle-θ₁ to top-anchor-at-angle-θ₂ naturally points outward-and-sideways.

### Rendering
- Renderers are identical to flat mode. They receive `{ bottomAnchors, topAnchors, cellSize, color }` with absolute x,y already converted from polar.
- Grid guides: faint concentric circles at each round radius, and optional radial spokes at anchor angles.
- Center renders `magic_ring` as a small circle with the starting anchor count indicated.

---

## Export

### PNG Export
```javascript
// Use html2canvas on grid div, or draw all SVGs onto a canvas element
import html2canvas from 'https://cdn...';
html2canvas(gridEl).then(canvas => {
  const link = document.createElement('a');
  link.download = 'my-pattern.png';
  link.href = canvas.toDataURL();
  link.click();
});
```

### JSON Save/Load
```javascript
// Save
const json = JSON.stringify(state);
// Load
const state = JSON.parse(fileContent);
renderFromState(state);
```

---

## Tech Stack

- **HTML/CSS/JS** — no framework, single responsibility modules
- **SVG** — all stitch rendering
- **html2canvas** — PNG export (CDN)
- **No build step** — open index.html directly or serve locally

---

## Build Sequence for Coding AI

1. `index.html` — shell, import all JS/CSS
2. `css/app.css` — layout grid, panel, toolbar
3. `js/stitches.js` — full stitch catalogue with SVG renderers
4. `js/grid.js` — flat grid render + occupation logic
5. `js/palette.js` — palette panel, filter, selection
6. `js/tools.js` — place, erase, hover preview, color
7. `js/main.js` — init, wire everything together
8. `js/export.js` — PNG + JSON
9. `js/radial.js` — round mode grid
10. `js/main.js` update — mode toggle wiring

---

## Notes for Coding AI

- All SVGs must scale with `cellSize` — never hardcode pixel values inside stitch renderers
- Cell occupation map must be a 2D array reset on clear/load
- Stitch SVG spans exactly `stitch.cols * cellSize` × `stitch.rows * cellSize` px
- Ghost preview must update on every mousemove, not just cell change
- Round mode is a separate render pipeline, flat state is preserved when switching modes
- JSON save must capture mode, grid dimensions, cellSize, and full stitch placement array
