// Copyright (c) 2026 LFC Foundry. MIT License.
// Checks the new engine against the older story-map package (the "oracle") on random story-like graphs:
// same choke points, same share-of-routes, and odds that agree with the oracle's seeded simulated players.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const E = require('../src/engine.js');
const ctx = {}; vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('../vendor/story-map.global.js', import.meta.url), 'utf8') + '\nglobalThis.SM = StoryMap;', ctx);
const SM = ctx.SM;
const rng = (seed) => { let s = seed | 0; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
let gen = 0, fails = 0, cases = 0, chokeOk = 0, trafficOk = 0, oddsWorst = 0;
for (let seed = 1; seed <= 40; seed++) {
  const r = rng(seed * 101), n = 8 + Math.floor(r() * 40), story = SM.makeProject('t'), ps = [story.passages[0]];
  for (let i = 1; i < n; i++) ps.push(SM.makePassage('p' + i));
  const edges = [];
  ps.forEach((p, i) => {
    const k = i >= n - 4 ? 0 : 1 + Math.floor(r() * 2);
    const seen = new Set();
    for (let j = 0; j < k; j++) { let to = i + 1 + Math.floor(r() * Math.min(5, n - i - 1)); if (r() < 0.07) to = Math.floor(r() * n); if (to === i || seen.has(to)) continue; seen.add(to); p.choices.push(SM.makeChoice('c', ps[to].id)); edges.push([p.id, ps[to].id]); }
    if (!p.choices.length && i > 0) { p.ending = true; p.valence = r() < 0.5 ? 'good' : 'bad'; }
  });
  story.passages = ps; const project = SM.normalizeProject(story);
  const ids = project.passages.map((p) => p.id), links = edges.map(([from, to]) => ({ from, to }));
  const imp = SM.mapImportance(project, ids, links);
  const graph = { start: ids[0], nodes: ids.map((id, i) => ({ id, label: id, group: '', valence: project.passages[i].ending ? project.passages[i].valence : '', ghost: false, attrs: {} })), edges: edges.map(([from, to]) => ({ from, to, label: '', kind: '' })) };
  const P = E.prepare(graph, {}), mine = E.importance(P);
  cases++;
  const oracleChoke = new Set(ids.filter((id) => imp.choke && (imp.choke[id] || (imp.choke.has && imp.choke.has(id))))), myChoke = new Set(ids.filter((id, i) => mine.choke[P.index.get(id)]));
  const same = oracleChoke.size === myChoke.size && [...oracleChoke].every((x) => myChoke.has(x));
  const generalized = !same && (!imp.goal || imp.goal.length === 0) && mine.goalKind === 'farthest nodes'; // new on purpose: no ending is reachable, so aim at the farthest items instead of reporting nothing
  if (generalized) { gen++; chokeOk++; } else if (same) chokeOk++; else { fails++; console.log(`seed ${seed}: choke points differ`, [...oracleChoke].join(','), '|', [...myChoke].join(',')); }
  let worst = 0; ids.forEach((id) => { const a = imp.traffic[id], b = mine.traffic[P.index.get(id)]; if (a !== undefined && b !== undefined) worst = Math.max(worst, Math.abs(a - b)); });
  if (worst < 1e-6) trafficOk++; else { fails++; console.log(`seed ${seed}: traffic differs by up to ${worst.toExponential(2)}`); }
  const exact = E.flowExact(P, mine, {}), sim = SM.playtest(project, { runs: process.env.NFM_FULL ? 20000 : 8000, mode: 'random' });
  const oc = sim.outcome, tot = (oc.good + oc.bad + (oc.neutral || 0) + (oc.stuck || 0)) || 1;
  const d = Math.abs(oc.good / tot - exact.outcome.good); oddsWorst = Math.max(oddsWorst, d);
  if (d > 0.02) { fails++; console.log(`seed ${seed}: good-ending odds exact ${exact.outcome.good.toFixed(3)} vs oracle sim ${(oc.good / tot).toFixed(3)}`); }
}
console.log(`oracle test: ${cases} random stories; choke points agree ${chokeOk}/${cases} (${gen} of them differ on purpose: no ending reachable, so the new engine aims at the farthest items); traffic agrees ${trafficOk}/${cases}; worst odds gap ${oddsWorst.toFixed(4)}`);
process.exitCode = fails ? 1 : 0;
