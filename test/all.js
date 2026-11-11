/* Copyright (c) 2026 LFC Foundry. MIT License. Runs every Node test at once, two at a time (one per processor core), longest first.
 * Run: node test/all.js          (the fuzz test gets 4 s of random cases and smaller sizes; the everyday run takes about 20 s)
 *      node test/all.js --full   (the fuzz test gets 90 s and full sizes; the oracle test plays 20,000 runs per story instead of 8,000)
 *      node test/all.js --only=REGEX   (only the tests whose file name matches, e.g. --only=card|force3d)
 *      node test/all.js --changed      (only the tests that load a source file changed since the last commit; browser-page-only changes run none and say so; an unrecognized change runs everything;
 *                                       it also prints the browser test's blocks for the same changes, as NFM_ONLY=..., from test/browser-blocks.js;
 *                                       a change wholly inside functions of a file the map knows (test/fnmap.json, built by node tools/fnmap.js in about 3 minutes, Chromium only)
 *                                       gets only those functions' blocks, otherwise the hand map; docs/BLIND-SPOTS.md lists the functions no block runs; a release runs every block)
 * One line per test with its time; the last lines of any failing test are printed. The browser test is separate (node test/browser.test.js firefox|chromium|webkit). */
'use strict';
const { spawn } = require('child_process'), fs = require('fs'), path = require('path'), os = require('os');
const full = process.argv.includes('--full');
const files = fs.readdirSync(__dirname).filter((f) => /\.test\.m?js$/.test(f) && f !== 'browser.test.js');
const onlyArg = process.argv.find((x) => x.startsWith('--only=')), changedArg = process.argv.includes('--changed');
let pick = files.slice(), why = '', changedList = null;
if (onlyArg) { const re = new RegExp(onlyArg.slice(7)); pick = files.filter((f) => re.test(f)); why = ' (--only)'; }
if (changedArg) {
  const out = (cmd) => { try { return require('child_process').execSync(cmd, { cwd: path.join(__dirname, '..'), encoding: 'utf8' }).split('\n').filter(Boolean); } catch (e) { return null; } };
  const ch = out('git diff --name-only HEAD'), un = out('git ls-files --others --exclude-standard');
  if (ch === null || un === null) { why = ' (--changed: git not available, running all)'; }
  else {
    const changed = ch.concat(un), text = {}; changedList = changed; files.forEach((f) => { text[f] = fs.readFileSync(path.join(__dirname, f), 'utf8'); });
    const sel = new Set(); let unknown = false, pageOnly = 0;
    changed.forEach((c) => {
      if (/^(CHANGELOG|README|AGENTS)\.md$|^docs\//.test(c) || c === 'index.html' || /^bench\/netflow-map-.*\.html$/.test(c) || /^bench\//.test(c) && !/^bench\/(gen|driver|webkit-driver)\.js$/.test(c) || c === 'test/need-browser.js' || /^tools\/build-(tester|force-lab|then-and-now|race)[\w.-]*\.mjs$/.test(c)) return;   /* words and built copies: no Node test reads them */
      if (/^src\/app\//.test(c) || c === 'src/app.css' || c === 'src/index.template.html' || c === 'test/browser.test.js' || c === 'test/baseline.js' || c === 'test/baseline.json') { pageOnly++; return; }   /* the page itself: only the browser test covers it */
      if (c === 'test/browser-blocks.js' || c === 'test/fnmap.json') { sel.add('browser-blocks.test.js'); return; }
      if (c === 'tools/fnmap.js') return;   /* builds test/fnmap.json: run by hand */
      const m = /^src\/([\w-]+)\.js$/.exec(c);
      if (m) { files.forEach((f) => { if (text[f].indexOf('src/' + m[1] + '.js') >= 0 || text[f].indexOf("'" + m[1] + ".js'") >= 0) sel.add(f); }); return; }
      if (/^test\/[\w.-]+\.test\.m?js$/.test(c) && files.includes(path.basename(c))) { sel.add(path.basename(c)); return; }
      unknown = true;
    });
    if (unknown) why = ' (--changed: an unrecognized file changed, running all)';
    else { pick = files.filter((f) => sel.has(f)); why = ' (--changed: ' + changed.length + ' files changed' + (pageOnly ? ', ' + pageOnly + ' in the page itself: run the browser test for those' : '') + ')'; }
  }
}
files.length = 0; pick.forEach((f) => files.push(f));
if (why) console.log('selection' + why + ': ' + (files.length ? files.join(', ') : 'no Node test needed'));
if (changedArg && changedList) {   /* the browser test's blocks for the same changes (test/browser-blocks.js); a release still runs every block */
  const root = path.join(__dirname, '..'), spots = {};   /* the old-side line ranges of each changed source file, for the function map */
  for (const c of changedList) { if (!/^src\/.*\.js$/.test(c)) continue; try {
    const sha = require('child_process').execSync('git rev-parse HEAD:' + c, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const d = require('child_process').execSync('git diff -U0 HEAD -- ' + c, { cwd: root, encoding: 'utf8' });
    spots[c] = { sha, spots: [...d.matchAll(/^@@ -(\d+)(?:,(\d+))? /gm)].map((m) => { const n = m[2] === undefined ? 1 : +m[2]; return [+m[1], +m[1] + n - 1]; }) }; } catch (e) { /* a new file: no map */ } }
  const bb = require('./browser-blocks.js').blocksFor(changedList, spots);
  console.log('browser test: ' + (bb === null ? 'run every block (a file every block uses, or one not in test/browser-blocks.js, changed)' : bb.length ? 'NFM_ONLY=' + bb.join(',') + ' node test/browser.test.js <browser>' : 'nothing the browser test covers changed'));
}
const weight = (f) => (f.startsWith('fuzz') ? 1000 : f.startsWith('oracle') ? 500 : f.startsWith('stress-wasm') ? 100 : f.startsWith('engine-fixes') ? 90 : f.startsWith('tune') ? 8 : f.startsWith('card') ? 7 : f.startsWith('layout') ? 6 : f.startsWith('force-wasm') ? 5 : f.startsWith('archive') ? 4 : 1);   /* longest first (seconds, everyday run) so no long test starts last */
files.sort((a, b) => weight(b) - weight(a));
const T0 = Date.now(); let next = 0, active = 0, fails = 0; const lanes = Math.max(1, Math.min(os.cpus().length || (os.availableParallelism ? os.availableParallelism() : 1), 4));   /* some Android builds report no CPUs from os.cpus() */
const run = (f) => new Promise((res) => {
  const t = Date.now(), args = ['--expose-gc', path.join(__dirname, f)]; if (f.startsWith('fuzz')) args.push(full ? '90' : '4');
  const p = spawn(process.execPath, args, { cwd: path.join(__dirname, '..'), env: full ? Object.assign({}, process.env, { NFM_FULL: '1' }) : process.env }); let out = '';
  p.stdout.on('data', (d) => { out += d; }); p.stderr.on('data', (d) => { out += d; });
  /* a test that never ends is a failure with its last output, not a silent stall: after NFM_TEST_TIMEOUT_S seconds (default 900) the child is
     killed and reported; a child that cannot start reports its error; 'exit' without 'close' (a grandchild holding the pipes) is reported too */
  let settled = false, exitInfo = null;
  const end = (code, why) => { if (settled) return; settled = true; clearTimeout(timer); const s = ((Date.now() - t) / 1000).toFixed(1).padStart(5); console.log((code === 0 ? 'ok   ' : 'FAIL ') + f.padEnd(22) + s + ' s' + (why ? ' (' + why + ')' : '')); if (code !== 0) { fails++; console.log(out.split('\n').slice(-12).join('\n')); } res(); };
  const limit = (+process.env.NFM_TEST_TIMEOUT_S || 900) * 1000;
  const timer = setTimeout(() => { const why = 'timed out after ' + limit / 1000 + ' s, pid ' + p.pid + (exitInfo ? ', exited ' + exitInfo + ' but its output pipes stayed open' : ', still running'); try { p.kill('SIGKILL'); } catch (e) { /* gone */ } end(1, why); }, limit);
  p.on('error', (e) => end(1, 'could not run: ' + e.message));
  p.on('exit', (code, sig) => { exitInfo = sig ? 'by ' + sig : 'with code ' + code; });
  p.on('close', (code) => end(code, null));
});
const pump = () => { if (next >= files.length) return active === 0 ? finish() : null; while (active < lanes && next < files.length) { active++; run(files[next++]).then(() => { active--; pump(); }); } };
const finish = () => { console.log(`${fails ? fails + ' FAILED' : 'all Node tests passed'} (${files.length} files, ${lanes} at a time, ${((Date.now() - T0) / 1000).toFixed(1)} s)`); process.exitCode = fails ? 1 : 0; };
pump();
