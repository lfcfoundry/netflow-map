/* Copyright (c) 2026 LFC Foundry. MIT License. Runs the built race page in one of this machine's browsers and prints the results file.
 *   node bench/d3race/run-local.js <firefox|chromium|webkit|epiphany> [quick] [--out=file.md] */
'use strict';
const path = require('path'), fs = require('fs'), { open } = require('../driver.js');
const which = process.argv[2] || 'chromium', quick = process.argv.includes('quick'), out = (process.argv.find((a) => a.startsWith('--out=')) || '').slice(6);
(async () => {
  const br = await open(which, { timeout: 1800000 });
  console.log('Browser: ' + br.version);
  br.page.on && br.page.on('console', (m) => { const t = m.text ? m.text() : String(m); if (/error|fail/i.test(t)) console.log('[page]', t.slice(0, 200)); });
  br.page.on && br.page.on('pageerror', (e) => console.log('[pageerror]', String(e && e.message || e).slice(0, 300)));
  await br.goto('file://' + path.join(__dirname, '..', 'netflow-map-d3-race.html') + '?auto' + (quick ? '&quick' : ''));
  const t0 = Date.now();
  for (;;) {
    await new Promise((r) => setTimeout(r, 2000));
    const st = await br.eval(() => [document.getElementById('status').textContent, !!window.__NFM_RACE_RESULT]);
    if (st[1]) break; if (Date.now() - t0 > 1700000) { console.log('timeout'); break; }
    process.stdout.write('\r' + st[0].slice(0, 100).padEnd(100));
  }
  const md = await br.eval(() => window.__NFM_RACE_RESULT && window.__NFM_RACE_RESULT.md);
  console.log('\nBrowser: ' + br.version + '\n' + (md || 'no result')); if (out && md) fs.writeFileSync(out, md.replace('\n\n', '\n\nBrowser as printed by the test program: **' + br.version + '**.\n\n'));
  await br.close();
})();
