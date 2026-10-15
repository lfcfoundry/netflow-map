/* Copyright (c) 2026 LFC Foundry. MIT License. The tuning test's decisions, with a pretend processor, card and worker (the real timings are measured in browsers). */
'use strict';
const NFMTune = require('../src/tune.js'); let bad = 0;
const ok = (c, m) => { if (!c) throw new Error(m); };
const t = async (name, fn) => { try { await fn(); console.log('ok   ' + name); } catch (e) { bad++; console.log('FAIL ' + name + ': ' + e.message); } };
Object.defineProperty(global, 'navigator', { value: { hardwareConcurrency: 8, userAgent: 'Firefox/159.0' }, configurable: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const graph = (n) => ({ nodes: Array.from({ length: n }, (_, i) => ({ id: 'n' + i })), edges: Array.from({ length: n - 1 }, (_, i) => ({ from: 'n' + i, to: 'n' + (i + 1) })) });
/** world: ms the processor takes per 1000 items, ms for the card build, truths and times per method. */
function world(w) {
  global.NFMGpuStress = {
    probe: async () => w.card ? { state: 'ready', max: 40000, info: 'Pretend card', prof: null, layoutWith: async (cap, o) => { const key = o.method === 'smacof' ? 'steps' : 'sgd' + o.sweeps; await sleep(w.method[key].ms); const X = new Float32Array(2 * cap.k); X[0] = w.method[key].truth; return { X, ms: { total: w.method[key].ms } }; } } : { state: 'none', why: 'No adapter.' },
    stress: (off, nbr, k, X) => X[0] };
  class Client {
    constructor() { this.mode = 'starting'; } async start() { this.mode = 'worker'; } setGraph(g) { this.g = g; }
    async run() { return { L: { gpuPiece: { k: this.g.nodes.length, off: new Uint32Array(1), nbr: new Uint32Array(1) } } }; }
    async build() { const n = this.g.nodes.length, viaCard = !this.cardOff && this.card && this.card.state === 'ready'; await sleep(viaCard ? w.cardMs : w.cpuMs); const nodes = this.g.nodes.map((nd) => ({ id: nd.id, cx: viaCard ? w.cardTruth : w.cpuTruth, cy: 0 })); if (viaCard && w.unused) this.cardWhy = 'device lost'; return { L: { nodes }, card: viaCard && !w.unused ? { ms: 1 } : undefined }; }
  }
  return Client;
}
const run = (w, sizes) => NFMTune.run({ Client: world(w), engineSrc: '', getEngine: () => null, makeGraph: graph, sizes, big: 0 });
const meth = { sgd1: { ms: 100, truth: 0.151 }, sgd2: { ms: 160, truth: 0.147 }, steps: { ms: 140, truth: 0.156 } };
(async () => {
  await t('a much faster, equally true card is used from 4,001 items, and the fastest method within 2% of the truest is chosen', async () => {
    const r = await run({ card: true, cpuMs: 120, cardMs: 30, cpuTruth: 0.150, cardTruth: 0.150, method: meth }, [5000, 10000]);
    const c = r.profile.card; ok(c.use && c.minItems === 4001, 'not used: ' + JSON.stringify(c)); ok(c.sweeps === 2 && c.sgdMax >= 12500, 'method ' + c.sweeps + ' ' + c.sgdMax); ok(r.profile.secs.card && r.profile.secs.cpu, 'timings missing'); ok(/faster than your processor/.test(r.verdict), r.verdict);
  });
  await t('when the cheaper method is as true, it wins', async () => {
    const m = { sgd1: { ms: 100, truth: 0.1505 }, sgd2: { ms: 160, truth: 0.150 }, steps: { ms: 140, truth: 0.156 } };
    const r = await run({ card: true, cpuMs: 120, cardMs: 30, cpuTruth: 0.150, cardTruth: 0.150, method: m }, [5000, 10000]); ok(r.profile.card.sweeps === 1, 'sweeps ' + r.profile.card.sweeps);
  });
  await t('when the majorization steps win, parallel sweeps are switched off', async () => {
    const m = { sgd1: { ms: 300, truth: 0.151 }, sgd2: { ms: 400, truth: 0.150 }, steps: { ms: 90, truth: 0.150 } };
    const r = await run({ card: true, cpuMs: 120, cardMs: 30, cpuTruth: 0.150, cardTruth: 0.150, method: m }, [5000, 10000]); ok(r.profile.card.sgdMax === 0, 'sgdMax ' + r.profile.card.sgdMax);
  });
  await t('a card that is slower is not used', async () => {
    const r = await run({ card: true, cpuMs: 30, cardMs: 120, cpuTruth: 0.150, cardTruth: 0.150, method: meth }, [5000, 10000]); ok(!r.profile.card.use, 'used'); ok(/not clearly faster/.test(r.verdict), r.verdict);
  });
  await t('a faster card with a clearly worse picture is not used', async () => {
    const r = await run({ card: true, cpuMs: 120, cardMs: 30, cpuTruth: 0.150, cardTruth: 0.170, method: meth }, [5000, 10000]); ok(!r.profile.card.use, 'used');
  });
  await t('no card: the processor stays, and the timings are still saved for the advice text', async () => {
    const r = await run({ card: false, cpuMs: 60, cardMs: 0, cpuTruth: 0.150, cardTruth: 0, method: meth }, [5000, 10000]); ok(!r.profile.card.use && r.profile.secs.cpu && !r.profile.secs.card, 'profile'); ok(/No usable graphics card/.test(r.verdict), r.verdict);
  });
  await t('stopping gives no profile', async () => {
    let n = 0; const r = await NFMTune.run({ Client: world({ card: true, cpuMs: 20, cardMs: 5, cpuTruth: 0.15, cardTruth: 0.15, method: meth }), engineSrc: '', getEngine: () => null, makeGraph: graph, sizes: [5000, 10000], big: 0, cancelled: () => ++n > 3 });
    ok(r.cancelled, 'not cancelled');
  });
  const chk = (w, n) => NFMTune.checkCard({ Client: world(w), engineSrc: '', getEngine: () => null, makeGraph: graph, n: n || 6000 });
  await t('device check: a faster, equally true card is reported as good with the real numbers', async () => { const r = await chk({ card: true, cpuMs: 120, cardMs: 30, cpuTruth: 0.150, cardTruth: 0.151, method: meth }); ok(r.state === 'ready' && r.verdict === 'good' && r.speedup > 3, JSON.stringify(r)); });
  await t('device check: a card that works but is not faster is reported as slower', async () => { const r = await chk({ card: true, cpuMs: 30, cardMs: 120, cpuTruth: 0.150, cardTruth: 0.150, method: meth }); ok(r.verdict === 'slower', r.verdict); });
  await t('device check: a faster card with a clearly worse picture is reported as worse', async () => { const r = await chk({ card: true, cpuMs: 120, cardMs: 30, cpuTruth: 0.150, cardTruth: 0.190, method: meth }); ok(r.verdict === 'worse', r.verdict); });
  await t('device check: a card that passed its test but fell back is reported as unused, with the reason', async () => { const r = await chk({ card: true, unused: true, cpuMs: 120, cardMs: 30, cpuTruth: 0.150, cardTruth: 0.150, method: meth }); ok(r.verdict === 'unused' && /device lost/.test(r.why), r.verdict + ' ' + r.why); });
  await t('device check: no card gives the reason and the processor time', async () => { const r = await chk({ card: false, cpuMs: 60, cardMs: 0, cpuTruth: 0.150, cardTruth: 0, method: meth }); ok(r.state === 'none' && /No adapter/.test(r.why) && r.row.cpuMs > 0, JSON.stringify(r)); });
  await t('distance error colors: the agreed bands', async () => { const c = (v) => NFMTune.errBand(v).cls; ok(c(0.143) === 'e1' && c(0.147) === 'e1' && c(0.148) === 'e2' && c(0.154) === 'e2' && c(0.155) === 'e3' && c(0.165) === 'e3' && c(0.166) === 'e4' && c(0.199) === 'e4' && c(0.2) === 'e5' && c(0.25) === 'e5', 'bands'); ok(NFMTune.errBand('x') === null, 'not a number'); });
  await t('timing law: a power law through two points', async () => { const l = { n0: 5000, t0: 0.5, p: 1.8 }; ok(Math.abs(NFMTune.lawAt(l, 10000) - 0.5 * Math.pow(2, 1.8)) < 1e-9, 'law'); });
  if (bad) { console.log(bad + ' failed'); process.exit(1); } console.log('tune: all passed');
})();
