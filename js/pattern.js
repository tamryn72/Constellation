// Generate a human-readable written crochet pattern from the current state.
// Standard abbreviations, consecutive repeats grouped, stitch counts per row.

import { STITCHES } from './stitches.js';

// Short abbreviation per stitch.
const ABBREV = {
  ch: 'ch',
  sl: 'sl st',
  sc: 'sc',
  hdc: 'hdc',
  dc: 'dc',
  tr: 'tr',
  dtr: 'dtr',
  sc_inc: 'inc',
  sc_dec: 'sc2tog',
  invdec: 'inv dec',
  hdc_inc: 'hdc inc',
  hdc_dec: 'hdc2tog',
  dc_inc: 'dc inc',
  dc_dec: 'dc2tog',
  tr_dec: 'tr2tog',
  shell: 'shell (5 dc in same st)',
  mini_shell: 'mini shell (3 hdc in same st)',
  v_stitch: 'V-st (dc, ch 1, dc)',
  cluster3: 'CL (3-dc cluster)',
  picot: 'picot',
  puff: 'puff',
  bobble: 'BOB',
  popcorn: 'PC',
  bullion: 'bullion',
  magic_ring: 'MR',

  fpsc: 'FPsc', bpsc: 'BPsc',
  fphdc: 'FPhdc', bphdc: 'BPhdc',
  fpdc: 'FPdc', bpdc: 'BPdc',

  trtr: 'trtr',
  rsc: 'rev sc',
  spike: 'spike sc',
  sc3tog: 'sc3tog',
  hdc3tog: 'hdc3tog',

  ch_sp_2: 'ch-2, sk 2',
  ch_sp_3: 'ch-3, sk 3',
  ch_sp_5: 'ch-5, sk 5',

  sk: 'sk 1',
};

function abbrev(id) {
  return ABBREV[id] || STITCHES[id]?.name || id;
}

// Collapse consecutive identical stitches (including loop flag) into "N abbrev".
function groupRow(row) {
  const groups = [];
  for (const p of row) {
    const loop = p.loop || 'both';
    const last = groups[groups.length - 1];
    if (last && last.id === p.id && last.loop === loop) {
      last.count += 1;
    } else {
      groups.push({ id: p.id, loop, count: 1 });
    }
  }
  return groups;
}

// Total stitches produced by this row (sum of topAnchors).
function topCount(row) {
  return row.reduce((n, p) => n + (STITCHES[p.id]?.topAnchors ?? 1), 0);
}
// Total stitches consumed from row below (sum of baseAnchors).
function baseCount(row) {
  return row.reduce((n, p) => n + (STITCHES[p.id]?.baseAnchors ?? 1), 0);
}

function formatGroups(groups) {
  return groups.map(g => {
    const a = abbrev(g.id);
    const suffix = g.loop === 'flo' ? ' FLO' : g.loop === 'blo' ? ' BLO' : '';
    if (g.count === 1) return a + suffix;
    return `${g.count} ${a}${suffix}`;
  }).join(', ');
}

// Find the smallest repeating chunk of groups that tiles the whole list.
// Returns { chunk, times } if list === chunk repeated, else null.
function findRepeat(groups) {
  const n = groups.length;
  if (n < 4) return null;
  for (let k = 1; k <= Math.floor(n / 2); k++) {
    if (n % k !== 0) continue;
    const times = n / k;
    let ok = true;
    for (let i = k; i < n && ok; i++) {
      const a = groups[i], b = groups[i - k];
      if (a.id !== b.id || a.count !== b.count) ok = false;
    }
    if (ok && times >= 2) return { chunk: groups.slice(0, k), times };
  }
  return null;
}

function formatRowGroups(groups) {
  const rep = findRepeat(groups);
  if (rep && rep.chunk.length > 1) {
    return `(${formatGroups(rep.chunk)}) × ${rep.times}`;
  }
  return formatGroups(groups);
}

function writePanelBody(panel, lines) {
  if (panel.mode === 'flat') {
    if (!panel.rows.length || !panel.rows[0].length) {
      lines.push('(empty — add stitches to begin)');
      return;
    }
    const foundation = panel.rows[0];
    const foundationCount = foundation.length;
    const allChain = foundation.every(p => p.id === 'ch');
    if (allChain) {
      lines.push(`Foundation: ch ${foundationCount}.`);
    } else {
      lines.push(`Foundation: ${formatRowGroups(groupRow(foundation))}.  (${foundationCount} sts)`);
    }
    for (let i = 1; i < panel.rows.length; i++) {
      const row = panel.rows[i];
      if (!row.length) { lines.push(`Row ${i}: (empty)`); continue; }
      const groups = groupRow(row);
      const produced = topCount(row);
      const consumed = baseCount(row);
      const prevProduced = topCount(panel.rows[i - 1]);
      const valid = consumed === prevProduced;
      const count = `(${produced} st${produced === 1 ? '' : 's'})`;
      const warn = valid ? '' : `  ⚠ uses ${consumed} of ${prevProduced} available`;
      lines.push(`Row ${i}: ${formatRowGroups(groups)}. ${count}${warn}`);
    }
  } else {
    if (!panel.rounds.length) { lines.push('(empty)'); return; }
    for (let i = 0; i < panel.rounds.length; i++) {
      const round = panel.rounds[i];
      if (!round.length) { lines.push(`Rnd ${i}: (empty)`); continue; }
      const groups = groupRow(round);
      const produced = topCount(round);
      const consumed = baseCount(round);
      const prevProduced = i === 0 ? 0 : topCount(panel.rounds[i - 1]);
      const valid = i === 0 ? true : consumed === prevProduced;
      const count = `(${produced} st${produced === 1 ? '' : 's'})`;
      const warn = valid ? '' : `  ⚠ uses ${consumed} of ${prevProduced} available`;
      if (i === 0) {
        lines.push(`Rnd 0: ${formatRowGroups(groups)}. ${count}`);
      } else {
        lines.push(`Rnd ${i}: ${formatRowGroups(groups)}. ${count}${warn}`);
      }
    }
  }
}

function writeAssembly(state, lines) {
  const panelsWithFolds = (state.panels ?? []).filter(p => (p.folds || []).length > 0);
  const seams = state.seams || [];
  if (!panelsWithFolds.length && !seams.length) return;

  lines.push('');
  lines.push('## Assembly');
  lines.push('');

  for (const p of panelsWithFolds) {
    for (const f of p.folds) {
      const where = f.axis === 'row'
        ? `between Row ${f.at - 1} and Row ${f.at}`
        : `at ${f.axis} ${f.at}`;
      lines.push(`Fold ${p.name} ${where} (${f.label || 'fold'}).`);
    }
  }

  for (const s of seams) {
    const pa = state.panels.find(p => p.id === s.a?.panelId);
    const pb = state.panels.find(p => p.id === s.b?.panelId);
    if (!pa || !pb) continue;
    const la = pa.edges?.[s.a.edge] ? ` "${pa.edges[s.a.edge]}"` : '';
    const lb = pb.edges?.[s.b.edge] ? ` "${pb.edges[s.b.edge]}"` : '';
    const note = s.note ? ` — ${s.note}` : '';
    lines.push(`Sew ${pa.name} ${s.a.edge}${la} to ${pb.name} ${s.b.edge}${lb}${note}.`);
  }
}

export function generatePattern(state) {
  const lines = [];
  const title = '# Constellation Pattern';
  lines.push(title);
  lines.push(''.padEnd(title.length, '='));
  lines.push('');

  const panels = state.panels ?? [];
  const multi = panels.length > 1;

  for (const p of panels) {
    const modeLabel = p.mode === 'round' ? 'Round' : 'Flat';
    lines.push(multi ? `## ${p.name} (${modeLabel.toLowerCase()})` : `## ${modeLabel} pattern`);
    lines.push('');
    writePanelBody(p, lines);
    lines.push('');
  }

  writeAssembly(state, lines);

  lines.push('');
  lines.push('---');
  lines.push('Abbreviations: ch = chain, sl st = slip stitch, sc = single crochet,');
  lines.push('hdc = half double, dc = double, tr = treble, dtr = double treble,');
  lines.push('inc = increase, 2tog = decrease, inv dec = invisible decrease,');
  lines.push('CL = cluster, MR = magic ring, BOB = bobble, PC = popcorn.');

  return lines.join('\n');
}

// Show the pattern in a modal overlay with copy/download buttons.
export function showPatternModal(state) {
  const text = generatePattern(state);

  // Remove any existing modal
  document.getElementById('pattern-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'pattern-modal';
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <div class="modal" role="dialog" aria-labelledby="pattern-title">
      <div class="modal-header">
        <h2 id="pattern-title">Written Pattern</h2>
        <button class="modal-close" aria-label="Close">✕</button>
      </div>
      <pre class="pattern-text"></pre>
      <div class="modal-footer">
        <button id="pattern-copy" class="tool-btn">Copy</button>
        <button id="pattern-download" class="tool-btn">Download .txt</button>
      </div>
    </div>`;
  modal.querySelector('.pattern-text').textContent = text;
  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  modal.querySelector('.modal-close').addEventListener('click', close);

  modal.querySelector('#pattern-copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(text);
      const btn = modal.querySelector('#pattern-copy');
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
    } catch {
      // clipboard may be blocked — select the pre as fallback
      const pre = modal.querySelector('.pattern-text');
      const range = document.createRange();
      range.selectNodeContents(pre);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  });

  modal.querySelector('#pattern-download').addEventListener('click', () => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pattern.txt';
    a.click();
    URL.revokeObjectURL(url);
  });

  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', escHandler);
    }
  });
}
