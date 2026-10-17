/* Copyright (c) 2026 LFC Foundry. MIT License.
 * The WebGPU backend's buffer keeping and picture pacing with a pretend graphics device, and the plain-words reading of the timing step.
 * (Real speed is measured in browsers by the tester's "Where the drawing time goes" step; pictures are compared in test/browser.test.js.) */
'use strict';
let bad = 0;
const ok = (c, m) => { if (!c) throw new Error(m); };
const t = async (name, fn) => { try { await fn(); console.log('ok   ' + name); } catch (e) { bad++; console.log('FAIL ' + name + ': ' + e.message); } };

/* ---- a pretend browser with a pretend WebGPU device that counts what the backend asks of it */
const log = { made: 0, destroyed: 0, writes: 0, sizes: [], fences: [] };
const pass = { setPipeline() {}, setBindGroup() {}, setVertexBuffer() {}, draw() {}, end() {} };
const device = {
  limits: { maxBufferSize: 1 << 28 }, lost: new Promise(() => {}), addEventListener() {},
  createShaderModule: () => ({}), createRenderPipeline: () => ({ getBindGroupLayout: () => ({}) }), createBindGroup: () => ({}),
  createBuffer: (d) => { log.made++; log.sizes.push(d.size); return { size: d.size, destroy() { log.destroyed++; } }; },
  createCommandEncoder: () => ({ beginRenderPass: () => pass, finish: () => ({}) }),
  queue: { writeBuffer() { log.writes++; }, submit() {}, onSubmittedWorkDone() { return new Promise((res) => { log.fences.push(res); }); } },
  destroy() {}
};
global.GPUBufferUsage = { VERTEX: 32, UNIFORM: 64, COPY_DST: 8 };
Object.defineProperty(global, 'navigator', { value: { gpu: { requestAdapter: async () => ({ info: { description: 'Pretend' }, isFallbackAdapter: false, requestDevice: async () => device }), getPreferredCanvasFormat: () => 'bgra8unorm' } }, configurable: true });
const ctx2d = new Proxy({}, { get: (o, k) => (k in o ? o[k] : () => ({ width: 10 })), set: (o, k, v) => { o[k] = v; return true; } });
global.document = { createElement: () => ({ style: {}, setAttribute() {}, width: 1, height: 1, getContext: (k) => (k === 'webgpu' ? { configure() {}, getCurrentTexture: () => ({ createView: () => ({}) }) } : ctx2d) }) };
const host = { textContent: '', appendChild() {} };
global.NFMScene = require('../src/scene.js');
const NFMRender = require('../src/render.js'), NFMProbe = require('../src/probe.js');

const scene = (n) => ({ theme: { bg: [1, 1, 1, 1] }, rects: [], dots: Array.from({ length: n }, (_, i) => ({ cx: i, cy: i, r: 3, sw: 1, fill: [1, 0, 0, 1], stroke: [0, 0, 0, 1] })), curves: [], ribbons: [], polys: [], labels: [], icons: [], w: 100, h: 100, x0: 0, y0: 0 });
const view = { k: 1, tx: 0, ty: 0 };
const fence = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };

(async () => {
  const r = await NFMRender.createWebGPU(host, {}); r.resize(100, 100, 1);
  await t('the same scene again, and smaller ones, reuse the buffers and only write into them', async () => {
    r.setScene(scene(100)); r.draw(view); const made = log.made, w0 = log.writes;
    ok(made === 1 || made === 2, 'first scene makes its buffers (' + made + ')');
    for (let i = 0; i < 30; i++) { r.setScene(scene(100 - (i % 5))); r.draw(view); }
    ok(log.made === made && log.destroyed === 0, 'no new buffers or destroyed buffers for 30 pictures (made ' + log.made + ', destroyed ' + log.destroyed + ')');
    ok(log.writes > w0 + 30, 'each picture was written into the kept buffers');
  });
  await t('a bigger scene gets a bigger buffer (with room to spare) and frees the old one', async () => {
    const made = log.made, d0 = log.destroyed; r.setScene(scene(400)); r.draw(view);
    ok(log.made === made + 1 && log.destroyed === d0 + 1, 'one buffer replaced');
    const size = log.sizes[log.sizes.length - 1]; ok(size >= 400 * 64 && size <= 400 * 64 * 1.3 + 256, 'size ' + size + ' covers 400 shapes with a little to spare');
    r.setScene(scene(399)); ok(log.made === made + 1, 'a slightly smaller scene fits the same buffer');
  });
  await t('the old way (legacyBuffers) makes and destroys buffers for every picture', async () => {
    r.legacyBuffers = true; const made = log.made, d0 = log.destroyed;
    for (let i = 0; i < 5; i++) { r.setScene(scene(50)); r.draw(view); }
    ok(log.made - made >= 5 && log.destroyed - d0 >= 5, 'made ' + (log.made - made) + ', destroyed ' + (log.destroyed - d0)); r.legacyBuffers = false;
  });
  await t('pace() lets three pictures be in flight and waits for the oldest on the fourth', async () => {
    log.fences.length = 0; const done = []; let settled = 0;
    for (let i = 0; i < 3; i++) { r.draw(view); r.pace(3).then(() => { settled++; }); }
    await fence(); ok(settled === 3, 'three pictures in flight do not wait (' + settled + ')');
    r.draw(view); let fourth = false; r.pace(3).then(() => { fourth = true; });
    await fence(); ok(!fourth, 'the fourth picture waits while the first has not finished');
    log.fences[0](); await fence(); ok(fourth, 'the fourth picture goes on once the first one is done');
    log.fences.forEach((f) => f());
  });
  await t('flush() still waits for the card to finish everything', async () => {
    log.fences.length = 0; let done = false; r.flush().then(() => { done = true; }); await fence(); ok(!done, 'waits'); log.fences[0](); await fence(); ok(done, 'returns when the card is done');
  });
  r.destroy();

  /* ---- reading the timing numbers */
  const way = (id, fps, scene_, upload, draw, fence_, raf) => ({ id, label: id + ' label', fps, frames: 50, scene: scene_, upload, draw, fence: fence_, raf });
  const slowFence = { backend: 'webgpu', ways: [way('old', 9.9, 4, 2, 1, 90, 4), way('reuse', 10.1, 4, 1, 0.5, 88, 6), way('nowait', 58, 4, 1, 0.5, 0, 12), way('every4', 40, 4, 1, 0.5, 22, 8), way('pace', 55, 4, 1, 0.5, 0.4, 12), way('blank', 60, 0, 0, 0.2, 0, 16), way('half', 58, 2, 0.5, 0.3, 0, 14)] };
  const ctl = { backend: 'webgl2', ways: [way('wait', 60, 4, 1, 0.5, 0.3, 11), way('nowait', 60, 4, 1, 0.5, 0, 11), way('blank', 60, 0, 0, 0.1, 0, 16)] };
  await t('a slow "done" signal is named as the main cost, and the fastest way is reported', async () => {
    const e = NFMProbe.explainTiming(slowFence, ctl);
    ok(e.dominant.phase === 'fence' && e.dominant.share > 0.8, JSON.stringify(e.dominant));
    ok(/waiting for the graphics card to say it had finished/.test(e.say) && /9\.9 FPS/.test(e.say), e.say);
    ok(e.fastest === 'nowait' && /allow three at a time/.test(e.say) && e.level === 'ok', e.fastest + ' ' + e.level);
  });
  await t('a browser whose blank picture is just as slow is blamed, not our drawing', async () => {
    const g = { backend: 'webgpu', ways: [way('old', 10, 4, 2, 1, 5, 80), way('nowait', 12, 4, 1, 0.5, 0, 78), way('pace', 11.5, 4, 1, 0.5, 0, 80), way('blank', 13, 0, 0, 0.2, 0, 77), way('half', 14, 2, 0.5, 0.3, 0, 70)] };
    const e = NFMProbe.explainTiming(g, ctl);
    ok(/limit is the browser's own step of putting a WebGPU picture on screen/.test(e.say) && /WebGL 2 is the better choice/.test(e.say) && e.level === 'bad', e.say);
  });
  await t('a software stand-in is said so and never rated better than "warn"; a skipped run says why', async () => {
    const e = NFMProbe.explainTiming(Object.assign({ software: true }, slowFence), null); ok(/runs on the processor/.test(e.say) && e.level === 'warn', e.say);
    const s = NFMProbe.explainTiming({ backend: 'webgpu', skipped: 'the page was in the background' }, null); ok(s.level === 'warn' && /background/.test(s.say), s.say);
  });
  const W = (o) => Object.assign({ gapMed: 16.7, gapP95: 17, gapMax: 18, slow: 0, angleMed: 5, angleMax: 6, drawMed: 0.5 }, o);
  const split = (full, angle, g) => ({ backend: 'webgpu', ways: [Object.assign({ id: 'full', label: 'a' }, W(full)), Object.assign({ id: 'angle', label: 'b' }, W(angle)), { id: 'still', label: 'c', fps: 60, gapMed: 16.7, gapP95: 17, gapMax: 18, slow: 0, angleMed: 0, angleMax: 0 }, { id: 'g_all', label: 'd', ms: g.all }, { id: 'g_links', label: 'e', ms: g.links }, { id: 'g_items', label: 'f', ms: g.items }, { id: 'g_names', label: 'g', ms: g.names }, { id: 'g_half', label: 'h', ms: g.half }] });
  await t('the split of a turning picture says what holds it below 60: nothing, the angle math, the card, or pauses', async () => {
    const g0 = { all: 6, links: 4, items: 2, names: 1, half: 3 };
    let e = NFMProbe.explainSplit(split({ fps: 60 }, { fps: 60 }, g0), 30000); ok(e.cause === 'smooth' && e.level === 'ok' && /30,000-item/.test(e.say) && /steady 60/.test(e.say), e.say);
    const sk = split({ fps: 45 }, { fps: 60 }, g0); sk.ways.push({ id: 'keep', label: 'k', fps: 60, gapMed: 16.7, gapP95: 17, gapMax: 18, slow: 0, angleMed: 5, angleMax: 6 });
    e = NFMProbe.explainSplit(sk, 100000); ok(e.cause === 'order' && /paint order/.test(e.say), e.say);
    const sp = split({ fps: 57, gapP95: 29, gapMax: 69, slow: 0.11 }, { fps: 51, gapP95: 44, gapMax: 150 }, g0); sp.ways.push({ id: 'keep', label: 'k', fps: 60, gapMed: 16.7, gapP95: 18, gapMax: 18, slow: 0, angleMed: 5, angleMax: 6 }, { id: 'map', label: 'm', fps: 60, gapMed: 16.7, gapP95: 18, gapMax: 19, slow: 0, angleMed: 5, angleMax: 6 });
    e = NFMProbe.explainSplit(sp, 100000); ok(e.cause === 'order' && e.lines.some((l) => /staging buffers/.test(l) && /worse|steadier|same/.test(l)), e.say);   /* pauses that vanish without the re-send are the order, and a nothing-drawn row at 51 is not blamed */
    e = NFMProbe.explainSplit(split({ fps: 40 }, { fps: 40, angleMed: 24 }, g0), 30000); ok(e.cause === 'angle' && /main thread/.test(e.say), e.say);
    e = NFMProbe.explainSplit(split({ fps: 40 }, { fps: 60 }, { all: 24, links: 18, items: 5, names: 1, half: 22 }), 30000); ok(e.cause === 'card' && /the links/.test(e.say) && /number of links and items/.test(e.say), e.say);
    e = NFMProbe.explainSplit(split({ fps: 40 }, { fps: 60 }, { all: 24, links: 18, items: 5, names: 1, half: 9 }), 30000); ok(/follows the number of pixels/.test(e.say), e.say);
    e = NFMProbe.explainSplit(split({ fps: 52, gapP95: 34, gapMax: 80, slow: 0.1 }, { fps: 60 }, g0), 30000); ok(e.cause === 'hiccups' && /pause/.test(e.say), e.say);
    e = NFMProbe.explainSplit(split({ fps: 52 }, { fps: 60 }, g0), 30000); ok(e.cause === 'unclear', e.say);
    const nz = split({ fps: 40 }, { fps: 60 }, g0); nz.ways[0].fpsAll = [40, 58, 30]; nz.ways.push({ id: 'keep', label: 'k', fps: 60, fpsAll: [60, 41, 60], gapMed: 16.7, gapP95: 18, gapMax: 18, slow: 0, angleMed: 5, angleMax: 6 });
    e = NFMProbe.explainSplit(nz, 100000); ok(e.cause === 'hiccups' && /run to run/.test(e.say) && /WebGL 2/.test(e.say), e.say);   /* runs that swing wildly are pauses from the browser, not the way the order is sent */
    e = NFMProbe.explainSplit({ backend: 'webgl2', skipped: 'the page was in the background' }, 30000); ok(e.level === 'warn' && /WebGL 2 was skipped/.test(e.say), e.say);
  });
  if (bad) { console.log(bad + ' failed'); process.exit(1); } console.log('probe tests passed');
})();
