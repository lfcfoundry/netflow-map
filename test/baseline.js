/* Copyright (c) 2026 LFC Foundry. MIT License. Pass-count baseline for test/browser.test.js: a run with FEWER ok lines than the last all-green run of the same browser fails
 * (a suite that quietly skips checks is a failure). Counts live in test/baseline.json. Save a new count after a reviewed change: NFM_BLESS=1 node test/browser.test.js <browser>. */
'use strict';
const fs = require('fs'), path = require('path'), FILE = path.join(__dirname, 'baseline.json');
const read = () => { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { return {}; } };
/** which: browser name; oks: ok lines this run; fails: failed lines this run; page: NFM_PAGE (another page, e.g. the packed copy, has its own count and is not compared).
 *  o.skipped: drawing checks that printed "note ... not available here" because this machine has no WebGL 2 or WebGPU; they count toward the baseline
 *  (a machine without graphics is not a check that was quietly skipped). With no such notes the rule is as strict as ever. o.partial: an NFM_ONLY run,
 *  never compared (not a release result). */
function verdict(which, oks, fails, page, base, o) {
  base = base || read(); o = o || {};
  const sk = o.skipped || 0, skTxt = sk ? ' + ' + sk + ' skipped for no graphics' : '';
  if (o.partial) return { fail: false, line: oks + ' checks passed (partial run: not a release result, baseline not compared)' };
  if (page) return { fail: false, line: oks + ' checks passed (custom page: baseline not compared)' };
  const b = base[which];
  if (b === undefined) return { fail: false, line: oks + ' checks passed (no baseline saved for ' + which + ' yet: NFM_BLESS=1 saves it)' };
  if (oks + sk < b) return { fail: true, line: 'FAIL fewer ok lines than the last all-green run of ' + which + ' (' + oks + skTxt + ' < ' + b + '): a check may have been skipped. If checks were removed on purpose, review and run with NFM_BLESS=1.' };
  return { fail: false, line: oks + ' checks passed' + skTxt + ' (baseline ' + b + (oks + sk > b ? ', ' + (oks + sk - b) + ' new' : '') + ')' };
}
function bless(which, oks) { const base = read(); base[which] = oks; fs.writeFileSync(FILE, JSON.stringify(base, null, 2) + '\n'); return 'baseline saved: ' + which + ' = ' + oks; }
module.exports = { verdict, bless, read };
