/* Copyright (c) 2026 LFC Foundry. MIT License. The changed-file map for the browser test's blocks names only blocks that exist, and unknown files run everything. */
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert'), { blocksFor, MAP, CHEAP } = require('./browser-blocks.js');
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
