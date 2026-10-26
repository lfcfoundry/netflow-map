/* Copyright (c) 2026 LFC Foundry. MIT License.
 * Noise guard for timing runs (owner rule 2026.10.26): before and after each timing batch, run a fixed calibration loop (about 1.5 s) in the same
 * browser, compare it with that browser's quiet baseline (bench/noise-baseline.json), and call the batch noisy (rerun, do not report) when it is
 * more than 15% off. Use: const G = require('./noise-guard'); G.CALIB_SRC is the function text to run in the page; G.check(browser, ms) -> { ratio, noisy }. */
const fs = require('fs'), path = require('path');
const CALIB_SRC = '(function () { var t = performance.now(), x = 0, a = new Float64Array(1024), i; for (i = 0; i < 60000000; i++) { x += Math.sqrt(i & 1023) + a[i & 1023]; a[i & 1023] = x % 7; } return { ms: performance.now() - t, sink: x > 0 }; })()';
const FILE = path.join(__dirname, 'noise-baseline.json');
function baseline() { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { return {}; } }
function save(b) { fs.writeFileSync(FILE, JSON.stringify(b, null, 2) + '\n'); }
function check(browser, ms, limit) { const b = baseline()[browser]; if (!b) return { ratio: null, noisy: false, note: 'no baseline yet' }; const r = ms / b; return { ratio: +r.toFixed(3), noisy: Math.abs(r - 1) > (limit || 0.15) }; }
module.exports = { CALIB_SRC, baseline, save, check };
