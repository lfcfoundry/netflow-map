// Copyright (c) 2026 LFC Foundry. MIT License. Times the first layout of a 3,000-item map after the layout worker sat idle for 2 s, warm-up on against off, in one test browser.
// Run:  node bench/warmup/make.mjs && node bench/warmup/run.js chromium|firefox|webkit|epiphany [items] [rounds]   (Firefox: xvfb-run -a, NFM_HEADFUL=1; paths as in bench/then-and-now/run.js)
const path = require('path'), which = process.argv[2] || 'chromium', items = +process.argv[3] || 3000, rounds = +process.argv[4] || 5, idle = +process.argv[5] || 2000, HOME = process.env.HOME || '/root';
const URL = 'file://' + path.resolve(__dirname, 'page.html');
async function open() {
  if (which === 'webkit' || which === 'epiphany') { const b = await require('../webkit-driver.js').launch({ browser: which === 'epiphany' ? 'epiphany' : 'webkitgtk', width: 1100, height: 800 }); return { page: b.page, close: () => b.close(), version: b.version, wait: (fn, arg, ms) => b.page.waitForFunction(fn, arg, { timeout: ms }) }; }
  if (which === 'firefox') { const pp = require(process.env.NFM_PUPPETEER || '/tmp/pptr/node_modules/puppeteer-core'); const b = await pp.launch({ browser: 'firefox', executablePath: process.env.NFM_FIREFOX || HOME + '/browsers/firefox/firefox', headless: !process.env.NFM_HEADFUL, protocol: 'webDriverBiDi' }); const page = await b.newPage(); return { page, close: () => b.close(), version: 'firefox ' + await b.version(), wait: (fn, arg, ms) => page.waitForFunction(fn, { timeout: ms }, arg) }; }
  const pw = require(process.env.NFM_PLAYWRIGHT || 'playwright-core'); const b = await pw.chromium.launch({ executablePath: process.env.NFM_CHROME || HOME + '/browsers/ungoogled-chromium-155.0.8059.39-1-x86_64_linux/chrome', headless: true, args: ['--no-sandbox'] });
  const page = await (await b.newContext()).newPage(); return { page, close: () => b.close(), version: 'chromium ' + b.version(), wait: (fn, arg, ms) => page.waitForFunction(fn, arg, { timeout: ms }) };
}
(async () => {
  const B = await open(), page = B.page; console.log('browser', which, B.version);
  await page.goto(URL); await B.wait(() => !!window.__warmBench, null, 30000);
  const r = await page.evaluate((a) => window.__warmBench(a.items, a.rounds, a.idle), { items, rounds, idle });
  const med = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
  console.log('first layout of', items, 'items after ' + idle / 1000 + ' s idle, ms (lower is better); worker modes seen:', Object.keys(r.modes).join(', '));
  console.log('warm-up off:', r.off.join(' '), ' median', med(r.off)); console.log('warm-up on :', r.on.join(' '), ' median', med(r.on));
  console.log('on against off:', (med(r.off) / med(r.on)).toFixed(2) + 'x', med(r.on) <= med(r.off) ? '(on is faster)' : '(on is slower)');
  await B.close();
})();
