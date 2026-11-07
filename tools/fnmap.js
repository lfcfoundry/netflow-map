/* Copyright (c) 2026 LFC Foundry. MIT License.
 * Builds test/fnmap.json: which blocks of test/browser.test.js run each function of src/ (so `node test/all.js --changed` can pick 1 to 3 blocks
 * for a change inside one function instead of 10 to 20 for a changed file), and docs/BLIND-SPOTS.md: the functions no block runs.
 *
 *   node tools/fnmap.js            (about 3 minutes with 4 blocks at a time; needs NFM_PLAYWRIGHT and NFM_CHROME as the browser test does)
 *
 * How: the readable (unminified) page is built in a temporary copy; every block runs alone in Chromium (NFM_ONLY=<block>) with V8 precise coverage
 * switched on by a wrapper around Playwright; the "gone" run is the page start alone (a function it runs counts for every block, so it never narrows).
 * Chromium only: code that only Firefox or WebKit runs is not seen here (a release still runs every block in every browser).
 * The map belongs to one version of each source file (its git blob id is stored); a changed file with another blob id falls back to the hand map
 * in test/browser-blocks.js until this script runs again. */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..'), TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'nfm-fnmap-'));
const BLOCKS = ['gone', 'linklists', 'data', '1', '2', '3', 'views', 'moves', 'big', 'turn3d', '6', 'pan', '7', '5', 'states', 'colors', 'itself', '8', '4', 'undopack', 'keeper', 'safe', 'engines', '9', 'graphdiff', 'pieces', 'report', 'index'];
const PW = process.env.NFM_PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright';

/* a copy of the tracked files, built readable (no esbuild) */
const files = cp.execSync('git ls-files -z', { cwd: ROOT }).toString().split('\0').filter((f) => f && !/^docs\/|^index\.html$/.test(f));
for (const f of files) { const to = path.join(TMP, f); fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(path.join(ROOT, f), to); }
fs.mkdirSync(path.join(TMP, 'docs', 'play'), { recursive: true });
const env = Object.assign({}, process.env); delete env.NFM_ESBUILD_FROM;
cp.execFileSync('node', ['tools/build.mjs'], { cwd: TMP, env, stdio: 'ignore' });
const page = path.join(TMP, 'index.html');

/* the Playwright wrapper: every page records precise coverage; on browser.close() the functions of the big inline script go to $COV_OUT */
const wrap = path.join(TMP, 'pw-cov.js');
fs.writeFileSync(wrap, `const real = require(${JSON.stringify(PW)}), fs = require('fs');
const chromium = Object.create(real.chromium);
chromium.launch = async (o) => {
  const b = await real.chromium.launch(o), sessions = [], newCtx = b.newContext.bind(b);
  b.newContext = async (...a) => { const c = await newCtx(...a), np = c.newPage.bind(c);
    c.newPage = async () => { const p = await np(), s = await c.newCDPSession(p);
      await s.send('Profiler.enable'); await s.send('Debugger.enable'); await s.send('Profiler.startPreciseCoverage', { callCount: true, detailed: true }); sessions.push(s); return p; }; return c; };
  const close = b.close.bind(b);
  b.close = async () => { try { const out = [];
      for (const s of sessions) { try { const r = (await s.send('Profiler.takePreciseCoverage')).result;
        for (const sc of r) { if (sc.functions.length < 50) continue; const src = (await s.send('Debugger.getScriptSource', { scriptId: sc.scriptId })).scriptSource;
          const m = [], re = /\\/\\* ---- (src\\/[a-z0-9\\/.-]+) ---- \\*\\/\\n/g; let x; while ((x = re.exec(src))) m.push([x[1], x.index, x[0].length]);
          out.push({ len: src.length, markers: m, fns: sc.functions.map((f) => [f.ranges[0].startOffset, f.ranges[0].endOffset, f.ranges[0].count]) }); } } catch (e) { /* skip a page */ } }
      fs.writeFileSync(process.env.COV_OUT, JSON.stringify(out)); } catch (e) { console.error('cov fail', e.message); }
    return close(); };
  return b;
};
module.exports = Object.assign({}, real, { chromium });
`);

const run = (b) => new Promise((ok) => {
  const out = path.join(TMP, 'cov-' + b + '.json'), t0 = Date.now();
  const e = Object.assign({}, process.env, { NFM_PLAYWRIGHT: wrap, NFM_PAGE: page, COV_OUT: out, NFM_ONLY: b === 'gone' ? 'gone' : b });
  cp.execFile('node', [path.join(ROOT, 'test', 'browser.test.js'), 'chromium', TMP], { env: e, maxBuffer: 1 << 26 }, (err, so) => {
    const bad = (String(so).match(/^(?:not ok|FAIL).*$/gm) || []).length;
    console.log((b + '    ').slice(0, 9) + ((Date.now() - t0) / 1000).toFixed(0) + ' s' + (bad ? '  ' + bad + ' failing lines (coverage still taken)' : '')); ok(out);
  });
});
(async () => {
  const q = BLOCKS.slice(); const workers = Array.from({ length: Math.min(4, os.cpus().length) }, async () => { while (q.length) await run(q.shift()); });
  await Promise.all(workers);
  const load = (b) => { const d = JSON.parse(fs.readFileSync(path.join(TMP, 'cov-' + b + '.json'))); return d.sort((x, y) => y.fns.length - x.fns.length)[0]; };
  const base = load('gone'), cov = {}; for (const b of BLOCKS) if (b !== 'gone') cov[b] = load(b);
  const marks = base.markers.slice().sort((a, b) => a[1] - b[1]);
  const fileOf = (off) => { let m = null; for (const x of marks) { if (x[1] <= off) m = x; else break; } return m; };
  const key = (f) => f[0] + ':' + f[1];
  const ran = (c) => { const s = new Set(); for (const f of c.fns) if (f[2] > 0) s.add(key(f)); return s; };
  const atStart = ran(base), per = {}; for (const b of Object.keys(cov)) per[b] = ran(cov[b]);
  const lineOf = (txt, off) => { let n = 1, i = -1; while ((i = txt.indexOf('\n', i + 1)) >= 0 && i < off) n++; return n; };
  const out = {}, blind = {}; let total = 0, none = 0, start = 0;
  const sha = (f) => cp.execSync('git hash-object ' + f, { cwd: ROOT }).toString().trim();
  const texts = {};
  for (const f of base.fns) {
    const len = f[1] - f[0]; if (len > 60000 || len < 40) continue;   /* wrappers (the app and module closures) and one-liners */
    const m = fileOf(f[0]); if (!m) continue; const file = m[0]; const t = texts[file] || (texts[file] = fs.readFileSync(path.join(ROOT, file), 'utf8'));
    const o0 = f[0] - m[1] - m[2], o1 = f[1] - m[1] - m[2]; if (o0 < 0) continue;
    const l0 = lineOf(t, o0), l1 = lineOf(t, Math.max(o0, o1 - 1));
    total++; const bl = atStart.has(key(f)) ? [] : BLOCKS.filter((b) => b !== 'gone' && per[b].has(key(f)));
    const st = atStart.has(key(f)); if (st) start++; else if (!bl.length) { none++; (blind[file] = blind[file] || []).push([l0, l1]); }
    (out[file] = out[file] || { sha: sha(file), fns: [] }).fns.push([l0, l1, st ? -1 : bl.map((b) => BLOCKS.indexOf(b))]);
  }
  for (const f of Object.keys(out)) out[f].fns.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  fs.writeFileSync(path.join(ROOT, 'test', 'fnmap.json'), JSON.stringify({ blocks: BLOCKS, built: new Date().toISOString().slice(0, 10), files: out }));
  /* the blind spots: functions no block runs (running is not testing, but not running is certainly not testing) */
  const rows = Object.keys(blind).map((f) => [f, blind[f].length, out[f].fns.length]).sort((a, b) => b[1] - a[1]);
  let md = '# Functions no check of the browser test runs\n\nBuilt by `node tools/fnmap.js` (Chromium only). A function listed here is run by none of the ' + (BLOCKS.length - 1) + ' blocks of test/browser.test.js, so a change inside it is not seen by any of them. Running a function is not the same as testing it; not running it is certainly not testing it.\n\n' +
    total + ' functions: ' + start + ' run at page start (every block covers them), ' + none + ' run by no block.\n\n| file | functions run by no block | functions |\n|---|---|---|\n' + rows.map((r) => '| ' + r.join(' | ') + ' |').join('\n') + '\n\n';
  rows.forEach((r) => { md += '## ' + r[0] + '\n\nLines: ' + blind[r[0]].sort((a, b) => a[0] - b[0]).map((x) => x[0] === x[1] ? x[0] : x[0] + '-' + x[1]).join(', ') + '\n\n'; });
  fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true }); fs.writeFileSync(path.join(ROOT, 'docs', 'BLIND-SPOTS.md'), md);
  console.log('functions mapped:', total, '| page start:', start, '| run by no block:', none, '| test/fnmap.json', (fs.statSync(path.join(ROOT, 'test', 'fnmap.json')).size / 1024).toFixed(0), 'KB');
  fs.rmSync(TMP, { recursive: true, force: true });
})();
