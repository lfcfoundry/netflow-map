/* Copyright (c) 2026 LFC Foundry. MIT License. Start-up, an older page against a newer one, each in a FRESH page, taking turns (old, new, new, old, ...): milliseconds from the start of loading to the first screen mark, and to the page being ready for a map. Median over pairs, lower is better.
 *   node bench/start-ab.js chromium|firefox|webkit <old.html> <new.html> [pairs=9] */
'use strict';
const path = require('path'), which = process.argv[2] || 'chromium', A = path.resolve(process.argv[3]), B = path.resolve(process.argv[4]), pairs = +(process.argv[5] || 9);
(async () => {
  const med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
  const once = async (file) => {
    const D = await require('./driver.js').open(which, { timeout: 120000 });
    try {
      const t0 = Date.now(); await D.goto('file://' + file);
      while (Date.now() - t0 < 60000 && !(await D.page.evaluate(() => typeof NFM !== 'undefined' && !!NFM.setGraph && typeof NFMExamples !== 'undefined'))) await new Promise((r) => setTimeout(r, 5));
      return Date.now() - t0;
    } finally { await D.close(); }
  };
  const a = [], b = [];
  for (let i = 0; i < pairs; i++) { if (i % 2) { b.push(await once(B)); a.push(await once(A)); } else { a.push(await once(A)); b.push(await once(B)); } }
  console.log('| start-up (ms, to ready) | old | new | ratio old / new |\n|---|---|---|---|\n| ' + which + ', median of ' + pairs + ' fresh pages | ' + med(a) + ' | ' + med(b) + ' | ' + (med(a) / med(b)).toFixed(2) + ' |');
})();
