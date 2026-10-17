/* Copyright (c) 2026 LFC Foundry. MIT License. Runs every Node test at once, two at a time (one per processor core), longest first.
 * Run: node test/all.js          (the fuzz test gets 10 s of random cases; about 45 s in all instead of about 90 s one after another)
 *      node test/all.js --full   (the fuzz test gets 90 s)
 * One line per test with its time; the last lines of any failing test are printed. The browser test is separate (node test/browser.test.js firefox|chromium|webkit). */
'use strict';
const { spawn } = require('child_process'), fs = require('fs'), path = require('path'), os = require('os');
const full = process.argv.includes('--full');
const files = fs.readdirSync(__dirname).filter((f) => /\.test\.m?js$/.test(f) && f !== 'browser.test.js');
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
