/* Copyright (c) 2026 LFC Foundry. MIT License. Does the browser's own storage work for a page opened as a file, and is it fast enough to keep built layouts and the compiled
 * WebAssembly between visits? One page per browser, opened from a file:// address like a downloaded copy of the app.
 *   node bench/storage-probe.js chromium|firefox|webkit|epiphany
 * Times are milliseconds, lower is better; medians of several tries. Nothing leaves the machine. */
'use strict';
const fs = require('fs'), path = require('path');
async function inPage(arg) {
  const out = { indexedDB: typeof indexedDB !== 'undefined', localStorage: false, wasmStore: 'not tried' };
  try { localStorage.setItem('p', '1'); out.localStorage = localStorage.getItem('p') === '1'; localStorage.removeItem('p'); } catch (e) { out.localStorage = 'blocked: ' + e.name; }
  const med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1], bytes = Uint8Array.from(atob(arg.b64), (c) => c.charCodeAt(0));
  const ct = []; for (let i = 0; i < 31; i++) { const t0 = performance.now(); new WebAssembly.Module(bytes); ct.push(performance.now() - t0); }
  out.compileMs = +med(ct).toFixed(3); out.wasmBytes = bytes.length;
  if (!out.indexedDB) return out;
  const open = () => new Promise((res, rej) => { const q = indexedDB.open('nfm-probe', 1); q.onupgradeneeded = () => q.result.createObjectStore('s'); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
  const tx = (db, mode, f) => new Promise((res, rej) => { const t = db.transaction('s', mode), r = f(t.objectStore('s')); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });
  try {
    const db = await open(); out.sizes = [];
    for (const items of [3000, 30000, 300000]) {
      const X = new Float64Array(items * 2); for (let i = 0; i < X.length; i++) X[i] = Math.random() * 1000;
      const w = [], r = [];
      for (let i = 0; i < 5; i++) { let t0 = performance.now(); await tx(db, 'readwrite', (s) => s.put(X, 'k' + items)); w.push(performance.now() - t0); t0 = performance.now(); const got = await tx(db, 'readonly', (s) => s.get('k' + items)); r.push(performance.now() - t0); if (!got || got.length !== X.length) throw new Error('read back wrong'); }
      out.sizes.push({ items, kb: Math.round(X.byteLength / 1024), writeMs: +med(w).toFixed(1), readMs: +med(r).toFixed(1) });
    }
    try { const m = new WebAssembly.Module(bytes); await tx(db, 'readwrite', (s) => s.put(m, 'mod')); const t0 = performance.now(); const back = await tx(db, 'readonly', (s) => s.get('mod')); out.wasmStore = back instanceof WebAssembly.Module ? 'works, read ' + (performance.now() - t0).toFixed(2) + ' ms' : 'stored but not a Module'; } catch (e) { out.wasmStore = 'refused: ' + e.name; }
    db.close(); indexedDB.deleteDatabase('nfm-probe');
  } catch (e) { out.idbError = e.name + ': ' + e.message; }
  return out;
}
(async () => {
  const which = process.argv[2] || 'chromium', page = path.join(require('os').tmpdir(), 'nfm-storage-probe.html');
  fs.writeFileSync(page, '<!doctype html><meta charset="utf-8"><title>probe</title>');
  const D = await require('./driver.js').open(which, { timeout: 600000 }); await D.goto('file://' + page);
  const b64 = fs.readFileSync(path.join(__dirname, '..', 'wasm', 'stress.wasm')).toString('base64');
  const r = await D.page.evaluate(inPage, { b64 }); const version = D.version; await D.close();
  console.log(version + ' ' + JSON.stringify(r)); process.exit(0);
})();
