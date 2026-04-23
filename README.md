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

Each stitch has a `renderSVG(color, cellSize)` function that returns an SVG string. The SVG viewport = `stitch.cols * cellSize` wide, `stitch.rows * cellSize` tall.

### Example — Double Crochet
```javascript
renderSVG: (color, cellSize) => {
  const w = cellSize;
  const h = cellSize * 3;
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <!-- stem -->
    <line x1="${w/2}" y1="${h}" x2="${w/2}" y2="${h*0.2}" stroke="${color}" stroke-width="2"/>
    <!-- crossbar -->
    <line x1="${w*0.2}" y1="${h*0.5}" x2="${w*0.8}" y2="${h*0.5}" stroke="${color}" stroke-width="2"/>
    <!-- top hook -->
    <path d="M${w/2} ${h*0.2} Q${w*0.7} 0 ${w*0.9} ${h*0.1}" stroke="${color}" fill="none" stroke-width="2"/>
  </svg>`;
}
```

### Example — Shell Stitch
```javascript
renderSVG: (color, cellSize) => {
  const w = cellSize * 5;
  const h = cellSize * 3;
  const cx = w / 2;
  const base = h * 0.9;
  // 5 arcs fanning from center base point
  const angles = [-60, -30, 0, 30, 60];
  const spokes = angles.map(a => {
    const rad = (a * Math.PI) / 180;
    const tx = cx + Math.sin(rad) * h * 0.8;
    const ty = base - Math.cos(rad) * h * 0.8;
    return `<line x1="${cx}" y1="${base}" x2="${tx}" y2="${ty}" stroke="${color}" stroke-width="2.5"/>`;
  }).join('');
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${spokes}</svg>`;
}
```

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

### Radial Grid Structure
- Center point → magic ring
- Rings expand outward, each ring = 1 round
- Each ring divided into segments (increases as rounds grow)
- Ring 1: 6 segments, Ring 2: 12, Ring 3: 18 etc (standard increase pattern) — but user can override

### Coordinate System
```javascript
// Round mode stitch placement
{
  ring: 2,          // which round (0 = center)
  segment: 4,       // which segment in that ring
  stitchId: "dc",
  color: "#c084fc"
}
```

### Rendering
- Draw as SVG polar grid
- Each segment is a pie-slice cell
- Stitches rendered as SVG, rotated to follow radial direction
- Segments widen visually as rings grow (correct crochet geometry)

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
