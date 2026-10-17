/* Copyright (c) 2026 LFC Foundry. MIT License. Pass-count baseline for test/browser.test.js: a run with FEWER ok lines than the last all-green run of the same browser fails
 * (a suite that quietly skips checks is a failure). Counts live in test/baseline.json. Save a new count after a reviewed change: NFM_BLESS=1 node test/browser.test.js <browser>. */
'use strict';
const fs = require('fs'), path = require('path'), FILE = path.join(__dirname, 'baseline.json');
const read = () => { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { return {}; } };
/** which: browser name; oks: ok lines this run; fails: failed lines this run; page: NFM_PAGE (another page, e.g. the packed copy, has its own count and is not compared). */
function verdict(which, oks, fails, page, base) {
  base = base || read();
  if (page) return { fail: false, line: oks + ' checks passed (custom page: baseline not compared)' };
  const b = base[which];
  if (b === undefined) return { fail: false, line: oks + ' checks passed (no baseline saved for ' + which + ' yet: NFM_BLESS=1 saves it)' };
  if (oks < b) return { fail: true, line: 'FAIL fewer ok lines than the last all-green run of ' + which + ' (' + oks + ' < ' + b + '): a check may have been skipped. If checks were removed on purpose, review and run with NFM_BLESS=1.' };
  return { fail: false, line: oks + ' checks passed (baseline ' + b + (oks > b ? ', ' + (oks - b) + ' new' : '') + ')' };
}
function bless(which, oks) { const base = read(); base[which] = oks; fs.writeFileSync(FILE, JSON.stringify(base, null, 2) + '\n'); return 'baseline saved: ' + which + ' = ' + oks; }
module.exports = { verdict, bless, read };
