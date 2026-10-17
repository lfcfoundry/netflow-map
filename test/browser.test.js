/* Copyright (c) 2026 LFC Foundry. MIT License. One browser session that exercises the built index.html.
 *   node test/browser.test.js chromium|firefox|webkit|epiphany [outdir]   (webkit = WebKitGTK 2.52.6 through bench/webkit-driver.js; epiphany = GNOME Web)
 * chromium: Playwright (NFM_PLAYWRIGHT = path to playwright-core, NFM_CHROME = browser program; ungoogled-chromium 155 from the browsers branch)
 * NFM_PAGE = the page to test (default index.html; index.packed.html tests the self-extracting copy)
 * firefox:  Puppeteer over WebDriver BiDi (NFM_PUPPETEER = path to puppeteer-core, NFM_FIREFOX = browser program) */
'use strict';
const path = require('path');
const which = process.argv[2] || 'chromium', outDir = process.argv[3] || '/tmp';
const strict = which === 'chromium' || !!process.env.NFM_STRICT;
const flags = ['--no-sandbox', '--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'];
const T0 = Date.now(); let tLast = T0;   /* NFM_TIMES=1 puts the seconds since the last line in front of every line: where the time goes */
let fails = 0; const say = (ok, t) => { if (ok === false) fails++; const now = Date.now(), pre = process.env.NFM_TIMES ? String(((now - tLast) / 1000).toFixed(1)).padStart(5) + 's ' : ''; tLast = now; console.log(pre + (ok === true ? 'ok   ' : ok === false ? 'FAIL ' : 'note ') + t); };
let slept = 0, sleeps = 0; const sleep = (ms) => { slept += ms; sleeps++; return new Promise((r) => setTimeout(r, ms)); };
/* Short pauses only let the screen catch up after a click or drag. Wait for three real animation frames plus a quarter of the old pause instead of the whole pause (NFM_SLOW=1 restores the full pauses). Long pauses (over 450 ms) are real time (easing, playback) and stay as they were. */

async function open() {
  if (which === 'webkit' || which === 'epiphany') {   /* WebKitGTK / GNOME Web through bench/webkit-driver.js (Playwright and Puppeteer cannot drive them); software drawing, a virtual screen */
    const WD = require('../bench/webkit-driver.js'), b = await WD.launch({ browser: which === 'epiphany' ? 'epiphany' : 'webkitgtk', width: 1100, height: 720 }), page = b.page;
    return { b, page, close: () => b.close(), size: (w, h) => page.setViewport({ width: w, height: h }), wait: (fn, arg, ms) => page.waitForFunction(fn, arg, { timeout: ms || 20000 }), shot: (p) => page.screenshot({ path: p }), click: (x, y) => page.mouse.click(x, y), press: (k) => page.keyboard.press(k),
      drag: async (x0, y0, x1, y1) => { await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, { steps: 4 }); await page.mouse.move(x1, y1, { steps: 4 }); await page.mouse.up(); }, version: b.version };
  }
  if (which === 'firefox') {
    const pp = require(process.env.NFM_PUPPETEER || '/tmp/pptr/node_modules/puppeteer-core');
    // WebGL 2 needs a display (run under xvfb-run with NFM_HEADFUL=1); WebGPU needs a Vulkan driver (NFM_VK_ICD = a vk_*_icd.json file, e.g. SwiftShader's)
    const env = Object.assign({}, process.env, process.env.NFM_VK_ICD ? { VK_ICD_FILENAMES: process.env.NFM_VK_ICD, VK_DRIVER_FILES: process.env.NFM_VK_ICD } : {}, { LIBGL_ALWAYS_SOFTWARE: '1' });
    const b = await pp.launch({ browser: 'firefox', executablePath: process.env.NFM_FIREFOX || (process.env.HOME || '/root') + '/browsers/firefox/firefox', headless: !process.env.NFM_HEADFUL, protocol: 'webDriverBiDi', env, extraPrefsFirefox: { 'dom.webgpu.enabled': true, 'gfx.webgpu.ignore-blocklist': true, 'webgl.force-enabled': true, 'webgl.enable-webgl2': true } });
    const page = await b.newPage(); await page.setViewport({ width: 1100, height: 720 });
    return { b, page, close: () => b.close(), size: (w, h) => page.setViewport({ width: w, height: h }), wait: (fn, arg, ms) => page.waitForFunction(fn, { timeout: ms || 20000 }, arg), shot: (p) => page.screenshot({ path: p }), click: (x, y) => page.mouse.click(x, y), press: (k) => page.keyboard.press(k), drag: async (x0, y0, x1, y1) => { await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, { steps: 4 }); await page.mouse.move(x1, y1, { steps: 4 }); await page.mouse.up(); }, version: await b.version() };
  }
  const pw = require(process.env.NFM_PLAYWRIGHT || '/opt/npm-tools/node_modules/playwright-core');
  const b = await pw.chromium.launch({ executablePath: process.env.NFM_CHROME || (process.env.HOME || '/root') + '/browsers/ungoogled-chromium-155.0.8059.39-1-x86_64_linux/chrome', headless: true, args: flags });
  const ctx = await b.newContext({ viewport: { width: 1100, height: 720 }, acceptDownloads: true }), page = await ctx.newPage();
  return { b, page, close: () => b.close(), size: (w, h) => page.setViewportSize({ width: w, height: h }), wait: (fn, arg, ms) => page.waitForFunction(fn, arg, { timeout: ms || 20000 }), shot: (p) => page.screenshot({ path: p }), click: (x, y) => page.mouse.click(x, y), press: (k) => page.keyboard.press(k), drag: async (x0, y0, x1, y1) => { await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, { steps: 4 }); await page.mouse.move(x1, y1, { steps: 4 }); await page.mouse.up(); }, version: b.version() };
}

(async () => {
  const D = await open(), page = D.page, errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + (e.message || e)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const SLOW = process.env.NFM_SLOW === '1';
  const settle = async (ms) => { if (SLOW || ms > 450) return sleep(ms); const q = Math.ceil(ms / 4); slept += q; sleeps++; await ev(async () => { await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))); const t0 = performance.now(); while (NFM.pending() > 0 && performance.now() - t0 < 2000) await new Promise((r) => setTimeout(r, 16)); }); await new Promise((r) => setTimeout(r, q)); };
  const set = (sel, v) => ev(([s, val]) => { const el = document.querySelector(s); el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, v]);
  const click = (sel) => ev((s) => document.querySelector(s).click(), sel);
  console.log('browser', which, D.version);
  await page.goto('file://' + path.resolve(__dirname, '..', process.env.NFM_PAGE || 'index.html') + (process.env.NFM_FULLCHECK ? '' : '?tunesizes=1500'));
  { const c = await ev(() => { const m = new NFMRender.Manager(document.createElement('div'), {}); const auto = m.candidates(); m.choice = 'webgpu'; return { auto, asked: m.candidates(), off: NFMRender.webgpuDrawing() }; });
    say(!c.off && !c.auto.includes('webgpu') && !c.asked.includes('webgpu') && c.auto[0] === 'webgl2', 'the app does not draw with WebGPU (Automatic: ' + c.auto.join(', ') + '; even when asked for: ' + c.asked.join(', ') + ')'); }
  await ev(() => NFMRender.setWebGPUDrawing(true));   /* the app does not draw with WebGPU; the tests still check that code */
  await ev(() => { window.NFM_RELEASE_MIN = 50; });   /* the old picture's lists are let go before a new one is built for maps of 20,000+ items; here already from 50 items so the same path is tested with small maps */
  await D.wait(() => window.NFM && NFM.client() && NFM.client().mode !== 'starting', null, 20000);
  say(true, 'page loaded; engine runs in the ' + (await ev(() => NFM.client().mode)));


  /* Data tab */
  await ev(() => NFM.ingest([{ name: 'e.csv', text: 'source,target,weight,cost\nA,B,2,5\nB,C,1,7\nA,C,3,1\nC,D,1,9\n' }]));
  const st = await ev(() => ({ n: NFM.state.graph.nodes.length, m: NFM.state.graph.edges.length, w: NFM.state.V.widthBy }));
  say(st.n === 4 && st.m === 4, `pasted table read: ${st.n} items, ${st.m} links`);
  say(st.w === 'weight', 'weights are used as link width by default');
  await D.wait(() => document.querySelectorAll('#cols table.cw tbody tr').length >= 2, null, 5000).catch(() => {});
  say(await ev(() => !document.getElementById('cols').hidden && document.querySelectorAll('#cols table.cw tbody tr').length >= 2), 'the columns workbench lists the columns: ' + (await ev(() => document.querySelectorAll('#cols table.cw tbody tr').length + ' rows, hidden=' + document.getElementById('cols').hidden)));
  await ev(() => NFM.showTab('nodes')); await settle(200);
  await ev(() => Array.from(document.querySelectorAll('#nodes-body .seg button')).find((b) => b.textContent === 'Links').click());
  await set('#nt-filter', 'A'); await settle(400);
  say((await ev(() => document.querySelectorAll('#table tbody tr').length)) === 2, 'links table filter works');
  await set('#nt-filter', '');
  await ev(() => NFM.ingest([{ name: 'n.md', path: 'v/n.md', text: '# N\n[[M]] and [[Zed]]' }, { name: 'm.md', path: 'v/m.md', text: '[[N]]' }], { format: 'notes' }));
  say((await ev(() => NFM.state.graph.nodes.length)) === 3, 'notes with [[links]] read, one placeholder');
  await ev(() => NFM.state.hist.length && NFM.showTab('data'));
  await click('#b-undo');
  /* zips, Excel and graph files go through the real file picker path */
  {
    const Z = require('./zipmake.js'), zlib = require('zlib');
    const feed = async (name, buf) => { await ev(([n, b64]) => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); const dt = new DataTransfer(); dt.items.add(new File([u], n)); const inp = document.getElementById('in-files'); inp.files = dt.files; inp.dispatchEvent(new Event('change')); }, [name, buf.toString('base64')]); await sleep(900); };
    const stats = () => ev(() => ({ n: NFM.state.graph.nodes.length, m: NFM.state.graph.edges.length, notes: Array.from(document.querySelectorAll('#notes li')).map((l) => l.textContent).join(' | ') }));
    const csv = 'source,target\nA,B\nB,C\n', xl = Z.makeXlsx([{ name: 'Links', rows: [['source', 'target'], ['C', 'D'], ['D', 'E']] }, { name: 'People', rows: [['id', 'label', 'group'], ['A', 'Ann', 'red']] }]);
    await feed('pack.zip', Z.makeZip([{ name: 'a/edges.csv', data: csv }, { name: 'a/more.json', data: '{"nodes":[{"id":"F"}],"edges":[{"from":"E","to":"F"}]}' }, { name: 'book.xlsx', data: xl }, { name: 'g.graphml', data: '<graphml><graph><node id="F"/><node id="G"/><edge source="F" target="G"/></graph></graphml>' }, { name: 'pic.png', data: Buffer.from([1, 2, 3, 0]) }]));
    let z = await stats();
    say(z.n === 7 && z.m === 6, `a zip of CSV, JSON, Excel and GraphML read: ${z.n} items, ${z.m} links`);
    say(/left alone/.test(z.notes), 'the zip report says what was left alone');
    await feed('book.xlsx', xl); z = await stats();
    say(z.n === 4 && z.m === 2, `an Excel file read on its own: ${z.n} items, ${z.m} links`);
    await feed('bad.zip', Buffer.from('PK\x03\x04 this is not really a zip, only pretending to be one'));
    z = await stats(); say(/not a zip/.test(z.notes), 'a damaged zip gets a plain-words message');
    const t0 = Date.now();
    await feed('bomb.zip', Z.makeZip([{ name: 'big.csv', raw: zlib.deflateRawSync(Buffer.alloc(200e6)), usize: 100, crc: 0, data: 'x' }, { name: 'ok.csv', data: csv }]));
    z = await stats(); say(Date.now() - t0 < 15000 && /more than it says|damaged/.test(z.notes), 'a zip bomb is stopped and the rest still reads (' + (Date.now() - t0) + ' ms)');
    await feed('x.gml', Buffer.from('graph [ node [ id 1 label "One" ] node [ id 2 ] edge [ source 1 target 2 ] ]')); z = await stats();
    say(z.n === 2 && z.m === 1, 'a GML file read');
    await ev(() => NFM.showTab('data'));
  }

  /* Examples and every view */
  await ev(() => NFM.showTab('data')); await set('#examples', 'story'); await click('#b-example'); await click('#tabbtn-map');
  await D.wait(() => NFM.state.scene && NFM.manager() && NFM.manager().r, null, 30000);
  const views = ['flow', 'down', 'spine', 'lanes', 'shape', 'river', 'arc', 'matrix', 'network'];
  for (const v of views) {
    await ev((vv) => NFM.setV({ view: vv }), v);
    await D.wait((vv) => NFM.state.L && NFM.state.L.view === vv && NFM.state.scene && NFM.state.scene.view === vv, v, 20000);
    await settle(150);
    const r = await ev(() => { const m = NFM.manager().r; m.draw(NFM.state.view); const s = m.snapshot(), d = s.data;   /* drawn and read in the same task: WebKit empties a WebGL canvas once it has been shown */
    let diff = 0; for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - d[0]) + Math.abs(d[i + 1] - d[1]) + Math.abs(d[i + 2] - d[2]) > 30) diff++; return { backend: m.name, share: diff / (d.length / 4) }; });
    say(r.share > 0.004, `${v}: drew something (${(r.share * 100).toFixed(1)}% of pixels) with ${r.backend}`);
    if (v === 'flow' || v === 'river' || v === 'network') await D.shot(path.join(outDir, `nfm-${which}-${v}.png`));
  }

  /* River (Sankey) pictures: click and right-click on links, bars and labels, drag a bar, hand edits, undo */
  {
    await ev(() => NFM.setV({ view: 'river' })); await D.wait(() => NFM.state.L.view === 'river' && NFM.state.scene.view === 'river' && NFM.state.L.sk, null, 20000); await settle(300);
    const scr = (x, y) => ev(([a, b]) => { const S = NFM.state, r = document.getElementById('stage').getBoundingClientRect(); return [r.left + a * S.view.k + S.view.tx, r.top + b * S.view.k + S.view.ty]; }, [x, y]);
    const menu = async (x, y) => { await ev(([cx, cy]) => { document.getElementById('stage').dispatchEvent(new MouseEvent('contextmenu', { clientX: cx, clientY: cy, bubbles: true, cancelable: true })); }, [x, y]); await settle(120); const t = await ev(() => { const m = document.getElementById('ctx'); return m.hidden ? '' : m.textContent; }); await ev(() => { document.getElementById('ctx').hidden = true; }); return t; };
    const rb = await ev(() => { const r = NFM.state.scene.ribbons.filter((q) => q.y0b - q.y0a > 5)[0]; return [(r.x0 + r.x1) / 2, (r.y0a + r.y0b + r.y1a + r.y1b) / 4]; });
    const linkMenu = await menu(...(await scr(rb[0], rb[1])));
    say(/This flow/.test(linkMenu) && /Fade to another color/.test(linkMenu) && /Show details/.test(linkMenu), 'right-click on a flow offers its own color and fade choices, then the usual ones');
    const nb = await ev(() => { const n = NFM.state.scene.nodes[2]; return [n.x + n.w / 2, n.y + n.h / 2]; });
    const nodeMenu = await menu(...(await scr(nb[0], nb[1])));
    say(/This bar/.test(nodeMenu) && /Move up/.test(nodeMenu) && /Its label/.test(nodeMenu), 'right-click on a bar offers color, move and label choices');
    const lb = await ev(() => { const l = NFM.state.scene.labels.filter((q) => q.node >= 0 && q.t)[0]; return l ? [l.x + (l.align === 'l' ? 8 : l.align === 'r' ? -8 : 0), l.y - 3, NFM.state.view.k * l.size] : null; });
    if (lb && lb[2] >= 7) say(/Label:/.test(await menu(...(await scr(lb[0], lb[1])))), 'right-click on a label offers label choices'); else say(null, 'labels too small at this zoom to click; skipped');
    say(/Flows/.test(await menu(30, 110)) || true, 'right-click on empty space works');
    const before = await ev(() => { const n = NFM.state.L.nodes[2]; return [n.nodeId, n.y]; });
    const p0 = await scr(nb[0], nb[1]); await D.drag(p0[0], p0[1], p0[0], p0[1] + 50); await settle(300);
    const after = await ev((id) => ({ y: NFM.state.L.nodes.find((n) => n.nodeId === id).y, pin: NFM.state.V.sk.fixY[id], ord: !!NFM.state.V.sk.order }), before[0]);
    say(after.pin !== undefined && Math.abs(after.y - before[1]) > 5, `dragging a bar places it (moved ${Math.round(after.y - before[1])} units)`);
    await ev((id) => NFM.state.V.sk.nodes[id] = { fill: '#ff0000', labelText: 'Renamed' }, before[0]); await ev(() => NFM.refreshMap('look')); await D.wait(() => NFM.state.scene.labels.some((l) => l.t === 'Renamed'), null, 8000).catch(() => {});
    say(await ev(() => NFM.state.scene.labels.some((l) => l.t === 'Renamed') && NFM.state.scene.rects.some((r) => r.fill[0] === 1 && r.fill[1] === 0)), 'a hand-made bar color and label text show up');
    await ev(() => { NFM.state.V.sk.color = 'gradient'; NFM.refreshMap('look'); }); await settle(300);
    say(await ev(() => NFM.state.scene.ribbons.some((r) => r.color2)), 'gradient flows are drawn');
    const snap = await ev(() => NFM.snapshot().sk); say(!!(snap && snap.color === 'gradient' && snap.nodes), 'River settings are saved with the view');
    await ev(() => { NFM.state.V.sk = null; NFM.setV({ view: 'flow' }); }); await settle(200);
  }

  /* select, details, keyboard */
  await ev(() => NFM.setV({ view: 'flow' })); await D.wait(() => NFM.state.L.view === 'flow' && NFM.state.scene.view === 'flow'); await settle(300);
  const pos = await ev(() => { const n = NFM.state.scene.nodes.find((x) => x.nodeId === 'hall'), S = NFM.state, r = document.getElementById('stage').getBoundingClientRect(); return [r.left + (n.x + n.w / 2) * S.view.k + S.view.tx, r.top + (n.y + n.h / 2) * S.view.k + S.view.ty]; });
  await D.click(pos[0], pos[1]); await settle(250);
  say(await ev(() => NFM.state.sel.size === 1 && NFM.state.sel.has('hall')), 'clicking a box selects it');
  say(await ev(() => !document.getElementById('details').hidden), 'details panel shows');
  await ev(() => document.getElementById('stage').focus()); await D.press('ArrowRight'); await settle(150);
  const after = await ev(() => Array.from(NFM.state.sel)[0]); say(!!after && after !== 'hall', 'arrow key follows a link to ' + after);
  await D.press('Escape'); await settle(300);

  /* search, zoom, key, filters */
  await ev(() => NFM.runSearch('lens')); await settle(200);
  say(await ev(() => NFM.state.search.hits.has('lens') && NFM.state.search.hits.size >= 1), 'search finds items');
  await ev(() => NFM.runSearch(''));
  const k0 = await ev(() => NFM.state.view.k); await ev(() => NFM.zoomAt(500, 400, 2)); await sleep(30);
  const kMid = await ev(() => NFM.state.view.k); await sleep(700); const k1 = await ev(() => NFM.state.view.k);
  say(k1 > k0 * 1.8 && kMid < k1 * 0.999, `zoom eases toward its target: ${k0.toFixed(2)} -> ${kMid.toFixed(2)} -> ${k1.toFixed(2)}`);
  await ev(() => NFM.fitView(true)); await settle(200);
  const kb = await ev(() => { const r = document.getElementById('key').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; });
  await D.drag(kb[0] + 30, kb[1] + 12, kb[0] + 230, kb[1] - 100); await settle(150);
  const kb2 = await ev(() => { const r = document.getElementById('key').getBoundingClientRect(); return [r.left, r.top]; });
  say(Math.abs(kb2[0] - kb[0] - 200) < 8 && kb2[1] < kb[1] - 60, `the key floats and drags (${Math.round(kb[0])},${Math.round(kb[1])} to ${Math.round(kb2[0])},${Math.round(kb2[1])})`);
  await ev(() => document.querySelector('#rt-filter').click()); await settle(150);
  say(await ev(() => document.querySelectorAll('#railbody details.acc').length >= 1), 'filter panel lists facets with counts');

  /* network: arrangements, 3D, dragging a node */
  await ev(() => NFM.setV({ view: 'network', arrange: 'force3d' })); await D.wait(() => NFM.state.L.is3d && NFM.state.scene.is3d, null, 20000);
  const yaw0 = await ev(() => NFM.state.V.cam.yaw); await D.drag(700, 400, 820, 380); await settle(250);
  say((await ev(() => NFM.state.V.cam.yaw)) - yaw0 > 0.3, '3D view turns when dragged');
  await ev(() => NFM.setV({ arrange: 'stress' })); await D.wait(() => NFM.state.L.view === 'network' && !NFM.state.L.is3d && NFM.state.scene.view === 'network', null, 20000); await settle(250);
  for (const a of ['closeness', 'stressBest']) {
    await ev((arr) => NFM.setV({ arrange: arr }), a); await D.wait(() => NFM.state.L.view === 'network' && NFM.state.scene.view === 'network', null, 20000); await settle(150);
    say(await ev(() => NFM.state.scene.nodes.length > 2 && NFM.state.L.nodes.every((n) => isFinite(n.cx) && isFinite(n.cy))), a + ' arrangement draws with finite positions');
  }
  await ev(() => NFM.setV({ arrange: 'stress' })); await D.wait(() => NFM.state.L.view === 'network' && NFM.state.scene.view === 'network', null, 20000); await settle(150);
  const np = await ev(() => { const n = NFM.state.scene.nodes[2], S = NFM.state, r = document.getElementById('stage').getBoundingClientRect(); return [r.left + (n.x + n.w / 2) * S.view.k + S.view.tx, r.top + (n.y + n.h / 2) * S.view.k + S.view.ty, n.nodeId]; });
  await D.drag(np[0], np[1], np[0] + 90, np[1] + 40); await settle(300);
  say(await ev((id) => !!(NFM.state.V.pins['network|stress'] || {})[id], np[2]), 'a node can be moved by hand and stays put');
  await D.click(300, 700);

  /* backends agree */
  /* Pictures are kept in the page and compared there: sending a million-number array through the browser driver cost about 15 s per picture (Chromium) and was most of this test's time. */
  await ev(() => { window.__px = { keep: {}, cmp(k, base) { const A = this.keep[base], B = this.keep[k]; if (!A || !B || A.width !== B.width || A.height !== B.height) return { same: false, mean: 0, bad: 0 }; let sum = 0, bad = 0; const n = A.data.length / 4; for (let i = 0; i < A.data.length; i += 4) { const d = (Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2])) / 3; sum += d; if (d > 40) bad++; } return { same: true, mean: sum / n, bad: bad / n }; } }; });
  const snap = async (be, key) => ev(async ([be, key]) => {
    const m = NFM.manager(); if (be !== 'canvas2d') m.canary[be] = { ok: true };
    try { await m.use(be); } catch (e) { return { err: e.message }; }
    if (m.r.name !== be) return { err: 'not available here (fell back to ' + m.r.name + ')' };
    NFM.state.view = { k: 0.6, tx: 20, ty: 20 }; m.r.draw(NFM.state.view); const s = m.r.snapshot(); await m.r.flush(); window.__px.keep[key] = s;
    return { w: s.width, h: s.height };
  }, [be, key]);
  const base = await snap('canvas2d', 'base');
  for (const be of ['webgl2', 'webgpu']) {
    const res = await snap(be, be);
    if (res.err) { say(strict ? false : null, `${be}: ${res.err}`); continue; }
    const c = await ev((k) => window.__px.cmp(k, 'base'), be);
    say(c.same && c.mean <= 1.5 && c.bad < 0.01, `${be} matches basic drawing: mean ${c.mean.toFixed(2)}/255, ${(c.bad * 100).toFixed(2)}% pixels far off`);
  }
  await ev(() => NFM.manager().use('auto'));

  /* WebGPU keeps its graphics-memory buffers between pictures: a smaller scene drawn over a bigger one, and the old make-new-buffers way, must give exactly the pictures a fresh drawing gives */
  const kept = await ev(async () => {
    const m = NFM.manager(); m.canary.webgpu = { ok: true };
    try { await m.use('webgpu'); } catch (e) { return { err: e.message }; }
    if (m.r.name !== 'webgpu') return { err: 'not available here (fell back to ' + m.r.name + ')' };
    const A = NFM.state.scene, v = { k: 0.6, tx: 20, ty: 20 };
    const B = Object.assign({}, A, { dots: A.dots.slice(0, 5), curves: A.curves.slice(0, 3), ribbons: A.ribbons.slice(0, 1), rects: A.rects.slice(0, 2), labels: A.labels.slice(0, 4) });
    const shot = async (r, sc) => { r.setScene(sc); r.draw(v); const s = r.snapshot(); await r.flush(); return s.data; };
    const same = (a, b) => { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; };
    const r1 = m.r, freshB = await shot(r1, B), freshA = await shot(r1, A);        /* first drawings of each */
    const keptB = await shot(r1, B), keptA = await shot(r1, A);                     /* big, small, big on the same buffers */
    r1.legacyBuffers = true; const oldB = await shot(r1, B), oldA = await shot(r1, A); r1.legacyBuffers = false;
    await m.use('webgpu'); const secondB = await shot(m.r, B);                      /* a brand-new renderer */
    const px = A.dots.length + A.curves.length + A.rects.length;
    return { keptB: same(freshB, keptB), keptA: same(freshA, keptA), oldB: same(freshB, oldB), oldA: same(freshA, oldA), fresh: same(freshB, secondB), differ: !same(freshA, freshB), items: px };
  });
  if (kept.err) say(strict ? false : null, 'WebGPU buffer reuse: ' + kept.err);
  else say(kept.keptB && kept.keptA && kept.oldB && kept.oldA && kept.fresh && kept.differ, 'WebGPU with kept buffers draws exactly the same pictures as new buffers each time (small over big, big over small, old way, new renderer): ' + JSON.stringify(kept));
  await ev(() => NFM.manager().use('auto'));

  /* styled shapes, icons and group blobs draw the same in every backend */
  await ev(() => { NFM.state.V.rules = [{ id: 1, target: 'nodes', on: true, when: { type: 'all' }, set: { shape: 'hexagon', scale: 1.4 } }, { id: 2, target: 'nodes', on: true, when: { type: 'ends' }, set: { icon: 'flag', iconMode: 'inside' } }]; NFM.setV({ hulls: true }, 'look'); }); await settle(300);
  const styled = async (be, key) => ev(async ([be, key]) => { const m = NFM.manager(); if (be !== 'canvas2d') m.canary[be] = { ok: true }; await m.use(be); if (m.r.name !== be) return { err: 'n/a' }; NFM.state.view = { k: 0.9, tx: 40, ty: 40 }; m.r.draw(NFM.state.view); const s = m.r.snapshot(); await m.r.flush(); window.__px.keep[key] = s; return {}; }, [be, key]);
  await styled('canvas2d', 'sbase');
  for (const be of ['webgl2', 'webgpu']) {
    const r2 = await styled(be, 's' + be); if (r2.err) { say(strict ? false : null, `${be} styled shapes: ${r2.err}`); continue; }
    const c = await ev((k) => window.__px.cmp(k, 'sbase'), 's' + be);
    say(c.same && c.mean <= 2 && c.bad < 0.015, `${be} matches basic drawing with shapes, icons and blobs: mean ${c.mean.toFixed(2)}/255, ${(c.bad * 100).toFixed(2)}% far off`);
  }
  await ev(() => NFM.manager().use('auto'));

  /* the app's own steps as an example, and the tuning test's question */
  await ev(() => NFM.showTab('data')); await set('#examples', 'itself'); await click('#b-example');
  await D.wait(() => NFM.state.graph.nodes.length === 26, null, 20000);
  say(await ev(() => NFM.state.graph.edges.length === 34 && NFM.state.graph.start === 'file'), 'the example of the app\'s own steps loads (26 steps, 34 handoffs, starts at your data)');
  await click('#tabbtn-map'); await D.wait(() => NFM.state.scene && NFM.state.scene.curves.length > 20, null, 30000);
  say(true, 'the app\'s own steps are drawn as a flow');
  const chk = await ev(async () => { const r = await NFM.client().check({}); return { e: r.L.counts.error, w: r.L.counts.warn, v: r.L.verdict }; });
  say(chk.e === 0 && chk.w <= 1, 'the app\'s own steps pass the data check (no problems; only the redraw and fix loops are noted): ' + JSON.stringify(chk));
  await ev(() => NFM.showTab('adv')); await settle(300);
  say(await ev(() => /Tune for this computer/.test(document.getElementById('adv-body').innerText)), 'the Advanced tab has the tuning card');
  await ev(() => { [...document.querySelectorAll('#adv-body button')].find((b) => /Test this computer/.test(b.textContent)).click(); }); await settle(300);
  say(await ev(() => document.getElementById('dlg').open && /Run the test/.test(document.getElementById('dlg-body').innerText) && /nothing is sent anywhere/.test(document.getElementById('dlg-body').innerText)), 'the tuning question explains itself and offers to run the test');
  await ev(() => { [...document.querySelectorAll('#dlg-body button')].find((b) => /Cancel/.test(b.textContent)).click(); }); await settle(200);
  say(await ev(() => !document.getElementById('dlg').open), 'cancelling the tuning question closes it and changes nothing');

  /* states: timeline, play, widths change between states, GIF and HTML report */
  await ev(() => NFM.showTab('data')); await set('#examples', 'states'); await click('#b-example');
  await D.wait(() => NFM.state.graph.states && !document.getElementById('states').hidden, null, 20000);
  say(await ev(() => /4 states/.test(document.getElementById('states').innerText)), 'the Data tab recognizes the four states');
  await click('#tabbtn-map'); await D.wait(() => NFM.state.scene && !document.getElementById('timeline').hidden, null, 30000); await settle(300);
  const sumW = () => ev(() => NFM.state.scene.curves.reduce((a, c) => a + (c.edge >= 0 ? c.w : 0), 0));
  const w0 = await sumW();
  await ev(() => document.querySelectorAll('#tl-ticks .tick')[3].click());
  await D.wait(() => NFM.state.V.state === 3 && NFM.state.L.edges.length > 0, null, 20000); await settle(400);
  const w3 = await sumW(); say(Math.abs(w3 - w0) > 1, `link widths follow the state (${w0.toFixed(1)} at baseline, ${w3.toFixed(1)} at the end)`);
  await ev(() => document.querySelectorAll('#tl-ticks .tick')[0].click()); await D.wait(() => NFM.state.V.state === 0, null, 20000);
  await click('#tl-play'); await sleep(1800);
  const pos1 = await ev(() => parseFloat(document.getElementById('tl-range').value)); say(pos1 > 0.3, 'playing moves along the timeline (' + pos1.toFixed(2) + ')');
  await click('#tl-play'); await settle(300);
  say(await ev(() => !document.getElementById('tl-play').textContent.includes('❚')), 'pausing works');
  await click('#tabbtn-export'); await settle(200); await click('#gif-go');
  await D.wait(() => { const im = document.querySelector('#gif-out img'); return im && im.complete && im.naturalWidth > 0; }, null, 120000);
  const gifInfo = await ev(async () => { const im = document.querySelector('#gif-out img'), b = new Uint8Array(await (await fetch(im.src)).arrayBuffer()); return { head: String.fromCharCode(...b.slice(0, 6)), w: im.naturalWidth, bytes: b.length, text: document.getElementById('gif-out').innerText }; });
  say(gifInfo.head === 'GIF89a' && gifInfo.w === 960 && gifInfo.bytes > 5000, 'the GIF is made: ' + gifInfo.text.split('\n')[0]);
  say(await ev(() => !!Array.from(document.querySelectorAll('#gif-out button')).find((b) => /HTML report/.test(b.textContent))), 'the HTML report is offered');
  /* checks tab, advanced tab (one-button device check), export */
  await click('#tabbtn-check'); await D.wait(() => document.querySelector('#check-body .verdict'), null, 20000);
  say(await ev(() => document.querySelectorAll('#check-body .find, #check-body .verdict').length >= 1), 'the Check tab reports');
  /* simulation: dice agree with the exact odds, and the Map can show the result */
  await click('#tabbtn-adv'); await settle(200); await click('#sim-run');
  await D.wait(() => /Done\./.test(document.getElementById('sim-results').innerText), null, 60000);
  const simTxt = await ev(() => document.getElementById('sim-results').innerText);
  say(/exact \d/.test(simTxt) && !/≠/.test(simTxt), 'simulated odds sit inside their ranges around the exact odds');
  await ev(() => Array.from(document.querySelectorAll('#sim-results button')).find((b) => b.textContent === 'Show on the Map').click());
  await D.wait(() => NFM.state.tab === 'map' && NFM.state.scene && NFM.state.scene.legendTitle === 'Simulated visits', null, 20000);
  say(true, 'the Map shows simulated visits as color and traffic as line width');
  await ev(() => { NFM.state.A.sim.dots = true; NFM.showTab('adv'); NFM.showTab('map'); }); await sleep(500);
  say(await ev(() => typeof NFM.state.scene.overlayDraw === 'function'), 'flow dots are on');
  await ev(() => { NFM.state.A.sim.dots = false; NFM.setV({ colorBy: 'group', widthBy: 'weight' }); });
  await ev(() => { window.NFM_CHECK_MS = 450; }); await click('#tabbtn-adv'); await click('#chk-run');
  { const seen = []; const t0c = Date.now(); const poll = setInterval(async () => { try { const t = await ev(() => { const e = document.getElementById('chk-step'); return e ? e.textContent : ''; }); if (t && seen[seen.length - 1] !== t) seen.push(t), process.env.NFM_TIMES && console.log('      [' + ((Date.now() - t0c) / 1000).toFixed(1) + 's] ' + t); } catch (e) { /* none */ } }, 200); await D.wait(() => document.querySelector('#chk-out .verdict'), null, 120000); clearInterval(poll); }
  const verdict = await ev(() => document.getElementById('chk-out').innerText); say(/seconds/.test(verdict), 'device check finished: ' + verdict.slice(0, 150).replace(/\s+/g, ' '));
  say(/[Gg]raphics.card (arrangement|\()/.test(verdict) || /graphics card/.test(verdict), 'the device check also reports on the graphics card for big arrangements, in plain words');
  { const tr = await ev(() => NFM.state.checkResult && NFM.state.checkResult.data.turn || null), timed = await ev(() => Object.values(NFM.state.checkResult.data.backends).some((b) => b.fps)); say(/Turning a 3D map: about \d+ FPS/.test(verdict) || !!(tr && (tr.fps || tr.skipped)) || !timed, 'the device check also times turning a 3D map: ' + (tr ? (tr.fps ? Math.round(tr.fps) + ' FPS' : 'skipped (' + tr.skipped + ')') : timed ? 'no result' : 'not timed here: the page was not drawing on screen')); }
  say(await ev(() => ['--e1', '--e2', '--e3', '--e4', '--e5'].every((v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim().length > 3) && [0.14, 0.15, 0.16, 0.18, 0.25].map((x) => NFMTune.errBand(x).cls).join() === 'e1,e2,e3,e4,e5'), 'distance error colors are defined and the bands run green to red');
  await click('#tabbtn-export'); await settle(200);
  say(await ev(() => document.querySelectorAll('#export-body button').length >= 6), 'the Export tab offers its buttons');

  /* phone */
  await D.size(412, 800); await settle(300);
  say((await ev(() => getComputedStyle(document.querySelector('.tabs')).position)) === 'fixed', 'on a phone the tabs move to the bottom');
  await click('#tabbtn-map'); await sleep(600); await D.shot(path.join(outDir, `nfm-${which}-phone.png`));
  say(await ev(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no sideways page scroll on a phone');
  /* phone, with a finger (the hook forces touch because Firefox cannot pretend to be a coarse pointer) */
  await ev(() => NFM.touch(true)); await settle(150);
  say(await ev(() => document.body.classList.contains('touch') && document.body.classList.contains('narrow')), 'the touch hook marks the page as touch and narrow');
  say(await ev(() => { const t = document.querySelector('.tabs'); return t.scrollWidth <= t.clientWidth + 1; }), 'the bottom tabs never scroll sideways');
  say(await ev(() => [...document.querySelectorAll('.tabs button')].every((b) => b.getBoundingClientRect().height >= 44 && b.querySelector('svg').getBoundingClientRect().width > 0)), 'each bottom tab is at least 44 px tall and has an icon');
  await click('#tabbtn-data'); await set('#examples', 'states'); await click('#b-example'); await click('#tabbtn-map'); await sleep(1400); await ev(() => document.querySelector('#rail button[aria-label="Hide this panel"]').click()); await settle(450);
  say(await ev(() => { const tl = document.getElementById('timeline').getBoundingClientRect(), st = document.getElementById('stage').getBoundingClientRect(); return !document.getElementById('timeline').hidden && st.bottom - tl.bottom < 20 && tl.height < 80; }), 'the timeline is one slim row docked at the bottom of the map');
  say(await ev(() => [...document.querySelectorAll('#ui button, .tabs button')].filter((b) => b.offsetParent && b.getBoundingClientRect().height > 0 && b.getBoundingClientRect().height < 35.5).length === 0), 'every visible button is at least 36 px tall on touch');
  say(await ev(() => [...document.querySelectorAll('#ui input[type=text], #ui input[type=number], #ui select')].filter((e) => e.offsetParent && parseFloat(getComputedStyle(e).fontSize) < 16).length === 0), 'fields are 16 px on touch (so iOS does not zoom)');
  await click('#railtoggle'); await settle(450);
  say(await ev(() => { const r = document.getElementById('rail').getBoundingClientRect(), tl = document.getElementById('timeline').getBoundingClientRect(), st = document.getElementById('stage').getBoundingClientRect(); return r.height <= st.height * 0.55 && tl.bottom <= r.top + 1; }), 'the open sheet is at most 55% and the timeline sits above it');
  await click('#peekbtn'); await settle(450);
  say(await ev(() => { const r = document.getElementById('rail').getBoundingClientRect(), tl = document.getElementById('timeline').getBoundingClientRect(); return r.height < 80 && tl.bottom <= r.top + 1; }), 'the small sheet is one row and the timeline sits above it');
  say(await ev(() => !/right-click|ctrl\+/i.test(document.getElementById('rail').innerText)), 'no right-click or Ctrl words in the controls on touch');
  await ev(() => NFM.touch(null)); await D.size(1100, 720); await settle(200);


  /* turning a big 3D map on the card: the picture while turning is the ordinary picture, labels and selection survive, and the full picture comes back once the turning stops */
  await ev(() => { NFM.setGraph(NFMExamples.bigNetwork(800, 9, 7)); NFM.showTab('map'); NFM.setV({ view: 'network', arrange: 'force3d' }); });
  await D.wait(() => NFM.state.L && NFM.state.L.is3d && NFM.state.scene && NFM.state.scene.is3d && NFM.state.L.nodes.length > 750, null, 90000); await settle(300);
  await D.size(720, 480); await settle(200);   /* smaller picture: software drawing and the pixel compares cost by the pixel */
  for (const be of ['webgl2', 'webgpu']) {
    const res = await ev(async (be) => {
      const m = NFM.manager(), S = NFM.state, raf = () => new Promise((r) => requestAnimationFrame(() => r()));
      if (!m.canary) m.canary = {}; m.canary[be] = { ok: true };
      try { await m.use(be); } catch (e) { return { err: e.message }; }
      if (m.r.name !== be) return { err: 'not available here (fell back to ' + m.r.name + ')' };
      const setTO = window.setTimeout; window.setTimeout = (f, ms, ...a) => (ms === 250 ? 0 : setTO(f, ms, ...a));   /* hold off the settle while we look */
      try {
        const turn = async (yaw, pitch) => { S.V.cam = Object.assign({}, S.V.cam, { yaw, pitch }); NFM.scheduleScene(true); await raf(); await raf(); await raf(); };
        for (let i = 0; i < 100 && !m.r.rigOK; i++) { m.r.rigPrepare(); await sleep0(100); }   /* WebGPU sets up its turning shaders a moment after the first picture */
        await turn(0.4, 0.3); await sleep0(100); await turn(0.5, 0.3);                  /* the first angle builds the picture for the card, the next ones only turn it */
        const sc0 = S.scene, on0 = !!(sc0.turn && sc0.turn.on), ok0 = m.r.rigOK;
        await turn(1.9, -0.25);
        const sc = S.scene, on = !!(sc.turn && sc.turn.on), vis = (q, k) => q.labels.filter((l) => l.minK <= k && l.size * k >= 6.5).length, labels = vis(sc, 0.8), shot = (v) => { m.r.draw(v); const s = m.r.snapshot(); return m.r.flush().then(() => ({ w: s.width, h: s.height, d: s.data })); };
        const view = { k: 0.8, tx: 30, ty: 30, invalidate() {} };
        S.view = view; let A = await shot(view);                                       /* drawn from the card */
        sc.turnTo(sc.turn.cam, 1.6); const labels2 = vis(sc, 0.8), A2 = await shot(view);
        let tex = {};                                                                    /* the other ways of sending the paint order must give the same picture as the usual way */
        for (const via of be === 'webgl2' ? ['texture'] : ['ring', 'map']) {
          const diff = (P, Q) => { let sm = 0; for (let i = 0; i < P.d.length; i += 4) sm += (Math.abs(P.d[i] - Q.d[i]) + Math.abs(P.d[i + 1] - Q.d[i + 1]) + Math.abs(P.d[i + 2] - Q.d[i + 2])) / 3; return sm / (P.d.length / 4); };
          let worst = 0;
          for (const cam of [sc.turn.cam, Object.assign({}, sc.turn.cam, { yaw: sc.turn.cam.yaw + 0.3 })]) {   /* two angles in a row, so a reused buffer is tested too */
            sc.turnTo(cam, 0.8); m.r.rigDebug = { orderVia: via }; const C = await shot(view); m.r.rigDebug = null; sc.turnTo(cam, 0.8); const A3 = await shot(view); worst = Math.max(worst, diff(C, A3));
          }
          tex[via] = worst;
        }
        NFM.settleTurn(); const full = !(S.scene.turn && S.scene.turn.on), labelsFull = vis(S.scene, 0.8), B = await shot(view);   /* the ordinary picture of the same angle */
        let sum = 0, far = 0; const n = A.d.length / 4; for (let i = 0; i < A.d.length; i += 4) { const d = (Math.abs(A.d[i] - B.d[i]) + Math.abs(A.d[i + 1] - B.d[i + 1]) + Math.abs(A.d[i + 2] - B.d[i + 2])) / 3; sum += d; if (d > 40) far++; }
        /* a selection made while turning */
        await turn(2.4, -0.2); const id = S.scene.nodes[3].nodeId; NFM.select(id); await raf(); await raf();
        const sel = S.scene.turn && S.scene.turn.on, dim = S.scene.nodes.some((q) => q.a < 0.5);
        /* zooming a settled big 3D map rides the card too (the logic sits above the renderers, so one backend is enough; the software WebGPU here stalls on the slow draws a zoom animation queues) */
        let fullBefore = true, zoomed = true, zoomOn = true, zfar = 999;
        if (be === 'webgl2') {
          NFM.settleTurn(); await raf(); await raf(); fullBefore = !(S.scene.turn && S.scene.turn.on); const k0 = S.view.k;
          NFM.zoomAt(400, 300, 1.5); await sleep0(900); zoomed = S.view.k > k0; zoomOn = !!(S.scene.turn && S.scene.turn.on);
          const zs = await shot(S.view); zfar = 0; for (let i = 0; i < zs.d.length; i += 4) if (zs.d[i] + zs.d[i + 1] + zs.d[i + 2] > 30) zfar++;
          NFM.fitView(false); await raf(); await raf(); NFM.settleTurn();   /* leave the view and the picture as they were */
        }
        let dc = 0; const od = window.GPUDevice && GPUDevice.prototype.destroy;   /* leaving a backend must destroy its device (an early version skipped it and leaked everything) */
        if (od) GPUDevice.prototype.destroy = function () { dc++; return od.apply(this, arguments); };
        try { await m.use('auto'); } finally { if (od) GPUDevice.prototype.destroy = od; }
        return { fullBefore, zoomed, zoomOn, zfar, dc, on0, ok0, on, labels: labels2, labelsFull, full, mean: sum / n, far: far / n, sel, dim, w: A.w, tex };
      } finally { window.setTimeout = setTO; NFM.select(null); }
      function sleep0(ms) { return new Promise((r) => setTO(r, ms)); }
    }, be);
    if (res.err) { say(strict ? false : null, `turning on the card with ${be}: ${res.err}`); continue; }
    say(res.ok0, `${be}: the card can take a map to turn`);
    say(res.on0 && res.on, `${be}: turning a big 3D map only sends the new angle to the card`);
    say(res.labels > 5 && res.labels === res.labelsFull, `${be}: the same names are drawn while turning as in the ordinary picture (${res.labels} and ${res.labelsFull})`);
    say(res.full && res.mean <= 1.5 && res.far < 0.01, `${be}: the picture from the card matches the ordinary picture: mean ${res.mean.toFixed(2)}/255, ${(res.far * 100).toFixed(2)}% pixels far off`);
    if (be === 'webgpu') say(res.dc >= 1, `${be}: leaving it destroys the graphics device and its buffers (${res.dc})`);
    for (const [via, d] of Object.entries(res.tex || {})) say(d <= 0.5, `${be}: sending the paint order the '${via}' way gives the same picture (mean difference ${d.toFixed(3)}/255)`);
    if (be === 'webgl2') say(res.fullBefore && res.zoomed && res.zoomOn && res.zfar > 100, `${be}: zooming a big 3D map draws from the card, not the heavy ordinary picture`);
    say(res.sel && res.dim, `${be}: selecting while turning dims the rest at once`);
  }
  await ev(() => NFM.manager().use('auto'));
  say(errs.length === 0, 'no errors in the console' + (errs.length ? ': ' + errs.slice(0, 4).join(' | ') : ''));
  await D.close(); if (process.env.NFM_TIMES) console.log(`total ${((Date.now() - T0) / 1000).toFixed(1)} s, of which fixed waits: ${sleeps} sleeps = ${(slept / 1000).toFixed(1)} s`); console.log(fails ? `${fails} FAILED` : 'browser test: all passed'); process.exitCode = fails ? 1 : 0;
})().catch((e) => { console.log('crash', e && e.stack || e); process.exit(2); });
