// Copyright (c) 2026 LFC Foundry. MIT License.
// Netflow Map in Firefox: memory of the whole browser (all its processes) while a 3D network of N items is made and shown.
// Run:  NFM_PUPPETEER=/tmp/pptr/node_modules/puppeteer-core NFM_FIREFOX=/home/claude/browsers/firefox/firefox HOME=/root node bench/memory/page-rss.js 30000
// Line 1 prints the real browser version. One size per run, a fresh browser each time. Numbers: each process's share of memory in MB (proportional set size, so shared libraries are not counted twice) summed over every firefox process (/proc), and the content process alone.
const fs = require('fs'), path = require('path'), pp = require(process.env.NFM_PUPPETEER || 'puppeteer-core');
const N = Number(process.argv[2]) || 30000, FF = process.env.NFM_FIREFOX || '/home/claude/browsers/firefox/firefox', URL = 'file://' + path.resolve(__dirname, '..', '..', 'index.html') + '?tunesizes=1500';
const rss = (pid0) => { const all = {}; for (const d of fs.readdirSync('/proc')) { if (!/^\d+$/.test(d)) continue; try { const st = fs.readFileSync('/proc/' + d + '/status', 'utf8'), name = /Name:\s*(\S+)/.exec(st)[1], ppid = +/PPid:\s*(\d+)/.exec(st)[1], kb = +(/Pss:\s*(\d+)/.exec(fs.readFileSync('/proc/' + d + '/smaps_rollup', 'utf8')) || [0, 0])[1]; all[d] = { name, ppid, kb, cmd: fs.readFileSync('/proc/' + d + '/cmdline', 'utf8') }; } catch (e) { /* gone */ } }
  const mine = (p) => { let x = all[p], n = 0; while (x && n++ < 8) { if (+p === pid0 || x.ppid === pid0) return true; p = x.ppid; x = all[p]; } return false; };
  let tot = 0, content = 0; for (const p in all) if (mine(p) && /firefox|Web Content|Isolated|forkserver/i.test(all[p].name + all[p].cmd)) { tot += all[p].kb; if (/tab/.test(all[p].cmd) && all[p].kb > content) content = all[p].kb; }
  return [Math.round(tot / 1024), Math.round(content / 1024)]; };
(async () => {
  const b = await pp.launch({ browser: 'firefox', executablePath: FF, headless: true, protocol: 'webDriverBiDi', args: [] });
  console.log('browser', await b.version(), ', items', N);
  const pid = b.process().pid, page = await b.newPage(); await page.setViewport({ width: 1100, height: 720 });
  const out = []; const mark = (name, ms) => { const [t, c] = rss(pid); out.push(name.padEnd(44) + String(t).padStart(6) + ' MB' + String(c).padStart(8) + ' MB' + (ms === undefined ? '' : '   ' + (ms / 1000).toFixed(1) + ' s')); };
  await new Promise((r) => setTimeout(r, 800)); mark('empty browser');
  await page.goto(URL); await page.waitForFunction(() => window.NFM && NFM.client() && NFM.client().mode !== 'starting', { timeout: 20000 }); await new Promise((r) => setTimeout(r, 500)); mark('page loaded');
  const t0 = Date.now();
  await page.evaluate((n) => { NFM.setGraph(NFMExamples.bigNetwork(n, 12, 7)); NFM.showTab('map'); NFM.setV({ view: 'network', arrange: 'sphere' }); }, N);
  await page.waitForFunction((n) => NFM.state.L && NFM.state.sceneOk && NFM.state.L.nodes.length > n * 0.98, { timeout: 240000 }, N);
  const tDone = Date.now() - t0; await new Promise((r) => setTimeout(r, 1500)); mark('3D network shown', tDone);
  const info = await page.evaluate(() => ({ is3d: !!NFM.state.L.is3d, rig: !!(NFM.state.scene && NFM.state.scene.rig), items: NFM.state.L.nodes.length, links: NFM.state.L.edges.length }));
  await page.evaluate(() => { NFM.setV({ colorBy: 'size' }); }).catch(() => {}); await new Promise((r) => setTimeout(r, 2500)); mark('after a second picture (color change)');
  console.log(JSON.stringify(info)); console.log('step'.padEnd(44) + ' whole browser  content process\n' + out.join('\n'));
  await b.close();
})();
