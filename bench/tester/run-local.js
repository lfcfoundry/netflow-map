/* Copyright (c) 2026 LFC Foundry. MIT License. Runs the built tester page in one of this machine's browsers and prints the results file.
 *   node bench/tester/run-local.js <firefox|chromium> [quick] [--out=file.md]   (env TESTER_ONLY=3d runs just the steps whose name has that word; TESTER_PLAN3D=1000,3000 sets the 3D sizes)
 * For software WebGPU in Chromium: NFM_CHROME_ARGS='--enable-unsafe-webgpu --enable-features=Vulkan --use-vulkan=swiftshader --use-gl=angle --use-angle=swiftshader --ignore-gpu-blocklist' */
'use strict';
const path = require('path'), fs = require('fs'), { open } = require('../driver.js');
const which = process.argv[2] || 'chromium', quick = process.argv.includes('quick'), out = (process.argv.find((a) => a.startsWith('--out=')) || '').slice(6);
(async () => {
  const br = await open(which, { timeout: 1800000 });
  br.page.on && br.page.on('console', (m) => { const t = m.text ? m.text() : String(m); if (/error|fail/i.test(t)) console.log('[page]', t.slice(0, 200)); });
  br.page.on && br.page.on('pageerror', (e) => console.log('[pageerror]', String(e && e.message || e).slice(0, 300)));
  await br.goto('file://' + path.join(__dirname, '..', 'netflow-map-tester.html') + ('?' + [quick ? 'quick=1' : '', process.env.TESTER_PLAN ? 'plan=' + process.env.TESTER_PLAN : '', process.env.TESTER_ONLY ? 'only=' + process.env.TESTER_ONLY : '', process.env.TESTER_PLAN3D ? 'plan3d=' + process.env.TESTER_PLAN3D : ''].filter(Boolean).join('&')));
  const t0 = Date.now();
  for (;;) {
    await new Promise((r) => setTimeout(r, 2000));
    const st = await br.eval(() => [document.getElementById('status').textContent, !!window.__NFM_TESTER_RESULT]);
    if (st[1]) break; if (Date.now() - t0 > 1700000) { console.log('timeout'); break; }
    process.stdout.write('\r' + st[0].slice(0, 100).padEnd(100));
  }
  const md = await br.eval(() => window.__NFM_TESTER_RESULT && window.__NFM_TESTER_RESULT.md);
  console.log('\n' + (md || 'no result')); if (out && md) fs.writeFileSync(out, md);
  await br.close();
})();
