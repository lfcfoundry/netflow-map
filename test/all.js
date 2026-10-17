/* Copyright (c) 2026 LFC Foundry. MIT License. Runs every Node test at once, two at a time (one per processor core), longest first.
 * Run: node test/all.js          (the fuzz test gets 10 s of random cases; about 45 s in all instead of about 90 s one after another)
 *      node test/all.js --full   (the fuzz test gets 90 s)
 *      node test/all.js --only=REGEX   (only the tests whose file name matches, e.g. --only=card|force3d)
 *      node test/all.js --changed      (only the tests that load a source file changed since the last commit; browser-page-only changes run none and say so; an unrecognized change runs everything)
 * One line per test with its time; the last lines of any failing test are printed. The browser test is separate (node test/browser.test.js firefox|chromium|webkit). */
'use strict';
const { spawn } = require('child_process'), fs = require('fs'), path = require('path'), os = require('os');
const full = process.argv.includes('--full');
const files = fs.readdirSync(__dirname).filter((f) => /\.test\.m?js$/.test(f) && f !== 'browser.test.js');
const onlyArg = process.argv.find((x) => x.startsWith('--only=')), changedArg = process.argv.includes('--changed');
let pick = files.slice(), why = '';
if (onlyArg) { const re = new RegExp(onlyArg.slice(7)); pick = files.filter((f) => re.test(f)); why = ' (--only)'; }
if (changedArg) {
  const out = (cmd) => { try { return require('child_process').execSync(cmd, { cwd: path.join(__dirname, '..'), encoding: 'utf8' }).split('\n').filter(Boolean); } catch (e) { return null; } };
  const ch = out('git diff --name-only HEAD'), un = out('git ls-files --others --exclude-standard');
  if (ch === null || un === null) { why = ' (--changed: git not available, running all)'; }
  else {
    const changed = ch.concat(un), text = {}; files.forEach((f) => { text[f] = fs.readFileSync(path.join(__dirname, f), 'utf8'); });
    const sel = new Set(); let unknown = false, pageOnly = 0;
    changed.forEach((c) => {
      if (/^(CHANGELOG|README|AGENTS)\.md$|^docs\//.test(c) || c === 'index.html' || /^bench\/netflow-map-.*\.html$/.test(c)) return;   /* words and built copies: no Node test reads them */
      if (/^src\/app\//.test(c) || c === 'src/app.css' || c === 'src/index.template.html' || c === 'test/browser.test.js' || c === 'test/baseline.js' || c === 'test/baseline.json') { pageOnly++; return; }   /* the page itself: only the browser test covers it */
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
const weight = (f) => (f.startsWith('fuzz') ? 1000 : f.startsWith('oracle') ? 500 : f.startsWith('card') ? 7 : f.startsWith('layout') ? 6 : f.startsWith('tune') ? 5 : 1);
files.sort((a, b) => weight(b) - weight(a));
const T0 = Date.now(); let next = 0, active = 0, fails = 0; const lanes = Math.max(1, Math.min(os.cpus().length, 4));
const run = (f) => new Promise((res) => {
  const t = Date.now(), args = ['--expose-gc', path.join(__dirname, f)]; if (f.startsWith('fuzz')) args.push(full ? '90' : '10');
  const p = spawn(process.execPath, args, { cwd: path.join(__dirname, '..') }); let out = '';
  p.stdout.on('data', (d) => { out += d; }); p.stderr.on('data', (d) => { out += d; });
  p.on('close', (code) => { const s = ((Date.now() - t) / 1000).toFixed(1).padStart(5); console.log((code === 0 ? 'ok   ' : 'FAIL ') + f.padEnd(22) + s + ' s'); if (code !== 0) { fails++; console.log(out.split('\n').slice(-12).join('\n')); } res(); });
});
const pump = () => { if (next >= files.length) return active === 0 ? finish() : null; while (active < lanes && next < files.length) { active++; run(files[next++]).then(() => { active--; pump(); }); } };
const finish = () => { console.log(`${fails ? fails + ' FAILED' : 'all Node tests passed'} (${files.length} files, ${lanes} at a time, ${((Date.now() - T0) / 1000).toFixed(1)} s)`); process.exitCode = fails ? 1 : 0; };
pump();
