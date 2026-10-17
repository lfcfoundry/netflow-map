// Copyright (c) 2026 LFC Foundry. MIT License.
// Netflow Map in Firefox: memory of the whole browser (all its processes) while a 3D network of N items is made and shown.
// Run:  NFM_PUPPETEER=/tmp/pptr/node_modules/puppeteer-core NFM_FIREFOX=/home/claude/browsers/firefox/firefox HOME=/root node bench/memory/page-rss.js 30000
// Line 1 prints the real browser version. One size per run, a fresh browser each time. Numbers: each process's share of memory in MB (proportional set size, so shared libraries are not counted twice) summed over every firefox process (/proc), and the content process alone.
const fs = require('fs'), path = require('path'), pp = require(process.env.NFM_PUPPETEER || 'puppeteer-core');
const N = Number(process.argv[2]) || 30000, FF = process.env.NFM_FIREFOX || '/home/claude/browsers/firefox/firefox', URL = 'file://' + path.resolve(process.env.NFM_PAGE || path.resolve(__dirname, '..', '..', 'index.html')) + '?tunesizes=1500';   /* NFM_PAGE = another copy of the page, to compare two builds */
const rss = (pid0) => { const all = {}; for (const d of fs.readdirSync('/proc')) { if (!/^\d+$/.test(d)) continue; try { const st = fs.readFileSync('/proc/' + d + '/status', 'utf8'), name = /Name:\s*(\S+)/.exec(st)[1], ppid = +/PPid:\s*(\d+)/.exec(st)[1], kb = +(/Pss:\s*(\d+)/.exec(fs.readFileSync('/proc/' + d + '/smaps_rollup', 'utf8')) || [0, 0])[1]; all[d] = { name, ppid, kb, cmd: fs.readFileSync('/proc/' + d + '/cmdline', 'utf8') }; } catch (e) { /* gone */ } }
  const mine = (p) => { let x = all[p], n = 0; while (x && n++ < 8) { if (+p === pid0 || x.ppid === pid0) return true; p = x.ppid; x = all[p]; } return false; };
  let tot = 0, content = 0; for (const p in all) if (mine(p) && /firefox|Web Content|Isolated|forkserver/i.test(all[p].name + all[p].cmd)) { tot += all[p].kb; if (/tab/.test(all[p].cmd) && all[p].kb > content) content = all[p].kb; }
  return [Math.round(tot / 1024), Math.round(content / 1024)]; };
(async () => {
  const b = await pp.launch({ browser: 'firefox', executablePath: FF, headless: !process.env.NFM_HEADFUL, protocol: 'webDriverBiDi', env: Object.assign({}, process.env, { LIBGL_ALWAYS_SOFTWARE: '1' }), extraPrefsFirefox: { 'webgl.force-enabled': true, 'webgl.enable-webgl2': true } });   /* same drawing settings as test/browser.test.js; NFM_HEADFUL=1 under xvfb-run gives WebGL 2, so the card rig is on */
  console.log('browser', await b.version(), ', items', N);
  const pid = b.process().pid, page = await b.newPage(); await page.setViewport({ width: 1100, height: 720 });
  const out = []; const mark = (name, ms) => { const [t, c] = rss(pid); out.push(name.padEnd(44) + String(t).padStart(6) + ' MB' + String(c).padStart(8) + ' MB' + (ms === undefined ? '' : '   ' + (ms / 1000).toFixed(1) + ' s')); };
  await new Promise((r) => setTimeout(r, 800)); mark('empty browser');
  await page.goto(URL); await page.waitForFunction(() => window.NFM && NFM.client() && NFM.client().mode !== 'starting', { timeout: 20000 }); await new Promise((r) => setTimeout(r, 500)); mark('page loaded');
  const be = await page.evaluate(async (n) => {   /* shows the map tab first (that makes the drawing manager), asks for the card (WebGL 2) the way test/browser.test.js does, then sets the 3D network */
    NFM.setGraph(NFMExamples.bigNetwork(50, 3, 7)); NFM.showTab('map'); for (let i = 0; i < 100 && !NFM.manager(); i++) await new Promise((r) => setTimeout(r, 50));
    const m = NFM.manager(); if (!m.canary) m.canary = {}; m.canary.webgl2 = { ok: true }; try { await m.use('webgl2'); } catch (e) { /* stays on the default */ }
    return m.r.name; }, N);
  console.log('drawing with', be);
  const t0 = Date.now();
  await page.evaluate((n) => { NFM.setGraph(NFMExamples.bigNetwork(n, 12, 7)); NFM.setV({ view: 'network', arrange: 'sphere' }); }, N);
  await page.waitForFunction((n) => NFM.state.L && NFM.state.sceneOk && NFM.state.L.nodes.length > n * 0.98, { timeout: 240000 }, N);
  const tDone = Date.now() - t0; await new Promise((r) => setTimeout(r, 1500)); mark('3D network shown', tDone);
  const info = await page.evaluate(() => ({ is3d: !!NFM.state.L.is3d, rig: !!(NFM.state.scene && NFM.state.scene.rig), items: NFM.state.L.nodes.length, links: NFM.state.L.edges.length }));
  await page.evaluate(() => { NFM.setV({ colorBy: 'group' }); }); await page.waitForFunction(() => NFM.state.sceneOk && !NFM.state.mapBusy, null, { timeout: 240000 }); await new Promise((r) => setTimeout(r, 2500)); mark('set-up: switched to plain groups (a full rebuild)');   /* the network starts on found groups, which the engine uses; the measured change below is then a look-only one */
  await page.evaluate(() => { window.__calls = { make: 0 }; const mk = NFMScene.make; NFMScene.make = function () { __calls.make++; return mk.apply(this, arguments); }; });   /* counts how many pictures the color change makes */
  let peakT = 0, peakC = 0; const poll = setInterval(() => { const [t, c] = rss(pid); if (t > peakT) peakT = t; if (c > peakC) peakC = c; }, 60);   /* highest memory seen while the second picture is made (sampled every 60 ms) */
  await page.evaluate(() => { NFM.setV({ colorBy: 'size' }); }).catch(() => {}); await new Promise((r) => setTimeout(r, 2500)); clearInterval(poll); mark('after a second picture (color change)');
  console.log('pictures made by the color change', JSON.stringify(await page.evaluate(() => window.__calls)));
  out.push('highest while the second picture was made'.padEnd(44) + String(peakT).padStart(6) + ' MB' + String(peakC).padStart(8) + ' MB');
  console.log(JSON.stringify(info), 'renderer', await page.evaluate(() => (NFM.state.scene && NFM.state.scene.rig ? 'card rig on (rigOK ' + !!NFM.manager().r.rigOK + ')' : 'no card rig'))); console.log('step'.padEnd(44) + ' whole browser  content process\n' + out.join('\n'));
  await b.close();
})();
