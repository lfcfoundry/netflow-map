/* Copyright (c) 2026 JNFoo. MIT License. One browser session that exercises the built index.html.
 *   node test/browser.test.js chromium|firefox [outdir]
 * chromium: Playwright (NFM_PLAYWRIGHT = path to playwright-core, NFM_CHROME = browser program)
 * firefox:  Puppeteer over WebDriver BiDi (NFM_PUPPETEER = path to puppeteer-core, NFM_FIREFOX = browser program) */
'use strict';
const path = require('path');
const which = process.argv[2] || 'chromium', outDir = process.argv[3] || '/tmp';
const strict = which === 'chromium' || !!process.env.NFM_STRICT;
const flags = ['--no-sandbox', '--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'];
let fails = 0; const say = (ok, t) => { if (ok === false) fails++; console.log((ok === true ? 'ok   ' : ok === false ? 'FAIL ' : 'note ') + t); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function open() {
  if (which === 'firefox') {
    const pp = require(process.env.NFM_PUPPETEER || '/tmp/pptr/node_modules/puppeteer-core');
    // WebGL 2 needs a display (run under xvfb-run with NFM_HEADFUL=1); WebGPU needs a Vulkan driver (NFM_VK_ICD = a vk_*_icd.json file, e.g. SwiftShader's)
    const env = Object.assign({}, process.env, process.env.NFM_VK_ICD ? { VK_ICD_FILENAMES: process.env.NFM_VK_ICD, VK_DRIVER_FILES: process.env.NFM_VK_ICD } : {}, { LIBGL_ALWAYS_SOFTWARE: '1' });
    const b = await pp.launch({ browser: 'firefox', executablePath: process.env.NFM_FIREFOX || '/tmp/ffdl/firefox/firefox', headless: !process.env.NFM_HEADFUL, protocol: 'webDriverBiDi', env, extraPrefsFirefox: { 'dom.webgpu.enabled': true, 'gfx.webgpu.ignore-blocklist': true, 'webgl.force-enabled': true, 'webgl.enable-webgl2': true } });
    const page = await b.newPage(); await page.setViewport({ width: 1100, height: 720 });
    return { b, page, close: () => b.close(), size: (w, h) => page.setViewport({ width: w, height: h }), wait: (fn, arg, ms) => page.waitForFunction(fn, { timeout: ms || 20000 }, arg), shot: (p) => page.screenshot({ path: p }), click: (x, y) => page.mouse.click(x, y), press: (k) => page.keyboard.press(k), version: await b.version() };
  }
  const pw = require(process.env.NFM_PLAYWRIGHT || '/opt/npm-tools/node_modules/playwright-core');
  const b = await pw.chromium.launch({ executablePath: process.env.NFM_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', headless: true, args: flags });
  const ctx = await b.newContext({ viewport: { width: 1100, height: 720 }, acceptDownloads: true }), page = await ctx.newPage();
  return { b, page, close: () => b.close(), size: (w, h) => page.setViewportSize({ width: w, height: h }), wait: (fn, arg, ms) => page.waitForFunction(fn, arg, { timeout: ms || 20000 }), shot: (p) => page.screenshot({ path: p }), click: (x, y) => page.mouse.click(x, y), press: (k) => page.keyboard.press(k), version: b.version() };
}

(async () => {
  const D = await open(), page = D.page, errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + (e.message || e)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const set = (sel, v) => ev(([s, val]) => { const el = document.querySelector(s); el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, v]);
  const click = (sel) => ev((s) => document.querySelector(s).click(), sel);
  console.log('browser', which, D.version);
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await D.wait(() => window.NFM && NFM.client() && NFM.client().mode !== 'starting', null, 20000);
  say(true, 'page loaded; engine runs in the ' + (await ev(() => NFM.client().mode)));

  /* Data tab */
  await ev(() => NFM.ingest([{ name: 'e.csv', text: 'source,target,weight\nA,B,2\nB,C,1\nA,C,3\nC,D,1\n' }]));
  const st = await ev(() => ({ n: NFM.state.graph.nodes.length, m: NFM.state.graph.edges.length }));
  say(st.n === 4 && st.m === 4, `pasted table read: ${st.n} items, ${st.m} links`);
  await click('#tb-links'); await set('#filter', 'A'); await sleep(400);
  say((await ev(() => document.querySelectorAll('#table tbody tr').length)) === 2, 'links table filter works');
  await set('#filter', ''); await click('#tb-items');
  await ev(() => NFM.ingest([{ name: 'n.md', path: 'v/n.md', text: '# N\n[[M]] and [[Zed]]' }, { name: 'm.md', path: 'v/m.md', text: '[[N]]' }], { format: 'notes' }));
  say((await ev(() => NFM.state.graph.nodes.length)) === 3, 'notes with [[links]] read, one placeholder');
  await ev(() => NFM.state.hist.length && document.getElementById('b-undo').click());

  /* Examples and every view */
  await set('#examples', 'story'); await click('#b-example'); await click('#tabbtn-map');
  await D.wait(() => NFM.state.scene && NFM.manager() && NFM.manager().r, null, 30000);
  const views = ['flow', 'down', 'spine', 'lanes', 'shape', 'river', 'arc', 'matrix', 'network'];
  for (const v of views) {
    await set('#view', v);
    await D.wait((vv) => NFM.state.L && NFM.state.L.view === vv && NFM.state.scene && NFM.state.scene.view === vv, v, 20000);
    await sleep(150);
    const r = await ev(() => { const m = NFM.manager().r, s = m.snapshot(), d = s.data; let diff = 0; for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - d[0]) + Math.abs(d[i + 1] - d[1]) + Math.abs(d[i + 2] - d[2]) > 30) diff++; return { backend: m.name, share: diff / (d.length / 4) }; });
    say(r.share > 0.004, `${v}: drew something (${(r.share * 100).toFixed(1)}% of pixels) with ${r.backend}`);
    if (v === 'flow' || v === 'river' || v === 'network') await D.shot(path.join(outDir, `nfm-${which}-${v}.png`));
  }

  /* select, details, keyboard */
  await set('#view', 'flow'); await D.wait(() => NFM.state.L.view === 'flow' && NFM.state.scene.view === 'flow'); await sleep(200);
  const pos = await ev(() => { const n = NFM.state.scene.nodes.find((x) => x.nodeId === 'hall'), S = NFM.state, r = document.getElementById('stage').getBoundingClientRect(); return [r.left + (n.x + n.w / 2) * S.view.k + S.view.tx, r.top + (n.y + n.h / 2) * S.view.k + S.view.ty]; });
  await D.click(pos[0], pos[1]); await sleep(200);
  say((await ev(() => NFM.state.sel)) === 'hall', 'clicking a box selects it');
  say(await ev(() => !document.getElementById('details').hidden), 'details panel shows');
  await ev(() => document.getElementById('stage').focus()); await D.press('ArrowRight'); await sleep(100);
  const after = await ev(() => NFM.state.sel); say(!!after && after !== 'hall', 'arrow key follows a link to ' + after);
  await D.press('Escape'); await sleep(500);

  /* backends agree */
  const snap = async (be) => ev(async (be) => {
    const m = NFM.manager(); if (be !== 'canvas2d') m.canary[be] = { ok: true };
    try { await m.use(be); } catch (e) { return { err: e.message }; }
    if (m.r.name !== be) return { err: 'not available here (fell back to ' + m.r.name + ')' };
    NFM.state.view = { k: 0.6, tx: 20, ty: 20 }; m.r.draw(NFM.state.view); const s = m.r.snapshot(); await m.r.flush();
    return { w: s.width, h: s.height, data: Array.from(s.data) };
  }, be);
  const base = await snap('canvas2d');
  for (const be of ['webgl2', 'webgpu']) {
    const res = await snap(be);
    if (res.err) { say(strict ? false : null, `${be}: ${res.err}`); continue; }
    let sum = 0, bad = 0; const n = base.data.length / 4;
    for (let i = 0; i < base.data.length; i += 4) { const d = (Math.abs(base.data[i] - res.data[i]) + Math.abs(base.data[i + 1] - res.data[i + 1]) + Math.abs(base.data[i + 2] - res.data[i + 2])) / 3; sum += d; if (d > 40) bad++; }
    say(res.w === base.w && sum / n <= 1.5 && bad / n < 0.01, `${be} matches basic drawing: mean ${(sum / n).toFixed(2)}/255, ${(bad / n * 100).toFixed(2)}% pixels far off`);
  }
  await ev(() => NFM.manager().use('auto'));

  /* one-button check */
  await click('#btn-check'); await click('#chk-run');
  await D.wait(() => document.querySelector('#chk-out .verdict'), null, 120000);
  const verdict = await ev(() => document.getElementById('chk-out').innerText); say(/seconds/.test(verdict), 'device check finished: ' + verdict.slice(0, 150).replace(/\s+/g, ' '));
  await click('#chk-close');

  /* phone */
  await D.size(412, 800); await sleep(300);
  say((await ev(() => getComputedStyle(document.querySelector('.tabs')).position)) === 'fixed', 'on a phone the tabs move to the bottom');
  await D.shot(path.join(outDir, `nfm-${which}-phone.png`));
  say(await ev(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no sideways page scroll on a phone');

  say(errs.length === 0, 'no errors in the console' + (errs.length ? ': ' + errs.slice(0, 4).join(' | ') : ''));
  await D.close(); console.log(fails ? `${fails} FAILED` : 'browser test: all passed'); process.exitCode = fails ? 1 : 0;
})().catch((e) => { console.log('crash', e && e.stack || e); process.exit(2); });
