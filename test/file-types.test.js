/* Copyright (c) 2026 LFC Foundry. MIT License. Every file type the Data tab takes opens as the same small map and lays out. The browser test feeds the same files through the real file picker, plus a saved .json.lfc map file. Run: node test/file-types.test.js */
'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path');
global.NFMColumns = require('../src/columns.js');
const I = require('../src/importers.js'), U = require('../src/unpack.js'), E = require('../src/engine.js'), FT = require('./file-types.js');
(async () => {
  /* the list here and the app's list of extensions must not drift apart */
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', '10-data.js'), 'utf8'), m = /TEXT_EXT = \/\\\.\(([^)]+)\)\$\/i, ARCHIVE_EXT = \/\\\.\(([^)]+)\)/.exec(src);
  const appExts = (m[1] + '|' + m[2]).split('|').sort();
  assert.deepStrictEqual(appExts, FT.EXTS.slice().sort(), 'the app takes ' + appExts.join(', '));
  const seen = new Set(FT.LIST.map(([name]) => name.split('.').pop()));
  FT.EXTS.forEach((x) => assert.ok(seen.has(x), 'no test file for .' + x));
  let bad = 0;
  for (const [name, data, nItems, nLinks] of FT.LIST) {
    try {
      const files = typeof data === 'string' ? [{ name, text: data }] : (await U.expand(new Uint8Array(data), name)).files;
      const g = I.importAny(files).graph;
      assert.strictEqual(g.nodes.length, nItems, name + ': items'); assert.strictEqual(g.edges.length, nLinks, name + ': links');
      assert.deepStrictEqual(g.nodes.map((n) => n.label || n.id).sort(), ['A', 'B', 'C'], name + ': names');
      const L = E.build(NFMColumns.derive(g), { view: 'network' });
      assert.strictEqual(L.nodes.length, 3, name + ': laid out');
    } catch (e) { bad++; console.log('FAIL', name, e.message); }
  }
  if (bad) process.exit(1);
  console.log('file types: all ' + FT.LIST.length + ' files (' + FT.EXTS.length + ' extensions) open as 3 items and lay out');
})().catch((e) => { console.log('FAIL', e.message); process.exit(1); });
