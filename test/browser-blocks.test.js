/* Copyright (c) 2026 LFC Foundry. MIT License. The changed-file map for the browser test's blocks names only blocks that exist, and unknown files run everything. */
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert'), { blocksFor, narrow, MAP, CHEAP } = require('./browser-blocks.js');
const src = fs.readFileSync(path.join(__dirname, 'browser.test.js'), 'utf8'), have = new Set([...src.matchAll(/if \(want\('([\w-]+)'\)\)/g)].map((m) => m[1]));
assert(have.size >= 25, 'browser.test.js has its blocks (' + have.size + ')');
for (const [f, bs] of Object.entries(MAP)) { assert(fs.existsSync(path.join(__dirname, '..', f)), 'mapped file exists: ' + f); bs.forEach((b) => assert(have.has(b), f + ' names a block that does not exist: ' + b)); }
CHEAP.forEach((b) => assert(have.has(b), 'always-run block exists: ' + b));
assert.strictEqual(blocksFor(['src/app/99-boot.js']), null, 'a file every block uses runs everything');
assert.strictEqual(blocksFor(['src/app/10-data.js', 'src/new-thing.js']), null, 'an unknown file runs everything');
assert.deepStrictEqual(blocksFor(['README.md', 'docs/BENCHMARKS.md']), [], 'docs need no browser block');
const d = blocksFor(['src/app/72-gif.js']); assert(d.includes('4') && d.includes('states') && d.includes('gone'), 'the GIF file runs the GIF blocks: ' + d);
assert.strictEqual(blocksFor(['test/browser.test.js']), null, 'a change to the browser test itself runs everything');
console.log('browser-blocks: ' + Object.keys(MAP).length + ' files mapped to ' + have.size + ' blocks; ok');

/* the function map (test/fnmap.json, from node tools/fnmap.js) */
{
  const fm = JSON.parse(fs.readFileSync(path.join(__dirname, 'fnmap.json'), 'utf8'));
  fm.blocks.forEach((b) => assert(b === 'gone' || have.has(b), 'fnmap names a block that exists: ' + b));
  let one = null, start = null;
  for (const [f, m] of Object.entries(fm.files)) { assert(fs.existsSync(path.join(__dirname, '..', f)), 'fnmap file exists: ' + f); for (const x of m.fns) { assert(x[0] <= x[1], 'fnmap lines in order'); if (!one && x[2] !== -1 && x[2].length && x[1] > x[0] + 1) one = [f, m, x]; if (!start && x[2] === -1 && x[1] > x[0] + 1) start = [f, m, x]; } }
  const [f1, m1, x1] = one, names = x1[2].map((i) => fm.blocks[i]).sort();
  assert.deepStrictEqual((narrow(f1, m1.sha, [[x1[0] + 1, x1[0] + 1]]) || []).sort().filter((b) => names.includes(b)), names, 'a change inside a function that blocks run gives those blocks');
  assert.strictEqual(narrow(f1, 'not-the-built-version', [[x1[0] + 1, x1[0] + 1]]), null, 'another version of the file keeps the hand map');
  assert.strictEqual(narrow(f1, m1.sha, [[x1[0] + 1, x1[0]]]), null, 'a pure insertion keeps the hand map');
  if (start) assert.strictEqual(narrow(start[0], start[1].sha, [[start[2][0] + 1, start[2][0] + 1]]), null, 'a function the page start runs keeps the hand map');
  const nb = blocksFor([f1], { [f1]: { sha: m1.sha, spots: [[x1[0] + 1, x1[0] + 1]] } });
  assert(CHEAP.every((b) => nb.includes(b)) && names.every((b) => nb.includes(b)), 'blocksFor adds the cheap blocks to the narrowed ones');
  console.log('fnmap: ' + Object.keys(fm.files).length + ' files, narrowing checked; ok');
}
