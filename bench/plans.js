/* Copyright (c) 2026 LFC Foundry. MIT License. What to run. Each job: { suite, args, timeout? (ms), label? } */
'use strict';
const J = (suite, args, extra) => Object.assign({ suite, args }, extra || {});
const both = (f) => f; 
module.exports = {
  csv: () => {
    const base = { rows: 100000, cols: 6, quoted: 0, len: 12, multiline: 0 }, jobs = [], add = (o) => jobs.push(J('csvGrid', Object.assign({}, base, o, { check: (o.rows || base.rows) <= 100000 })));
    [1000, 10000, 100000, 1000000].forEach((rows) => add({ rows }));                       // scale
    [2, 6, 12, 30].forEach((cols) => add({ cols, rows: 50000 }));                          // width
    [0, 0.1, 0.5, 1].forEach((quoted) => add({ quoted, rows: 50000 }));                    // how many fields are quoted
    [4, 12, 64, 200].forEach((len) => add({ len, rows: 50000 }));                          // how long a field is
    [0, 0.05, 0.3].forEach((multiline) => add({ multiline, quoted: 0.5, rows: 50000 }));   // line breaks inside quotes
    add({ delim: '\t', rows: 50000 }); add({ delim: ';', quoted: 0.2, rows: 50000 });
    ['simple', 'moderate', 'complex'].forEach((kind) => [10000, 100000, 500000].forEach((n) => jobs.push(J('csvKind', { kind, n }, { timeout: 900000 }))));
    return jobs;
  },
  stress: () => {   // ours (Stress, Force) against d3-force and ForceAtlas2, by size and by how tangled the data is
    const jobs = [];
    ['simple', 'moderate', 'complex', 'planted'].forEach((kind) => [200, 600, 1000, 3000, 10000].forEach((n) => jobs.push(J('network', { kind, n }, { timeout: 900000 }))));
    return jobs;
  },
  stressOurs: () => {   // our own two arrangements only (the libraries' numbers are kept from the stress run); merge with node bench/merge.js
    const jobs = [];
    ['simple', 'moderate', 'complex', 'planted'].forEach((kind) => [200, 600, 1000, 3000, 10000].forEach((n) => jobs.push(J('network', { kind, n, libs: false, before: false }, { timeout: 900000 }))));
    return jobs;
  },
  stressBest: () => {   // the 'best quality' arrangement (every pair) in the browser, next to the normal one at the same sizes
    const jobs = [];
    ['simple', 'moderate', 'complex'].forEach((kind) => [5000, 10000].forEach((n) => jobs.push(J('network', { kind, n, libs: false, before: false, fast: true, arranges: ['stress', 'stressBest'] }, { timeout: 900000 }))));
    return jobs;
  },
  pack: () => [10000, 30000, 100000].map((n) => J('pack', { kind: 'moderate', n }, { timeout: 900000 })),
  gifprof4: () => [1, 2, 3, 4].map((rep) => J('gifprof', { frames: 4, rep })),
  gifprof: () => [1, 2, 3].map((rep) => J('gifprof', { frames: 4, rep })).concat([1, 2].map((rep) => J('gifprof', { frames: 31, rep }))),
  refresh: () => [J('draws', { N: 1000000 }, { timeout: 600000 }), J('gif', { frames: 4 }), J('gif', { frames: 31 }, { timeout: 600000 })],
  typed: () => {   // what typed arrays cost and save
    const jobs = [];
    [300, 600, 1500].forEach((k) => ['arrays', 'typedIndexed', 'typedSeq'].forEach((variant) => jobs.push(J('pairStore', { k, variant }, { timeout: 600000 }))));
    ['moderate', 'complex'].forEach((kind) => [3000, 10000].forEach((n) => ['before', 'new'].forEach((engine) => jobs.push(J('stressRun', { kind, n, engine }, { timeout: 600000 })))));
    [10000, 100000, 500000, 1000000].forEach((n) => jobs.push(J('transfer', { n }, { timeout: 300000 })));
    return jobs;
  },
  limits: () => {   // every stage at 100k, 500k and 1M items, for the three kinds of structure; a size is skipped when the one below it did not finish
    const jobs = [], T = 300000;
    ['simple', 'moderate', 'complex'].forEach((kind) => [100000, 500000, 1000000].forEach((n) => {
      jobs.push(J('limits', { kind, n, via: 'csv', stages: ['csv_only'] }, { timeout: T, group: kind + '|csv' }));
    }));
    ['simple', 'moderate', 'complex'].forEach((kind) => [['core', ['prepare', 'check', 'groups', 'sim']], ['flow', ['flow']], ['force', ['force']], ['stress', ['stress']]].forEach(([nm, st]) => [100000, 500000, 1000000].forEach((n) => {
      jobs.push(J('limits', { kind, n, via: 'graph', stages: st }, { timeout: T, group: kind + '|' + nm }));
    })));
    return jobs;
  },
  limitsSmoke: () => ['moderate'].flatMap((kind) => [J('limits', { kind, n: 20000, via: 'csv', stages: ['csv_only'] }, { timeout: 120000, group: 'a' }), J('limits', { kind, n: 20000, via: 'graph', stages: ['prepare', 'check', 'groups', 'sim'] }, { timeout: 120000, group: 'b' }), J('limits', { kind, n: 20000, via: 'graph', stages: ['flow'] }, { timeout: 120000, group: 'c' }), J('limits', { kind, n: 20000, via: 'graph', stages: ['force'] }, { timeout: 120000, group: 'd' }), J('limits', { kind, n: 20000, via: 'graph', stages: ['stress'] }, { timeout: 120000, group: 'e' })]),
  compare: () => {   // the other modules against the best open-source pieces: layered drawing, groups, draws, formulas, GIF, checker, ingestion, memory
    const jobs = [];
    [[100, 180], [200, 360], [400, 760]].forEach(([n, m]) => jobs.push(J('layered', { n, m, dagre: true, elk: true, cross: true }, { timeout: 600000 })));
    [[1000, 1900], [3000, 5700]].forEach(([n, m]) => jobs.push(J('layered', { n, m, dagre: false, elk: false, cross: true }, { timeout: 600000 })));
    [[300, 6], [1000, 10], [3000, 20]].forEach(([n, planted]) => jobs.push(J('groups', { n, planted }, { timeout: 600000 })));
    jobs.push(J('draws', { N: 1000000 }, { timeout: 600000 }), J('formula', { N: 300000 }), J('gif', { frames: 4 }), J('gif', { frames: 31 }, { timeout: 600000 }));
    ['simple', 'moderate', 'complex'].forEach((kind) => [1000, 10000, 50000].forEach((n) => jobs.push(J('check', { kind, n }, { timeout: 600000 }))));
    [1000, 10000, 50000].forEach((n) => jobs.push(J('ingest', { n }, { timeout: 600000 })));
    ['baseline', 'prepare', 'graphology', 'cytoscape', 'layout'].forEach((what) => jobs.push(J('memory', { n: 10000, what }, { timeout: 600000 })));
    return jobs;
  },
  smoke: () => [J('csvGrid', { rows: 2000, cols: 4, quoted: 0.1, len: 8, multiline: 0, check: true }), J('network', { kind: 'moderate', n: 300 }), J('groups', { n: 300, planted: 6 }), J('draws', { N: 100000 }), J('formula', { N: 20000 }), J('gif', { frames: 4 }), J('check', { n: 1000 }), J('ingest', { n: 500 }), J('layered', { n: 100, m: 180, dagre: true, elk: true, cross: true }), J('limits', { kind: 'moderate', n: 2000, via: 'csv' }), J('memory', { n: 1000 })]
};
