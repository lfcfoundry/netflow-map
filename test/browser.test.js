/* Copyright (c) 2026 JNFoo. MIT License. One browser session that exercises the built index.html.
 *   node test/browser.test.js chromium|firefox [outdir]
 * chromium: Playwright (NFM_PLAYWRIGHT = path to playwright-core, NFM_CHROME = browser program; ungoogled-chromium 154 is used when found)
 * NFM_PAGE = the page to test (default index.html; index.packed.html tests the self-extracting copy)
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
    return { b, page, close: () => b.close(), size: (w, h) => page.setViewport({ width: w, height: h }), wait: (fn, arg, ms) => page.waitForFunction(fn, { timeout: ms || 20000 }, arg), shot: (p) => page.screenshot({ path: p }), click: (x, y) => page.mouse.click(x, y), press: (k) => page.keyboard.press(k), drag: async (x0, y0, x1, y1) => { await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, { steps: 4 }); await page.mouse.move(x1, y1, { steps: 4 }); await page.mouse.up(); }, version: await b.version() };
  }
  const pw = require(process.env.NFM_PLAYWRIGHT || '/opt/npm-tools/node_modules/playwright-core');
  const b = await pw.chromium.launch({ executablePath: process.env.NFM_CHROME || ['/tmp/ugc/ungoogled-chromium-154.0.8037.97-1-x86_64_linux/chrome', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((f) => require('fs').existsSync(f)), headless: true, args: flags });
  const ctx = await b.newContext({ viewport: { width: 1100, height: 720 }, acceptDownloads: true }), page = await ctx.newPage();
  return { b, page, close: () => b.close(), size: (w, h) => page.setViewportSize({ width: w, height: h }), wait: (fn, arg, ms) => page.waitForFunction(fn, arg, { timeout: ms || 20000 }), shot: (p) => page.screenshot({ path: p }), click: (x, y) => page.mouse.click(x, y), press: (k) => page.keyboard.press(k), drag: async (x0, y0, x1, y1) => { await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, { steps: 4 }); await page.mouse.move(x1, y1, { steps: 4 }); await page.mouse.up(); }, version: b.version() };
}

(async () => {
  const D = await open(), page = D.page, errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + (e.message || e)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const set = (sel, v) => ev(([s, val]) => { const el = document.querySelector(s); el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, v]);
  const click = (sel) => ev((s) => document.querySelector(s).click(), sel);
  console.log('browser', which, D.version);
  await page.goto('file://' + path.resolve(__dirname, '..', process.env.NFM_PAGE || 'index.html'));
  await D.wait(() => window.NFM && NFM.client() && NFM.client().mode !== 'starting', null, 20000);
  say(true, 'page loaded; engine runs in the ' + (await ev(() => NFM.client().mode)));


  /* Data tab */
  await ev(() => NFM.ingest([{ name: 'e.csv', text: 'source,target,weight,cost\nA,B,2,5\nB,C,1,7\nA,C,3,1\nC,D,1,9\n' }]));
  const st = await ev(() => ({ n: NFM.state.graph.nodes.length, m: NFM.state.graph.edges.length, w: NFM.state.V.widthBy }));
  say(st.n === 4 && st.m === 4, `pasted table read: ${st.n} items, ${st.m} links`);
  say(st.w === 'weight', 'weights are used as link width by default');
  await D.wait(() => document.querySelectorAll('#cols table.cw tbody tr').length >= 2, null, 5000).catch(() => {});
  say(await ev(() => !document.getElementById('cols').hidden && document.querySelectorAll('#cols table.cw tbody tr').length >= 2), 'the columns workbench lists the columns: ' + (await ev(() => document.querySelectorAll('#cols table.cw tbody tr').length + ' rows, hidden=' + document.getElementById('cols').hidden)));
  await ev(() => NFM.showTab('nodes')); await sleep(200);
  await ev(() => Array.from(document.querySelectorAll('#nodes-body .seg button')).find((b) => b.textContent === 'Links').click());
  await set('#nt-filter', 'A'); await sleep(400);
  say((await ev(() => document.querySelectorAll('#table tbody tr').length)) === 2, 'links table filter works');
  await set('#nt-filter', '');
  await ev(() => NFM.ingest([{ name: 'n.md', path: 'v/n.md', text: '# N\n[[M]] and [[Zed]]' }, { name: 'm.md', path: 'v/m.md', text: '[[N]]' }], { format: 'notes' }));
  say((await ev(() => NFM.state.graph.nodes.length)) === 3, 'notes with [[links]] read, one placeholder');
  await ev(() => NFM.state.hist.length && NFM.showTab('data'));
  await click('#b-undo');

  /* Examples and every view */
  await ev(() => NFM.showTab('data')); await set('#examples', 'story'); await click('#b-example'); await click('#tabbtn-map');
  await D.wait(() => NFM.state.scene && NFM.manager() && NFM.manager().r, null, 30000);
  const views = ['flow', 'down', 'spine', 'lanes', 'shape', 'river', 'arc', 'matrix', 'network'];
  for (const v of views) {
    await ev((vv) => NFM.setV({ view: vv }), v);
    await D.wait((vv) => NFM.state.L && NFM.state.L.view === vv && NFM.state.scene && NFM.state.scene.view === vv, v, 20000);
    await sleep(150);
    const r = await ev(() => { const m = NFM.manager().r, s = m.snapshot(), d = s.data; let diff = 0; for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - d[0]) + Math.abs(d[i + 1] - d[1]) + Math.abs(d[i + 2] - d[2]) > 30) diff++; return { backend: m.name, share: diff / (d.length / 4) }; });
    say(r.share > 0.004, `${v}: drew something (${(r.share * 100).toFixed(1)}% of pixels) with ${r.backend}`);
    if (v === 'flow' || v === 'river' || v === 'network') await D.shot(path.join(outDir, `nfm-${which}-${v}.png`));
  }

  /* select, details, keyboard */
  await ev(() => NFM.setV({ view: 'flow' })); await D.wait(() => NFM.state.L.view === 'flow' && NFM.state.scene.view === 'flow'); await sleep(300);
  const pos = await ev(() => { const n = NFM.state.scene.nodes.find((x) => x.nodeId === 'hall'), S = NFM.state, r = document.getElementById('stage').getBoundingClientRect(); return [r.left + (n.x + n.w / 2) * S.view.k + S.view.tx, r.top + (n.y + n.h / 2) * S.view.k + S.view.ty]; });
  await D.click(pos[0], pos[1]); await sleep(250);
  say(await ev(() => NFM.state.sel.size === 1 && NFM.state.sel.has('hall')), 'clicking a box selects it');
  say(await ev(() => !document.getElementById('details').hidden), 'details panel shows');
  await ev(() => document.getElementById('stage').focus()); await D.press('ArrowRight'); await sleep(150);
  const after = await ev(() => Array.from(NFM.state.sel)[0]); say(!!after && after !== 'hall', 'arrow key follows a link to ' + after);
  await D.press('Escape'); await sleep(300);

  /* search, zoom, key, filters */
  await ev(() => NFM.runSearch('lens')); await sleep(200);
  say(await ev(() => NFM.state.search.hits.has('lens') && NFM.state.search.hits.size >= 1), 'search finds items');
  await ev(() => NFM.runSearch(''));
  const k0 = await ev(() => NFM.state.view.k); await ev(() => NFM.zoomAt(500, 400, 2)); await sleep(30);
  const kMid = await ev(() => NFM.state.view.k); await sleep(700); const k1 = await ev(() => NFM.state.view.k);
  say(k1 > k0 * 1.8 && kMid < k1 * 0.999, `zoom eases toward its target: ${k0.toFixed(2)} -> ${kMid.toFixed(2)} -> ${k1.toFixed(2)}`);
  await ev(() => NFM.fitView(true)); await sleep(200);
  const kb = await ev(() => { const r = document.getElementById('key').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; });
  await D.drag(kb[0] + 30, kb[1] + 12, kb[0] + 230, kb[1] - 100); await sleep(150);
  const kb2 = await ev(() => { const r = document.getElementById('key').getBoundingClientRect(); return [r.left, r.top]; });
  say(Math.abs(kb2[0] - kb[0] - 200) < 8 && kb2[1] < kb[1] - 60, `the key floats and drags (${Math.round(kb[0])},${Math.round(kb[1])} to ${Math.round(kb2[0])},${Math.round(kb2[1])})`);
  await ev(() => document.querySelector('#rt-filter').click()); await sleep(150);
  say(await ev(() => document.querySelectorAll('#railbody details.acc').length >= 1), 'filter panel lists facets with counts');

  /* network: arrangements, 3D, dragging a node */
  await ev(() => NFM.setV({ view: 'network', arrange: 'force3d' })); await D.wait(() => NFM.state.L.is3d && NFM.state.scene.is3d, null, 20000);
  const yaw0 = await ev(() => NFM.state.V.cam.yaw); await D.drag(700, 400, 820, 380); await sleep(250);
  say((await ev(() => NFM.state.V.cam.yaw)) - yaw0 > 0.3, '3D view turns when dragged');
  await ev(() => NFM.setV({ arrange: 'stress' })); await D.wait(() => NFM.state.L.view === 'network' && !NFM.state.L.is3d && NFM.state.scene.view === 'network', null, 20000); await sleep(250);
  const np = await ev(() => { const n = NFM.state.scene.nodes[2], S = NFM.state, r = document.getElementById('stage').getBoundingClientRect(); return [r.left + (n.x + n.w / 2) * S.view.k + S.view.tx, r.top + (n.y + n.h / 2) * S.view.k + S.view.ty, n.nodeId]; });
  await D.drag(np[0], np[1], np[0] + 90, np[1] + 40); await sleep(300);
  say(await ev((id) => !!(NFM.state.V.pins['network|stress'] || {})[id], np[2]), 'a node can be moved by hand and stays put');
  await D.click(300, 700);

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

  /* styled shapes, icons and group blobs draw the same in every backend */
  await ev(() => { NFM.state.V.rules = [{ id: 1, target: 'nodes', on: true, when: { type: 'all' }, set: { shape: 'hexagon', scale: 1.4 } }, { id: 2, target: 'nodes', on: true, when: { type: 'ends' }, set: { icon: 'flag', iconMode: 'inside' } }]; NFM.setV({ hulls: true }, 'look'); }); await sleep(300);
  const styled = async (be) => ev(async (be) => { const m = NFM.manager(); if (be !== 'canvas2d') m.canary[be] = { ok: true }; await m.use(be); if (m.r.name !== be) return { err: 'n/a' }; NFM.state.view = { k: 0.9, tx: 40, ty: 40 }; m.r.draw(NFM.state.view); const s = m.r.snapshot(); await m.r.flush(); return { data: Array.from(s.data) }; }, be);
  const sb = await styled('canvas2d');
  for (const be of ['webgl2', 'webgpu']) {
    const r2 = await styled(be); if (r2.err) { say(strict ? false : null, `${be} styled shapes: ${r2.err}`); continue; }
    let sum = 0, bad = 0; const n = sb.data.length / 4;
    for (let i = 0; i < sb.data.length; i += 4) { const d = (Math.abs(sb.data[i] - r2.data[i]) + Math.abs(sb.data[i + 1] - r2.data[i + 1]) + Math.abs(sb.data[i + 2] - r2.data[i + 2])) / 3; sum += d; if (d > 40) bad++; }
    say(sum / n <= 2 && bad / n < 0.015, `${be} matches basic drawing with shapes, icons and blobs: mean ${(sum / n).toFixed(2)}/255, ${(bad / n * 100).toFixed(2)}% far off`);
  }
  await ev(() => NFM.manager().use('auto'));

  /* states: timeline, play, widths change between states, GIF and HTML report */
  await ev(() => NFM.showTab('data')); await set('#examples', 'states'); await click('#b-example');
  await D.wait(() => NFM.state.graph.states && !document.getElementById('states').hidden, null, 20000);
  say(await ev(() => /4 states/.test(document.getElementById('states').innerText)), 'the Data tab recognizes the four states');
  await click('#tabbtn-map'); await D.wait(() => NFM.state.scene && !document.getElementById('timeline').hidden, null, 30000); await sleep(300);
  const sumW = () => ev(() => NFM.state.scene.curves.reduce((a, c) => a + (c.edge >= 0 ? c.w : 0), 0));
  const w0 = await sumW();
  await ev(() => document.querySelectorAll('#tl-ticks .tick')[3].click());
  await D.wait(() => NFM.state.V.state === 3 && NFM.state.L.edges.length > 0, null, 20000); await sleep(400);
  const w3 = await sumW(); say(Math.abs(w3 - w0) > 1, `link widths follow the state (${w0.toFixed(1)} at baseline, ${w3.toFixed(1)} at the end)`);
  await ev(() => document.querySelectorAll('#tl-ticks .tick')[0].click()); await D.wait(() => NFM.state.V.state === 0, null, 20000);
  await click('#tl-play'); await sleep(1800);
  const pos1 = await ev(() => parseFloat(document.getElementById('tl-range').value)); say(pos1 > 0.3, 'playing moves along the timeline (' + pos1.toFixed(2) + ')');
  await click('#tl-play'); await sleep(300);
  say(await ev(() => !document.getElementById('tl-play').textContent.includes('❚')), 'pausing works');
  await click('#tabbtn-export'); await sleep(200); await click('#gif-go');
  await D.wait(() => { const im = document.querySelector('#gif-out img'); return im && im.complete && im.naturalWidth > 0; }, null, 120000);
  const gifInfo = await ev(async () => { const im = document.querySelector('#gif-out img'), b = new Uint8Array(await (await fetch(im.src)).arrayBuffer()); return { head: String.fromCharCode(...b.slice(0, 6)), w: im.naturalWidth, bytes: b.length, text: document.getElementById('gif-out').innerText }; });
  say(gifInfo.head === 'GIF89a' && gifInfo.w === 960 && gifInfo.bytes > 5000, 'the GIF is made: ' + gifInfo.text.split('\n')[0]);
  say(await ev(() => !!Array.from(document.querySelectorAll('#gif-out button')).find((b) => /HTML report/.test(b.textContent))), 'the HTML report is offered');
  /* checks tab, advanced tab (one-button device check), export */
  await click('#tabbtn-check'); await D.wait(() => document.querySelector('#check-body .verdict'), null, 20000);
  say(await ev(() => document.querySelectorAll('#check-body .find, #check-body .verdict').length >= 1), 'the Check tab reports');
  /* simulation: dice agree with the exact odds, and the Map can show the result */
  await click('#tabbtn-adv'); await sleep(200); await click('#sim-run');
  await D.wait(() => /Done\./.test(document.getElementById('sim-results').innerText), null, 60000);
  const simTxt = await ev(() => document.getElementById('sim-results').innerText);
  say(/exact \d/.test(simTxt) && !/≠/.test(simTxt), 'simulated odds sit inside their ranges around the exact odds');
  await ev(() => Array.from(document.querySelectorAll('#sim-results button')).find((b) => b.textContent === 'Show on the Map').click());
  await D.wait(() => NFM.state.tab === 'map' && NFM.state.scene && NFM.state.scene.legendTitle === 'Simulated visits', null, 20000);
  say(true, 'the Map shows simulated visits as color and traffic as line width');
  await ev(() => { NFM.state.A.sim.dots = true; NFM.showTab('adv'); NFM.showTab('map'); }); await sleep(500);
  say(await ev(() => typeof NFM.state.scene.overlayDraw === 'function'), 'flow dots are on');
  await ev(() => { NFM.state.A.sim.dots = false; NFM.setV({ colorBy: 'group', widthBy: 'weight' }); });
  await click('#tabbtn-adv'); await click('#chk-run');
  await D.wait(() => document.querySelector('#chk-out .verdict'), null, 120000);
  const verdict = await ev(() => document.getElementById('chk-out').innerText); say(/seconds/.test(verdict), 'device check finished: ' + verdict.slice(0, 150).replace(/\s+/g, ' '));
  await click('#tabbtn-export'); await sleep(200);
  say(await ev(() => document.querySelectorAll('#export-body button').length >= 6), 'the Export tab offers its buttons');

  /* phone */
  await D.size(412, 800); await sleep(300);
  say((await ev(() => getComputedStyle(document.querySelector('.tabs')).position)) === 'fixed', 'on a phone the tabs move to the bottom');
  await click('#tabbtn-map'); await sleep(600); await D.shot(path.join(outDir, `nfm-${which}-phone.png`));
  say(await ev(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no sideways page scroll on a phone');
  /* phone, with a finger (the hook forces touch because Firefox cannot pretend to be a coarse pointer) */
  await ev(() => NFM.touch(true)); await sleep(150);
  say(await ev(() => document.body.classList.contains('touch') && document.body.classList.contains('narrow')), 'the touch hook marks the page as touch and narrow');
  say(await ev(() => { const t = document.querySelector('.tabs'); return t.scrollWidth <= t.clientWidth + 1; }), 'the bottom tabs never scroll sideways');
  say(await ev(() => [...document.querySelectorAll('.tabs button')].every((b) => b.getBoundingClientRect().height >= 44 && b.querySelector('svg').getBoundingClientRect().width > 0)), 'each bottom tab is at least 44 px tall and has an icon');
  await click('#tabbtn-data'); await set('#examples', 'states'); await click('#b-example'); await click('#tabbtn-map'); await sleep(1400); await ev(() => document.querySelector('#rail button[aria-label="Hide this panel"]').click()); await sleep(450);
  say(await ev(() => { const tl = document.getElementById('timeline').getBoundingClientRect(), st = document.getElementById('stage').getBoundingClientRect(); return !document.getElementById('timeline').hidden && st.bottom - tl.bottom < 20 && tl.height < 80; }), 'the timeline is one slim row docked at the bottom of the map');
  say(await ev(() => [...document.querySelectorAll('#ui button, .tabs button')].filter((b) => b.offsetParent && b.getBoundingClientRect().height > 0 && b.getBoundingClientRect().height < 35.5).length === 0), 'every visible button is at least 36 px tall on touch');
  say(await ev(() => [...document.querySelectorAll('#ui input[type=text], #ui input[type=number], #ui select')].filter((e) => e.offsetParent && parseFloat(getComputedStyle(e).fontSize) < 16).length === 0), 'fields are 16 px on touch (so iOS does not zoom)');
  await click('#railtoggle'); await sleep(450);
  say(await ev(() => { const r = document.getElementById('rail').getBoundingClientRect(), tl = document.getElementById('timeline').getBoundingClientRect(), st = document.getElementById('stage').getBoundingClientRect(); return r.height <= st.height * 0.55 && tl.bottom <= r.top + 1; }), 'the open sheet is at most 55% and the timeline sits above it');
  await click('#peekbtn'); await sleep(450);
  say(await ev(() => { const r = document.getElementById('rail').getBoundingClientRect(), tl = document.getElementById('timeline').getBoundingClientRect(); return r.height < 80 && tl.bottom <= r.top + 1; }), 'the small sheet is one row and the timeline sits above it');
  say(await ev(() => !/right-click|ctrl\+/i.test(document.getElementById('rail').innerText)), 'no right-click or Ctrl words in the controls on touch');
  await ev(() => NFM.touch(null)); await D.size(1100, 720); await sleep(200);

  say(errs.length === 0, 'no errors in the console' + (errs.length ? ': ' + errs.slice(0, 4).join(' | ') : ''));
  await D.close(); console.log(fails ? `${fails} FAILED` : 'browser test: all passed'); process.exitCode = fails ? 1 : 0;
})().catch((e) => { console.log('crash', e && e.stack || e); process.exit(2); });
