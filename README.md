# Constellation

**A visual crochet pattern designer that looks like real crochet.**

🧶 **Try it live:** https://tamryn72.github.io/Constellation/

Constellation lets you build crochet patterns by clicking stitches onto a grid (flat) or a ring (round). Every stitch is drawn as the actual shape a crocheter would recognize — thick legs that lean, shells that fan, decreases that pull stitches together — because the layout is mathematically accurate, not just decorative.

It runs entirely in your browser. No account, no install, no backend.

---

## What you can do with it

- **Two modes:** flat grid (scarves, blankets, panels) and round (coasters, hats, amigurumi, mandalas)
- **39 stitch types** across basic, shaping, post, textured, decorative, and lace categories — with true-to-life SVG rendering
- **Decreases pull stitches together** — the two legs of an sc2tog / dc2tog share a top anchor and physically lean inward, matching real fabric
- **Flat-lay math for rounds** — each round tells you if your stitch count matches its circumference, so you can see whether it'll lie flat, cup up, or ruffle, with a suggested fix ("add 6 increases")
- **FLO / BLO modifier** — work any stitch through the front or back loop only
- **Color each stitch** (Yarn) and the background (Fabric)
- **Paint mode** — click stitches to recolor, or paint a whole row at once
- **Multiple panels in one project** — design a "Front", a "Back", a "Strap"; each panel keeps its own mode, stitches, folds, and edge labels
- **Fold lines** — mark where the fabric folds
- **Assembly** — name the edges of each panel and list seams between them
- **Overview / preview** — see all panels in one schematic view with seam arrows between them, export as SVG
- **Written pattern** — generate a real written crochet pattern from your plan with standard abbreviations, `(chunk) × N` repeat detection, stitch counts, and an Assembly section describing folds and seams
- **Save / load JSON** — fully portable project files; old single-panel files auto-upgrade
- **Export PNG** of the canvas

---

## Quick start

**Just use it:** open https://tamryn72.github.io/Constellation/ in any modern browser. Nothing to install, nothing to configure.

**Run it locally** (for development / offline use):

```bash
git clone https://github.com/tamryn72/Constellation.git
cd Constellation
python3 -m http.server 8000   # or: npx serve
```

Then open http://localhost:8000 in your browser.

No build step. No dependencies. It's plain HTML, CSS, and JavaScript modules — reading the source is the tutorial.

---

## Tour of the UI

```
┌─────────────────────────────────────────────────────┐
│ HEADER: title · Flat/Round · Zoom                    │
├──────────┬──────────────────────────────────────────┤
│ PALETTE  │ Panel tabs: [Panel 1] [+ Panel]          │
│          ├──────────────────────────────────────────┤
│ [filter] │                                          │
│          │          CANVAS (SVG)                    │
│ stitch   │       rows or rings render here          │
│ stitch   │                                          │
│ stitch   │                                          │
│          │                                          │
│          │  status bar: mode · row · flat-lay hint  │
├──────────┴──────────────────────────────────────────┤
│ TOOLBAR: Yarn · Fabric · Loop · + Row · + Fold ·    │
│          Paint · Paint row · Delete · Clear ·       │
│          Save JSON · Load JSON · Export PNG ·       │
│          Assembly · Preview · Pattern               │
└─────────────────────────────────────────────────────┘
```

**Place a stitch:** click one in the palette, then click a row/ring on the canvas. It appends to the end of that row.

**Switch active row:** click anywhere on a row.

**Delete a stitch:** toggle **Delete** on, click the stitch. Toggle off when done.

**Recolor a stitch:** toggle **Paint** on, click the stitch. Or click **Paint row** to repaint the entire active row in one go.

**Add a new row / round:** click **+ New Row**.

**Mark a fold:** flat mode only. Click **+ Fold**, enter a label. A dashed purple line shows where the fabric folds.

**Name edges / add seams:** click **Assembly**. For each panel, type labels for its edges (top, bottom, left, right in flat; outer in round). Click "+ Add seam" to join an edge of one panel to an edge of another.

**See it all together:** click **Preview**. Shows every panel laid out, with dashed orange arrows drawn between seamed edges.

**Get the written pattern:** click **Pattern**. Generates your plan as standard crochet notation — e.g. `Rnd 2: (sc, inc) × 6. (18 sts)` — with a final Assembly section explaining folds and seams. Copy or download as `.txt`.

**Round mode flat-lay hints:** each ring is color-coded. Green = lies flat, amber = needs more increases, red = too many stitches. The status bar tells you the exact fix.

---

## Architecture (short version)

- **Anchors-and-legs model.** Every stitch is one or more thick legs drawn between anchor points. A decrease = 2 legs sharing one top anchor (they lean together). An increase = 2 legs sharing one bottom anchor (they splay out). A shell = 5 legs on one base. Same model works in flat and round — round just swaps x-positions for angles.
- **Row-walk layout.** The grid engine walks each row, consuming `baseAnchors` from the previous row and producing `topAnchors` upward. Anchor positions are computed, not stored — so the same state serializes to a tiny JSON file.
- **Validation fell out of the math.** A row is valid if `sum(baseAnchors) == sum(topAnchors of row below)`. Invalid rows get a red underline with a mismatch readout.
- **Round flat-lay.** `idealCount = round(2π · radius / cellSize)`. That gives 6, 12, 18, 24… the classic amigurumi increase rule, straight from circumference.

For the full spec — data structures, stitch catalogue, rendering conventions, round-mode layout, export format — see **[SPEC.md](SPEC.md)**.

---

## Tech stack

- Plain HTML + CSS + ES modules
- SVG for all stitch rendering (no canvas)
- No frameworks, no bundler, no build step
- Runs in any modern browser

---

## Project status

**Works today:**
Flat + round modes, 39 stitches, shaping with mathematically-correct pull-together, FLO/BLO, per-stitch color + fabric color, paint tools, multi-panel projects, fold lines, assembly/seam editor, overview schematic, written pattern export, JSON save/load, PNG export.

**Known gaps / v2 roadmap:**
- Ghost preview on hover (insert position indication)
- Undo / redo
- Insert between stitches (currently appends only)
- Motif presets (granny square, pineapple, etc.) — needs composite-preset data model
- Corner-to-corner (C2C) — doesn't fit the anchor model; needs its own
- Tunisian, broomstick, hairpin — deferred as specialty techniques
- A custom `ch-N` prompt (currently ch-2/3/5 presets only)
- Turning-chain marker / row direction arrows

---

## Contributing

Bug reports, stitch suggestions, and PRs welcome. A few guidelines:

- **New stitches** go in `js/stitches.js`. Every stitch defines `height`, `baseAnchors`, `topAnchors`, a `category`, and a `renderSVG({ bottomAnchors, topAnchors, cellSize, color })` function that returns a `<g>` fragment. Scale everything from `cellSize`; never hard-code pixels.
- **No new build tooling.** The point of this project is that it opens and runs with `python3 -m http.server`. Please don't add webpack, vite, etc.
- **No frameworks.** Plain DOM and SVG only.
- **Test via the browser.** There's no unit-test suite yet; a quick manual check that your stitch renders in the palette preview, places correctly on both flat and round canvases, and produces the expected written-pattern abbreviation is sufficient for an MVP PR.
- **File an issue first** for anything that touches the anchor/layout model — those changes ripple through grid, radial, preview, and pattern generation.

---

## License

Constellation is released under the **PolyForm Noncommercial License 1.0.0**.

**Plain English:**
- ✅ Free to use for personal projects, learning, hobbies, teaching, research
- ✅ Free to modify, share, and redistribute your modifications
- ✅ Use it to design patterns for your own crochet projects — absolutely fine
- ❌ You may not sell the software itself or a derivative of it
- ❌ You may not use it as part of a commercial product or service

The generated patterns and images you create with Constellation are yours — the license is on the software, not on your output. Sell your finished crochet pieces, post your patterns, do your thing.

Full legal text: [LICENSE](LICENSE).

---

## Credits

Built by [tamryn72](https://github.com/tamryn72). Stitch symbol conventions follow international crochet charting standards. Made for makers who want to plan before they hook.
