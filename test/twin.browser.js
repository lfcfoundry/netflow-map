/* Copyright (c) 2026 LFC Foundry. MIT License. Two copies of the page in one browser: the first is in charge, the second shows the "Open in another tab" card and saves nothing, "Use this tab" hands over.
 *   node test/twin.browser.js chromium|firefox [page=index.html]   (pass/fail only) */
'use strict';
const path = require('path'), which = process.argv[2] || 'chromium', page = path.resolve(process.argv[3] || path.join(__dirname, '..', 'index.html'));
(async () => {
  const D = await require('../bench/driver.js').open(which, { timeout: 120000 });
  let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
  try {
    const url = 'file://' + page + '?twin=on', ready = (p) => p.waitForFunction(() => typeof NFM !== 'undefined' && !!NFM.setGraph, { timeout: 60000 });
    const A = D.page; await A.goto(url); await ready(A);
    const B = which === 'chromium' ? await A.context().newPage() : await D.b.newPage(); await B.goto(url); await ready(B);
    await new Promise((r) => setTimeout(r, 1500));
    const open = (p) => p.evaluate(() => document.getElementById('dlg').open && /another tab/.test(document.getElementById('dlg-body').textContent));
    ok(!(await open(A)), 'the first copy shows no card'); ok(await open(B), 'the second copy shows the card');
    await B.evaluate(() => { localStorage.setItem('nfm-probe', 'before'); });
    const kept = await B.evaluate(() => { const k = 'nfm-graph'; const before = localStorage.getItem(k); NFM.setGraph({ nodes: [{ id: 'x' }], edges: [] }); return before; });
    await new Promise((r) => setTimeout(r, 2500));
    const after = await A.evaluate(() => localStorage.getItem('nfm-graph'));
    ok(after === kept || after === null || !/"x"/.test(after || ''), 'the second copy saved nothing');
    await B.evaluate(() => { const b = [...document.querySelectorAll('#dlg button')].find((x) => /Use this tab/.test(x.textContent)); b.click(); });
    await new Promise((r) => setTimeout(r, 3000)); await ready(B);
    ok(await A.evaluate(() => document.getElementById('dlg').open && /another tab/.test(document.getElementById('dlg-body').textContent)), 'after "Use this tab" the first copy gets the card');
  } finally { await D.close(); }
  console.log(bad ? bad + ' failed' : 'twin test: all passed'); process.exit(bad ? 1 : 0);
})();
