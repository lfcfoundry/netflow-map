/* Copyright (c) 2026 JNFoo. MIT License. Checks the distributions and the Monte Carlo walkers against exact answers. */
global.NFMColumns = require('../src/columns.js');
const E = require('../src/engine.js'); global.NFMEngine = E;
const S = require('../src/sim.js');
let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };

// 1. each distribution has the mean and variance it claims (200k draws)
const cases = [['normal', 10, 3], ['lognormal', 10, 4], ['poisson', 4.5], ['poisson', 120], ['binomial', 20, 0.3], ['binomial', 400, 0.45], ['negbinomial', 6, 5], ['geometric', 4], ['exponential', 7], ['gamma', 5, 2], ['gamma', 0.6, 0.8], ['weibull', 3, 1.7], ['beta', 0.3, 0.1], ['uniform', 2, 9], ['triangular', 1, 2, 7], ['pareto', 2, 4], ['dunif', 1, 6]];
for (const [d, a, b, c] of cases) {
  const r = S.makeRng(12345), f = S.DRAW[d], N = 200000; let s = 0, q = 0;
  for (let i = 0; i < N; i++) { const x = f(r, a, b, c); s += x; q += x * x; }
  const mean = s / N, v = q / N - mean * mean, m = S.moments(d, a, b, c);
  const tolM = 0.02 * Math.max(1, Math.abs(m.mean)) + 3 * Math.sqrt(m.variance / N), tolV = 0.06 * Math.max(0.5, m.variance) + (d === 'pareto' ? 1 : 0);
  ok(Math.abs(mean - m.mean) < tolM && Math.abs(v - m.variance) < tolV, `${d}(${a}${b !== undefined ? ',' + b : ''}${c !== undefined ? ',' + c : ''}) mean ${mean.toFixed(3)} vs ${m.mean.toFixed(3)}, variance ${v.toFixed(3)} vs ${m.variance.toFixed(3)}`);
}

// 2. walkers agree with the exact answer, and batches do not change the result
const mk = (ids, edges) => ({ name: 't', start: ids[0], nodes: ids.map(i => ({ id: i, label: i, group: '', valence: '', ghost: false, attrs: {} })), edges: edges.map(([f, t, w]) => ({ from: f, to: t, label: '', weight: w, kind: '', attrs: {} })) });
const g = mk(['s', 'a', 'b', 'x', 'y', 'z'], [['s', 'a', 3], ['s', 'b', 1], ['a', 'x', 2], ['a', 'y', 2], ['b', 'y', 1], ['b', 'z', 3], ['a', 'b', 1]]);
const P = E.prepare(g, { weights: true });
const cfg = { seed: 7, trials: 40000, rule: 'weights', weights: P.w };
const ex = S.exactEndpoints(P, cfg), sim = S.create(P, cfg); sim.run(1e9, 1e9); const r = sim.snapshot();
ok(ex && r.endpoints.length === ex.ends.length, 'same ends as the exact solver');
let worst = 0; r.endpoints.forEach((e, k) => { worst = Math.max(worst, Math.abs(e.share - ex.p[k])); ok(ex.p[k] >= e.lo - 1e-9 && ex.p[k] <= e.hi + 1e-9, `exact ${ex.p[k].toFixed(4)} inside the 95% range ${e.lo.toFixed(4)}..${e.hi.toFixed(4)} for ${e.id}`); });
ok(worst < 0.01, 'worst gap to the exact odds ' + worst.toFixed(4));
const s1 = S.create(P, cfg); while (!s1.run(137, 1e9).done); const s2 = S.create(P, cfg); s2.run(1e9, 1e9);
ok(JSON.stringify(s1.snapshot().endpoints.map(e => e.count)) === JSON.stringify(s2.snapshot().endpoints.map(e => e.count)), 'cutting the run into batches gives identical counts');

// 3. arrivals from a distribution, uncertain weights, costs
const cfg2 = { seed: 3, trials: 3000, arrivals: { dist: 'poisson', a: 12 }, linkWeight: { dist: 'gamma', a: P.w, b: Float64Array.from(P.w, w => w * 0.5) }, linkCost: { dist: 'lognormal', a: 5, b: 2 }, rule: 'weights', weights: P.w };
const s3 = S.create(P, cfg2); s3.run(1e9, 1e9); const r3 = s3.snapshot();
ok(Math.abs(r3.walkers / r3.trials - 12) < 0.3, 'Poisson arrivals average ' + (r3.walkers / r3.trials).toFixed(2) + ' walkers per trial');
ok(r3.cost && r3.cost.mean > 5 && r3.cost.p95 > r3.cost.p5, 'cost spread is reported: ' + (r3.cost ? r3.cost.p5.toFixed(1) + ' to ' + r3.cost.p95.toFixed(1) : 'none'));
ok(r3.endpoints[0].perTrial.sd > 0, 'per-trial counts vary');

// 4. sweep
const sw = S.sweep(P, cfg, { what: 'items', top: 10 });
ok(sw.ok && sw.rows.length >= 2 && sw.rows[0].shift >= sw.rows[sw.rows.length - 1].shift, 'what-if sweep ranks items; most important is ' + (sw.rows[0] && sw.rows[0].id) + ' (shift ' + (sw.rows[0] && sw.rows[0].shift.toFixed(3)) + ')');
// cap on a loop
const lg = mk(['s', 'a', 'e'], [['s', 'a', 1], ['a', 's', 9], ['a', 'e', 1]]);
const PL = E.prepare(lg, { weights: true }), sl = S.create(PL, { seed: 1, trials: 5000, rule: 'weights', weights: PL.w, stepCap: 400 }); sl.run(1e9, 1e9);
ok(sl.snapshot().endpoints[0].share > 0.99, 'walkers escape a loop');
console.log(bad ? bad + ' FAILED' : 'sim: all passed'); process.exit(bad ? 1 : 0);
