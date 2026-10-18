// Copyright (c) 2026 LFC Foundry. MIT License. Builds bench/compression-methods/page.html: packs 100,000-item data of many kinds with memory-compression and tallies which way each piece was stored.
// Run: node bench/compression-methods/make.mjs, then node bench/compression-methods/run.js firefox
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..'), rd = (p) => readFileSync(join(root, p), 'utf8');
const clean = (s) => s.replace(/if \(typeof module !== 'undefined' && module\.exports\) module\.exports = \w+;\n?/g, '');
const engine = ['src/columns.js', 'src/pack.js', 'src/sankey.js', 'vendor/netflow-layers.js', 'src/engine.js'].map((p) => clean(rd(p))).join('\n');
const patch = (s) => {
  let n = 0;
  s = s.replace('if (opts && opts.labels) opts.labels.push(describe(part));', () => { n++; return 'if (opts && opts.labels) opts.labels.push(describe(part)); (self.__WAYS = self.__WAYS || []).push([describe(part), part.length]);'; });
  s = s.replace(/\b(c|this\.ctl)\.u8\((CT_[A-Z0-9]+)\)/g, (a, o, k) => { n++; return o + '.u8(__ct(' + k + '))'; });
  s = s.replace('CT_STRDP = 21;', () => { n++; return "CT_STRDP = 21;\n  var __CTN = ['CONST','INT','DEC','F32','F64','BOOL','STRD','STRR','NULLABLE','ARRAYS','TUPLE','RECORDS','ANY','TEMPLATE','REFS','REFRECS','TIMES','FSST','PCO','FRONT','ADAPT','STRDP'];\n  function __ct(v) { var c = (self.__COLS = self.__COLS || {}); c[__CTN[v]] = (c[__CTN[v]] || 0) + 1; return v; }"; });
  s = s.replace('      hdr.length = 0;', () => { n++; return "      (self.__BY = self.__BY || []).push([engine === 1 ? (useW ? 'LZ4 (wasm)' : 'LZ4 (JS)') : 'deflate', w ? 'shuffle ' + w + (mask ? '+delta' : '') : 'no shuffle', pl < clen, clen, pl < clen ? pl : clen]);\n      hdr.length = 0;"; });
  if (n < 20) throw new Error('module patch matched too little: ' + n);
  return s;
};
const mc = patch(clean(rd('vendor/memory-compression.js'))), examples = clean(rd('src/examples.js')), run = rd('bench/compression-methods/page.js');
for (const [n, s] of [['engine', engine], ['mc', mc], ['examples', examples], ['page', run]]) if (/<\/script|<!--/i.test(s)) throw new Error(n + ' would break the page');
const html = `<!doctype html><html lang="en-US"><head><meta charset="utf-8"><title>Netflow Map compression methods</title></head><body><pre id="out">ready</pre>
<script>self.MEMORY_COMPRESSION_NO_EVAL = true;</script>
<script>${mc}</script><script>${engine}</script><script>${examples}</script><script>${run}</script></body></html>`;
writeFileSync(join(root, 'bench/compression-methods/page.html'), html);
console.log('wrote bench/compression-methods/page.html', Math.round(html.length / 1024), 'KB');
