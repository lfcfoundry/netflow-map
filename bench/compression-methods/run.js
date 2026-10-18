// Copyright (c) 2026 LFC Foundry. MIT License. Packs about 100,000 items of many kinds with memory-compression in one test browser and prints which way held the bytes, one data set at a time.
// Run:  node bench/compression-methods/make.mjs && node bench/compression-methods/run.js firefox [set ...]   (Firefox: xvfb-run -a, NFM_HEADFUL=1; paths as in bench/then-and-now/run.js). Sets: app:communities app:random app:hub app:rich other
const path = require('path'), fs = require('fs'), which = process.argv[2] || 'firefox', only = process.argv.slice(3), HOME = process.env.HOME || '/root';
const URL = 'file://' + path.resolve(__dirname, 'page.html');
async function open() {
  if (which === 'webkit' || which === 'epiphany') { const b = await require('../webkit-driver.js').launch({ browser: which === 'epiphany' ? 'epiphany' : 'webkitgtk', width: 1100, height: 800 }); return { page: b.page, close: () => b.close(), version: b.version, wait: (fn, arg, ms) => b.page.waitForFunction(fn, arg, { timeout: ms }) }; }
  if (which === 'firefox') { const pp = require(process.env.NFM_PUPPETEER || '/tmp/pptr/node_modules/puppeteer-core'); const b = await pp.launch({ browser: 'firefox', executablePath: process.env.NFM_FIREFOX || HOME + '/browsers/firefox/firefox', headless: !process.env.NFM_HEADFUL, protocol: 'webDriverBiDi' }); const page = await b.newPage(); return { page, close: () => b.close(), version: 'firefox ' + await b.version(), wait: (fn, arg, ms) => page.waitForFunction(fn, { timeout: ms }, arg) }; }
  const pw = require(process.env.NFM_PLAYWRIGHT || 'playwright-core'); const b = await pw.chromium.launch({ executablePath: process.env.NFM_CHROME || HOME + '/browsers/ungoogled-chromium-155.0.8059.39-1-x86_64_linux/chrome', headless: true, args: ['--no-sandbox'] });
  const page = await (await b.newContext()).newPage(); return { page, close: () => b.close(), version: 'chromium ' + b.version(), wait: (fn, arg, ms) => page.waitForFunction(fn, arg, { timeout: ms }) };
}
const kb = (n) => n >= 1048576 ? (n / 1048576).toFixed(2) + ' MB' : (n / 1024).toFixed(1) + ' KB';
(async () => {
  const B = await open(), page = B.page; console.log('browser', which, B.version);
  await page.goto(URL); await B.wait(() => !!window.__methods, null, 30000);
  const sets = await page.evaluate(() => window.__methodSets), all = [];
  for (const s of sets) {
    if (only.length && !only.includes(s)) continue;
    const r = await page.evaluate((w) => window.__methods(w), s); all.push({ set: s, ...r });
    console.log('\n## data set ' + s + ' (' + r.ms + ' ms)');
    console.log('| piece | mode | raw | packed | % of raw (lower is better) | pack ms | unpack ms | exact | ways that held the bytes (share of packed) |\n|---|---|---|---|---|---|---|---|---|');
    for (const x of r.results) {
      if (x.error) { console.log('| ' + x.label + ' | ' + x.mode + ' | error: ' + x.error + ' |'); continue; }
      const tot = Object.values(x.parts).reduce((a, p) => a + p.bytes, 0) || 1;
      const ways = Object.entries(x.parts).sort((a, b) => b[1].bytes - a[1].bytes).slice(0, 5).map(([k, p]) => k + ' ' + Math.round(100 * p.bytes / tot) + '%').join(', ');
      const w = Object.entries(x.ways).sort((a, b) => b[1].bytes - a[1].bytes).map(([k, q]) => k + ' x' + q.blocks).join(', '), by = Object.entries(x.by).sort((a, b) => b[1].outBytes - a[1].outBytes).map(([k, q]) => k + ' x' + q.chunks + ' (' + kb(q.inBytes) + ' to ' + kb(q.outBytes) + ')').join('; '), c = Object.entries(x.cols).sort((a, b) => b[1] - a[1]).map(([k, q]) => k + ' x' + q).join(', ');
      console.log('| ' + x.label + ' | ' + x.mode + ' | ' + (x.raw ? kb(x.raw) : '-') + ' | ' + kb(x.packed) + ' | ' + (x.raw ? (100 * x.packed / x.raw).toFixed(1) + '%' : '-') + ' | ' + x.packMs + ' | ' + x.unpackMs + ' | ' + (x.exact ? 'yes' : 'NO') + ' | ' + ways + ' |'); console.log('|  | ^ number blocks: ' + (w || 'none') + ' | column kinds: ' + (c || 'none') + ' | byte coder: ' + (by || 'none') + ' ||||||');
    }
  }
  fs.writeFileSync(path.join(process.env.NFM_OUT || '/tmp', 'compression-methods-' + which + '.json'), JSON.stringify({ browser: B.version, all }));
  await B.close();
})();
