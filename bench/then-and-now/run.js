// Copyright (c) 2026 LFC Foundry. MIT License.
// Runs bench/netflow-map-then-and-now.html in one of the four test browsers and prints the results text. One browser per call, never two at once.
// Run:  node bench/then-and-now/run.js chromium|firefox|webkit|epiphany [quick] [nobig] [huge]      (Firefox: xvfb-run -a, NFM_HEADFUL=1; paths as in bench/memory/page-pack-times.js)
const path = require('path'), which = process.argv[2] || 'chromium', quick = process.argv.includes('quick'), nobig = process.argv.includes('nobig'), huge = process.argv.includes('huge'), HOME = process.env.HOME || '/root';
const URL = 'file://' + path.resolve(process.env.NFM_PAGE || path.resolve(__dirname, '..', 'netflow-map-then-and-now.html'));
async function open() {
  if (which === 'webkit' || which === 'epiphany') { const b = await require('../webkit-driver.js').launch({ browser: which === 'epiphany' ? 'epiphany' : 'webkitgtk', width: 1100, height: 800 }); return { page: b.page, close: () => b.close(), version: b.version, wait: (fn, arg, ms) => b.page.waitForFunction(fn, arg, { timeout: ms }) }; }
  if (which === 'firefox') { const pp = require(process.env.NFM_PUPPETEER || '/tmp/pptr/node_modules/puppeteer-core'); const b = await pp.launch({ browser: 'firefox', executablePath: process.env.NFM_FIREFOX || HOME + '/browsers/firefox/firefox', headless: !process.env.NFM_HEADFUL, protocol: 'webDriverBiDi' }); const page = await b.newPage(); await page.setViewport({ width: 1100, height: 800 }); return { page, close: () => b.close(), version: 'firefox ' + await b.version(), wait: (fn, arg, ms) => page.waitForFunction(fn, { timeout: ms }, arg) }; }
  const pw = require(process.env.NFM_PLAYWRIGHT || 'playwright-core'); const b = await pw.chromium.launch({ executablePath: process.env.NFM_CHROME || HOME + '/browsers/ungoogled-chromium-155.0.8059.39-1-x86_64_linux/chrome', headless: true, args: ['--no-sandbox'] });
  const page = await (await b.newContext({ viewport: { width: 1100, height: 800 } })).newPage(); return { page, close: () => b.close(), version: 'chromium ' + b.version(), wait: (fn, arg, ms) => page.waitForFunction(fn, arg, { timeout: ms }) };
}
(async () => {
  const B = await open(), page = B.page; console.log('browser', which, B.version);
  await page.goto(URL); await B.wait(() => !!document.getElementById('go'), null, 30000);
  await page.evaluate((a) => { document.getElementById('quick').checked = a.quick; document.getElementById('big').checked = !a.nobig; document.getElementById('huge').checked = a.huge; document.getElementById('go').click(); }, { quick, nobig, huge });
  const t0 = Date.now(); await B.wait(() => !document.getElementById('out').hidden && !document.getElementById('go').disabled, null, 1500000);
  console.log('page run took', ((Date.now() - t0) / 1000).toFixed(0), 's'); console.log(await page.evaluate(() => document.getElementById('txt').value)); await B.close();
})();
