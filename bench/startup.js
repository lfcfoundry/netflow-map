/* Copyright (c) 2026 LFC Foundry. MIT License. How long the page takes to open, in one browser: the plain page, the fast-opening deflate copy and the LZMA copy, each opened from a file, rotating.
 *   node bench/startup.js chromium|firefox|webkit|epiphany [loads] [plain.html] [fast.html] [packed.html] [packed-by-the-previous-packer.html]
 * Milliseconds from the start of the page load, lower is better: DOMContentLoaded (the page's own script has run), load, first paint (when the browser reports it), and "ready" (the app object exists and the first frame after it has been drawn).
 * Medians of `loads` opens after one untimed open of each. */
'use strict';
const path = require('path');
(async () => {
  const which = process.argv[2] || 'chromium', loads = +(process.argv[3] || 7), root = path.join(__dirname, '..');
  const files = { plain: path.resolve(process.argv[4] || path.join(root, 'index.html')), fast: path.resolve(process.argv[5] || path.join(root, 'index.fast.html')), packed: path.resolve(process.argv[6] || path.join(root, 'index.packed.html')) }, kinds = ['plain', 'fast', 'packed'];
  if (process.argv[7]) { files.packedOld = path.resolve(process.argv[7]); kinds.push('packedOld'); }   // optional 7th argument: the LZMA copy made by the previous packer, to take turns with the new one
  const D = await require('./driver.js').open(which, { timeout: 600000 }), med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1], out = { plain: [], fast: [], packed: [], packedOld: [] };
  const once = async (kind) => {
    await D.goto('about:blank'); await D.goto('file://' + files[kind]);
    return D.page.evaluate(() => new Promise((res) => {
      const t = setInterval(() => {   // the packed page unpacks first and builds the app afterwards, so wait for the app object
        if (typeof NFM === 'undefined') return;
        clearInterval(t);
        const n = performance.getEntriesByType('navigation')[0] || {}, p = performance.getEntriesByName('first-contentful-paint')[0] || performance.getEntriesByName('first-paint')[0], appAt = performance.now();
        requestAnimationFrame(() => requestAnimationFrame(() => res({ dcl: n.domContentLoadedEventEnd || null, load: n.loadEventEnd || null, paint: p ? p.startTime : null, appAt, ready: performance.now(), app: true })));
      }, 2);
      setTimeout(() => { clearInterval(t); res({ dcl: null, load: null, paint: null, appAt: null, ready: null, app: false }); }, 15000);
    }));
  };
  for (const k of kinds) await once(k);
  for (let i = 0; i < loads; i++) { const rot = kinds.slice(i % kinds.length).concat(kinds.slice(0, i % kinds.length)); for (const k of rot) out[k].push(await once(k)); }
  const version = D.version; await D.close();
  const col = (k, f) => { const v = out[k].map((r) => r[f]).filter((x) => x !== null); return v.length ? Math.round(med(v)) : 'n/a'; };
  console.log('\n' + version + ' (median of ' + loads + ' opens from a file; milliseconds, lower is better)\n\n| page | DOMContentLoaded | load | first paint | app object exists | ready (two frames later) |\n|---|---|---|---|---|---|');
  for (const k of kinds) console.log(`| ${k} | ${col(k, 'dcl')} | ${col(k, 'load')} | ${col(k, 'paint')} | ${col(k, 'appAt')} | ${col(k, 'ready')} |`);
  console.log('app object present: ' + kinds.map((k) => out[k].every((r) => r.app)).join(' / '));
  require('fs').writeFileSync(path.join(__dirname, 'results', 'startup-' + which + '.json'), JSON.stringify({ version, loads, out }, null, 1));
  process.exit(0);
})();
