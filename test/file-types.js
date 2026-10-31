/* Copyright (c) 2026 LFC Foundry. MIT License. One small map (A to B, B to C, A to C) in every file type the app reads, for test/file-types.test.js and the browser test. Each entry: [file name, contents, items, links]. */
'use strict';
const Z = require('./zipmake.js');
const F = {
  'links.csv': 'source,target\nA,B\nB,C\nA,C\n',
  'links.tsv': 'source\ttarget\nA\tB\nB\tC\nA\tC\n',
  'links.tab': 'source\ttarget\nA\tB\nB\tC\nA\tC\n',
  'links.psv': 'source|target\nA|B\nB|C\nA|C\n',
  'links.dsv': 'source;target\nA;B\nB;C\nA;C\n',
  'links.prn': 'source,target\nA,B\nB,C\nA,C\n',
  'links.txt': 'source,target\nA,B\nB,C\nA,C\n',
  'links.text': 'source,target\nA,B\nB,C\nA,C\n',
  'links.json': JSON.stringify({ nodes: [{ id: 'A' }, { id: 'B' }, { id: 'C' }], edges: [{ from: 'A', to: 'B' }, { from: 'B', to: 'C' }, { from: 'A', to: 'C' }] }),
  'links.jsonl': '{"from":"A","to":"B"}\n{"from":"B","to":"C"}\n{"from":"A","to":"C"}\n',
  'links.ndjson': '{"source":"A","target":"B"}\n{"source":"B","target":"C"}\n{"source":"A","target":"C"}\n',
  'board.canvas': JSON.stringify({ nodes: [{ id: 'a', type: 'text', text: 'A', x: 0, y: 0, width: 100, height: 60 }, { id: 'b', type: 'text', text: 'B', x: 200, y: 0, width: 100, height: 60 }, { id: 'c', type: 'text', text: 'C', x: 400, y: 0, width: 100, height: 60 }], edges: [{ id: 'e1', fromNode: 'a', toNode: 'b' }, { id: 'e2', fromNode: 'b', toNode: 'c' }, { id: 'e3', fromNode: 'a', toNode: 'c' }] }),
  'links.dot': 'digraph G { A -> B; B -> C; A -> C; }',
  'links.gv': 'digraph G { A -> B; B -> C; A -> C; }',
  'links.gml': 'graph [ directed 1 node [ id 1 label "A" ] node [ id 2 label "B" ] node [ id 3 label "C" ] edge [ source 1 target 2 ] edge [ source 2 target 3 ] edge [ source 1 target 3 ] ]',
  'links.graphml': '<?xml version="1.0"?><graphml><graph edgedefault="directed"><node id="A"/><node id="B"/><node id="C"/><edge source="A" target="B"/><edge source="B" target="C"/><edge source="A" target="C"/></graph></graphml>',
  'links.xml': '<?xml version="1.0"?><graphml><graph edgedefault="directed"><node id="A"/><node id="B"/><node id="C"/><edge source="A" target="B"/><edge source="B" target="C"/><edge source="A" target="C"/></graph></graphml>',
  'links.gexf': '<?xml version="1.0"?><gexf version="1.3"><graph defaultedgetype="directed"><nodes><node id="A" label="A"/><node id="B" label="B"/><node id="C" label="C"/></nodes><edges><edge id="0" source="A" target="B"/><edge id="1" source="B" target="C"/><edge id="2" source="A" target="C"/></edges></graph></gexf>',
  'outline.md': '# A\n## B\n### C\n',
  'outline.markdown': '# A\n## B\n### C\n'
};
const XL = Z.makeXlsx([{ name: 'Links', rows: [['source', 'target'], ['A', 'B'], ['B', 'C'], ['A', 'C']] }]);
/* every extension the Data tab takes (src/app/10-data.js TEXT_EXT and ARCHIVE_EXT); an outline makes a tree, so 2 links */
const LIST = Object.keys(F).map((k) => [k, F[k], 3, /^outline\./.test(k) ? 2 : 3]).concat([
  ['links.xlsx', XL, 3, 3], ['links.xlsm', XL, 3, 3], ['links.zip', Z.makeZip([{ name: 'links.csv', data: F['links.csv'] }]), 3, 3]
]);
const EXTS = ['md', 'markdown', 'txt', 'text', 'csv', 'tsv', 'tab', 'psv', 'dsv', 'prn', 'json', 'canvas', 'jsonl', 'ndjson', 'dot', 'gv', 'gml', 'graphml', 'gexf', 'xml', 'zip', 'xlsx', 'xlsm'];
module.exports = { LIST, EXTS };
