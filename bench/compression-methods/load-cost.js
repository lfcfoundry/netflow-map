// Copyright (c) 2026 LFC Foundry. MIT License. What loading memory-compression costs a page in Chromium 155, split by part: the script text itself, the WebAssembly helpers, the rest. Each case runs in a fresh browser, 5 times, in turn; medians shown (lower is better).
// Run:  node bench/compression-methods/load-cost.js   (renderer resident memory read from /proc as change from a blank page; JS heap exact)
const fs = require('fs'), path = require('path'), cp = require('child_process'), HOME = process.env.HOME || '/root';
const SRC = fs.readFileSync(path.resolve(__dirname, '../../vendor/memory-compression.js'), 'utf8');
const noWasm = SRC.replace(/(var WASM_B64 = \/\*WASM:BEGIN\*\/)'[^']*'/, "$1''").replace(/(KERNELS_B64 = \/\*KW:BEGIN\*\/)'[^']*'/, "$1''");
if (noWasm.length > SRC.length - 30000) throw new Error('the wasm text was not removed');
const noKernels = SRC.replace(/(KERNELS_B64 = \/\*KW:BEGIN\*\/)'[^']*'/, "$1''");
const dummy = '/* ' + 'x'.repeat(SRC.length) + ' */\nself.__dummy = 1;';
let minified = null; try { minified = require(process.env.NFM_ESBUILD || '/tmp/esb/node_modules/esbuild').transformSync(SRC, { minify: true, target: 'es2019' }).code; } catch (e) { /* no esbuild here: that case is left out */ }
const dummyOf = (n) => '/* ' + 'x'.repeat(n) + ' */\nself.__dummy = 1;';
const CASES = [['blank page', ''], ['script text of the same size, doing nothing', dummy], ['script text, a quarter of the size, doing nothing', dummyOf(SRC.length >> 2)], ['script text, half the size, doing nothing', dummyOf(SRC.length >> 1)], ['module without either wasm helper', noWasm], ['module without the helper for text and columns', noKernels], ['module as shipped', SRC]].concat(minified ? [['module as shipped, minified (' + (minified.length >> 10) + ' KB)', minified]] : []);
const med = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
(async () => {
  const pw = require(process.env.NFM_PLAYWRIGHT || 'playwright-core'); let ver = '';
  const res = CASES.map(() => ({ rss: [], heap: [] })), rounds = +process.env.ROUNDS || 5;
  for (let r = 0; r < rounds; r++) for (let c = 0; c < CASES.length; c++) {
    const b = await pw.chromium.launch({ executablePath: process.env.NFM_CHROME || HOME + '/browsers/ungoogled-chromium-155.0.8059.39-1-x86_64_linux/chrome', headless: true, args: ['--no-sandbox', '--js-flags=--expose-gc', '--renderer-process-limit=1', '--disable-features=SpareRendererForSitePerProcess,SpareRenderer'] }); ver = b.version();
    const page = await (await b.newContext()).newPage(), cdp = await page.context().newCDPSession(page);
    await page.setContent('<!doctype html><title>t</title>'); if (CASES[c][1]) await page.addScriptTag({ content: CASES[c][1] });
    await new Promise((q) => setTimeout(q, 600)); await cdp.send('HeapProfiler.collectGarbage'); await cdp.send('HeapProfiler.collectGarbage');
    const h = (await cdp.send('Runtime.getHeapUsage')).usedSize, ps = cp.execSync('ps -eo pid,rss,args | grep "type=renderer" | grep -v grep').toString().split('\n').filter(Boolean).map((l) => l.trim().split(/\s+/));
    res[c].heap.push(h); res[c].rss.push(+ps.sort((x, y) => +y[0] - +x[0])[0][1] * 1024);   /* the newest renderer process is the page's (an older spare one is bigger) */ await b.close();
  }
  const mb = (n) => (n / 1048576).toFixed(2), base = med(res[0].rss), bh = med(res[0].heap);
  console.log('browser chromium', ver, '; rounds', rounds);
  console.log('| case | JS heap MB | resident change from blank, MB | spread of resident, MB |\n|---|---|---|---|');
  CASES.forEach((c, i) => console.log('| ' + c[0] + ' | ' + mb(med(res[i].heap) - bh) + ' | ' + mb(med(res[i].rss) - base) + ' | ' + mb(Math.min(...res[i].rss) - base) + ' to ' + mb(Math.max(...res[i].rss) - base) + ' |'));
})();
