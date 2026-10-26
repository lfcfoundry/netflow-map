/* Copyright (c) 2026 LFC Foundry. MIT License. Makes the Netflow Map test map: node make-test-map.js [items=8000] > test-map.json
   12 groups, mostly links inside a group plus bridges between groups, link kinds "flow", "backup" and "alert" (so rules can dash, arrow or bend them), weights 1 to 20. */
'use strict';
const N = +(process.argv[2] || 8000), G = 12, per = Math.ceil(N / G);
let s = 20261025; const rnd = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const names = ['Atlas', 'Birch', 'Cedar', 'Delta', 'Ember', 'Fjord', 'Grove', 'Harbor', 'Island', 'Juniper', 'Kestrel', 'Lagoon'];
const nodes = [], links = [], seen = new Set();
for (let i = 0; i < N; i++) { const g = Math.floor(i / per); nodes.push({ id: 'n' + i, label: names[g] + ' ' + (i % per + 1), group: names[g] }); }
const add = (a, b) => { if (a === b) return; const k = a + '>' + b; if (seen.has(k)) return; seen.add(k); const r = rnd(); links.push({ source: 'n' + a, target: 'n' + b, weight: 1 + Math.floor(rnd() * rnd() * 20), kind: r < 0.06 ? 'alert' : r < 0.22 ? 'backup' : 'flow' }); };
for (let j = 0; j < N; j++) { const g = Math.floor(j / per), m = 2 + Math.floor(rnd() * 3); for (let q = 0; q < m; q++) { const t = g * per + Math.floor(rnd() * per); if (t < N) add(j, t); } if (rnd() < 0.15) add(j, Math.floor(rnd() * N)); }
process.stdout.write(JSON.stringify({ name: 'Test map (' + N + ' items)', nodes, links }));
