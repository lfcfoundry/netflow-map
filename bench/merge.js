/* Copyright (c) 2026 JNFoo. MIT License. Puts newly measured fields into an older results file, job by job (same key):
 *   node bench/merge.js <new.jsonl> <old.jsonl>      fields of "ok" in the new line replace the same fields in the old line; other fields stay.
 * Lines of the new file with no match are added. Used to refresh our own numbers without re-running the competitors. */
'use strict';
const fs = require('fs');
const [nf, of] = process.argv.slice(2);
const rd = (f) => fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
const norm = (r) => r.suite + JSON.stringify(Object.keys(r.args).filter((k) => k !== 'libs' && k !== 'before').sort().map((k) => [k, r.args[k]]));   // which job it was, ignoring the switches that only choose what to run
const oldL = rd(of), idx = new Map(oldL.map((r, i) => [norm(r), i]));
let merged = 0, added = 0;
for (const r of rd(nf)) {
  if (!r.ok) continue;
  if (idx.has(norm(r))) { const o = oldL[idx.get(norm(r))]; o.ok = Object.assign({}, o.ok, r.ok); o.browser = r.browser; merged++; } else { oldL.push(r); added++; }
}
fs.writeFileSync(of, oldL.map((r) => JSON.stringify(r)).join('\n') + '\n');
console.log('merged', merged, 'added', added, '->', of);
