/* Copyright (c) 2026 LFC Foundry. MIT License. The idle warm-up of the layout worker: the worker runs it without touching its real graph, and the client sends it once, only when idle. */
'use strict';
global.NFMColumns = require('../src/columns.js'); global.NFMSim = require('../src/sim.js'); global.NFMCheck = require('../src/check.js'); global.NFMPack = require('../src/pack.js');
const E = require('../src/engine.js'); global.NFMEngine = E;
const CL = require('../src/engine-client.js'), { Client } = CL; let bad = 0;
const ok = (c, m) => { if (!c) throw new Error(m); };
const t = async (name, fn) => { const t0 = Date.now(); try { await fn(); console.log('ok   ' + name + ' (' + (Date.now() - t0) + ' ms)'); } catch (e) { bad++; console.log('FAIL ' + name + ': ' + e.message); } };
const graph = (n) => ({ start: 'n0', nodes: Array.from({ length: n }, (_, i) => ({ id: 'n' + i, label: 'n' + i, group: '', valence: '', ghost: false, attrs: {} })), edges: Array.from({ length: n * 2 }, (_, i) => ({ id: 'e' + i, from: 'n' + (i % n), to: 'n' + ((i * 7 + 3) % n), label: '', kind: '', attrs: {} })).filter((e) => e.from !== e.to) });
/* run the worker's own text with a pretend `self` */
const worker = () => { const out = []; const self = { postMessage: (m) => out.push(m) }; new Function('self', 'NFMEngine', 'NFMSim', 'NFMCheck', 'NFMColumns', 'NFMPack', CL.workerMain)(self, E, global.NFMSim, global.NFMCheck, global.NFMColumns, global.NFMPack); return { self, out }; };
(async () => {
  await t('the worker answers a warm-up and leaves its real graph alone', async () => {
    const w = worker(), g = graph(300);
    w.self.onmessage({ data: { type: 'graph', id: 1, ver: 1, graph: g } });
    w.self.onmessage({ data: { type: 'build', id: 2, ver: 1, opts: { view: 'network' } } });
    const before = JSON.stringify(w.out[1].result.nodes ? w.out[1].result.nodes.map((n) => [n.cx, n.cy]) : w.out[1].result);
    w.self.onmessage({ data: { type: 'warm', id: 3 } });
    ok(w.out[2].ok && w.out[2].result === 'warm', 'warm answer: ' + JSON.stringify(w.out[2]).slice(0, 120));
    w.self.onmessage({ data: { type: 'build', id: 4, ver: 1, opts: { view: 'network' } } });
    const after = JSON.stringify(w.out[3].result.nodes ? w.out[3].result.nodes.map((n) => [n.cx, n.cy]) : w.out[3].result);
    ok(before === after, 'the picture changed after a warm-up');
  });
  const fake = () => { const c = new Client('', () => E), sent = []; c.mode = 'worker'; c.w = { postMessage: (m) => { sent.push(m.type); setTimeout(() => c.onMsg({ id: m.id, ok: true, result: m.type === 'warm' ? 'warm' : true }), 0); }, terminate() {} }; return { c, sent }; };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  await t('the client sends one warm-up when idle', async () => {
    const { c, sent } = fake(); c.armWarm(5); await wait(40); c.armWarm(5); await wait(40);
    ok(sent.length === 1 && sent[0] === 'warm', 'sent ' + JSON.stringify(sent));
  });
  await t('the client skips the warm-up when a job is out or waiting', async () => {
    const a = fake(); a.c.busy = { type: 'build' }; a.c.armWarm(5); await wait(40);
    const b = fake(); b.c.pending.set(9, {}); b.c.armWarm(5); await wait(40);
    ok(a.sent.length === 0 && b.sent.length === 0, 'sent ' + JSON.stringify([a.sent, b.sent]));
  });
  await t('no warm-up in page mode or when parked', async () => {
    const a = fake(); a.c.mode = 'page'; a.c.armWarm(5); await wait(30);
    const b = fake(); b.c.parked = true; b.c.armWarm(5); await wait(30);
    ok(a.sent.length === 0 && b.sent.length === 0, 'sent ' + JSON.stringify([a.sent, b.sent]));
  });
  console.log(bad ? bad + ' failed' : 'all ok'); process.exit(bad ? 1 : 0);
})();
