/* Copyright (c) 2026 LFC Foundry. MIT License.
 * Research prototype (not in the app): the "best quality" Distances arrangement done on the graphics card with WebGPU.
 *   1. CPU, about 0.1 s: a 60-pivot sketch (Pivot MDS: breadth-first walks from 60 spread-out items, double-centered, top two directions).
 *   2. GPU: the hop-count table of every pair (bit-parallel breadth-first walks, 32 starting items per word, one byte per pair).
 *   3. GPU: stress majorization steps (SMACOF, Jacobi form): every item moves to the weighted mean of where each other item wants it,
 *      weights 1/hops^2, which is exactly the "truth" score the benchmarks use. 4 items per thread, positions shared through workgroup memory.
 * Works on one connected piece. Browser only (needs navigator.gpu). Global: NFMGpuStress.
 */
var NFMGpuStress = (function () {
  'use strict';
  var now = function () { return performance.now(); };

  /* ------------------------------------------------------------------ CPU: the sketch */
  /** off/nbr: compressed adjacency of one connected piece with k items. Returns { X (2k floats, page units), minEcc (a bound: no hop count exceeds 2 * minEcc), ms }. */
  function pivotStart(off, nbr, k, EDGE, pivots) {
    var t0 = now(), p = Math.min(pivots || 60, k), C = new Float64Array(k * p), minD = new Float64Array(k).fill(1e9), dist = new Int32Array(k), q = new Int32Array(k), piv = 0, c, j, a, b, h, t, u, minEcc = 1e9;
    for (c = 0; c < p; c++) {
      dist.fill(-1); dist[piv] = 0; q[0] = piv; h = 0; t = 1;
      while (h < t) { u = q[h++]; for (var e = off[u]; e < off[u + 1]; e++) { var w = nbr[e]; if (dist[w] < 0) { dist[w] = dist[u] + 1; q[t++] = w; } } }
      var far = 0, fd = -1, ecc = 0;
      for (j = 0; j < k; j++) { var d = dist[j] < 0 ? 0 : dist[j]; if (d > ecc) ecc = d; C[j * p + c] = d * d; if (d < minD[j]) minD[j] = d; if (minD[j] > fd) { fd = minD[j]; far = j; } }
      if (ecc < minEcc) minEcc = ecc;
      piv = far;
    }
    var rm = new Float64Array(k), cm = new Float64Array(p), gm = 0, v;
    for (j = 0; j < k; j++) for (c = 0; c < p; c++) { v = C[j * p + c]; rm[j] += v / p; cm[c] += v / k; gm += v / (k * p); }
    for (j = 0; j < k; j++) for (c = 0; c < p; c++) C[j * p + c] = -0.5 * (C[j * p + c] - rm[j] - cm[c] + gm);
    var M = new Float64Array(p * p), sum;
    for (a = 0; a < p; a++) for (b = a; b < p; b++) { sum = 0; for (j = 0; j < k; j++) sum += C[j * p + a] * C[j * p + b]; M[a * p + b] = M[b * p + a] = sum; }
    var vecs = [], X = new Float32Array(2 * k), e2, it, i2;
    for (e2 = 0; e2 < 2; e2++) {
      var vv = new Float64Array(p); for (i2 = 0; i2 < p; i2++) vv[i2] = Math.sin(i2 * 1.3 + e2 + 1);
      for (it = 0; it < 200; it++) {
        var ww = new Float64Array(p);
        for (a = 0; a < p; a++) { sum = 0; for (b = 0; b < p; b++) sum += M[a * p + b] * vv[b]; ww[a] = sum; }
        vecs.forEach(function (uv) { var dot = 0, ii; for (ii = 0; ii < p; ii++) dot += ww[ii] * uv[ii]; for (ii = 0; ii < p; ii++) ww[ii] -= dot * uv[ii]; });
        var nn = 0; for (i2 = 0; i2 < p; i2++) nn += ww[i2] * ww[i2]; nn = Math.sqrt(nn) || 1; for (i2 = 0; i2 < p; i2++) vv[i2] = ww[i2] / nn;
      }
      vecs.push(vv);
    }
    var raw = new Float64Array(2 * k);
    for (j = 0; j < k; j++) for (e2 = 0; e2 < 2; e2++) { sum = 0; for (c = 0; c < p; c++) sum += C[j * p + c] * vecs[e2][c]; raw[2 * j + e2] = sum; }
    /* scale: best fit of page distance to hop count over the pivot columns (a sample of items) */
    var num = 0, den = 0, step = Math.max(1, k >> 8), pc;
    /* hop counts of the first pivot's column are in C only after centering, so walk once more from a few items for the fit */
    for (pc = 0; pc < Math.min(8, p); pc++) {
      var src = Math.floor(pc * k / Math.min(8, p)); dist.fill(-1); dist[src] = 0; q[0] = src; h = 0; t = 1;
      while (h < t) { u = q[h++]; for (var e3 = off[u]; e3 < off[u + 1]; e3++) { var w3 = nbr[e3]; if (dist[w3] < 0) { dist[w3] = dist[u] + 1; q[t++] = w3; } } }
      for (j = 0; j < k; j += step) { var dd = dist[j]; if (dd <= 0) continue; var ex = raw[2 * j] - raw[2 * src], ey = raw[2 * j + 1] - raw[2 * src + 1], el = Math.sqrt(ex * ex + ey * ey); num += el / dd; den += el * el / (dd * dd); }
    }
    var sc = den > 0 ? EDGE * num / den : 1;
    for (j = 0; j < 2 * k; j++) X[j] = raw[j] * sc;
    return { X: X, minEcc: minEcc, ms: now() - t0 };
  }

  /* ------------------------------------------------------------------ GPU programs */
  var BFS_WGSL = [
    'struct B { k: u32, S: u32, nb: u32, level: u32 };',
    '@group(0) @binding(0) var<uniform> b: B;',
    '@group(0) @binding(1) var<storage, read> off: array<u32>;',
    '@group(0) @binding(2) var<storage, read> nbr: array<u32>;',
    '@group(0) @binding(3) var<storage, read_write> R: array<u32>;',
    '@group(0) @binding(4) var<storage, read> Fin: array<u32>;',
    '@group(0) @binding(5) var<storage, read_write> Fout: array<u32>;',
    '@group(0) @binding(6) var<storage, read_write> dm: array<u32>;',
    '@group(0) @binding(7) var<storage, read_write> wsum: array<f32>;',
    '@compute @workgroup_size(64)',
    'fn init(@builtin(global_invocation_id) gid: vec3<u32>) {',
    '  let v = gid.x; let bt = gid.y; if (v >= b.k) { return; }',
    '  let lo = bt * 32u; var bit = 0u;',
    '  if (v >= lo && v < lo + 32u) { bit = 1u << (v - lo); }',
    '  R[bt * b.k + v] = bit; Fout[bt * b.k + v] = bit;',
    '}',
    '@compute @workgroup_size(64)',
    'fn level(@builtin(global_invocation_id) gid: vec3<u32>) {',
    '  let v = gid.x; let bt = gid.y; if (v >= b.k) { return; }',
    '  let base = bt * b.k; var acc = 0u;',
    '  let e1 = off[v + 1u];',
    '  for (var e = off[v]; e < e1; e = e + 1u) { acc = acc | Fin[base + nbr[e]]; }',
    '  let nw = acc & ~R[base + v];',
    '  Fout[base + v] = nw; R[base + v] = R[base + v] | nw;',
    '  if (nw != 0u) {',
    '    let lv = b.level; let row = (v * b.S + bt * 32u) >> 2u;',
    '    for (var w = 0u; w < 8u; w = w + 1u) {',
    '      let bits = (nw >> (w * 4u)) & 15u;',
    '      if (bits != 0u) {',
    '        var word = 0u;',
    '        word = word | select(0u, lv, (bits & 1u) != 0u);',
    '        word = word | select(0u, lv << 8u, (bits & 2u) != 0u);',
    '        word = word | select(0u, lv << 16u, (bits & 4u) != 0u);',
    '        word = word | select(0u, lv << 24u, (bits & 8u) != 0u);',
    '        dm[row + w] = dm[row + w] | word;',
    '      }',
    '    }',
    '  }',
    '}',
    '@compute @workgroup_size(64)',
    'fn weights(@builtin(global_invocation_id) gid: vec3<u32>) {',
    '  let i = gid.x; if (i >= b.k) { return; }',
    '  var s = 0.0;',
    '  for (var j = 0u; j < b.k; j = j + 1u) {',
    '    let idx = j * b.S + i; let d = f32((dm[idx >> 2u] >> ((idx & 3u) * 8u)) & 255u);',
    '    if (d > 0.0) { s = s + 1.0 / (d * d); }',
    '  }',
    '  wsum[i] = s;',
    '}'].join('\n');

  var STEP_WGSL = [
    'struct P { k: u32, S: u32, edge: f32, pad: u32 };',
    '@group(0) @binding(0) var<uniform> prm: P;',
    '@group(0) @binding(1) var<storage, read> dm: array<u32>;',
    '@group(0) @binding(2) var<storage, read> pin: array<vec2<f32>>;',
    '@group(0) @binding(3) var<storage, read_write> pout: array<vec2<f32>>;',
    '@group(0) @binding(4) var<storage, read> wsum: array<f32>;',
    'var<workgroup> tile: array<vec2<f32>, 64>;',
    'fn contrib(xi: vec2<f32>, xj: vec2<f32>, d: f32) -> vec2<f32> {',
    '  let dl = xi - xj; let len = max(length(dl), 1e-6);',
    '  let inv = select(0.0, 1.0 / (d * d), d > 0.0);',
    '  return inv * (xj + (d * prm.edge / len) * dl);',
    '}',
    '@compute @workgroup_size(64)',
    'fn step4(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {',
    '  let k = prm.k; let S = prm.S; let last = k - 1u; let i0 = gid.x * 4u;',
    '  let x0 = pin[min(i0, last)]; let x1 = pin[min(i0 + 1u, last)]; let x2 = pin[min(i0 + 2u, last)]; let x3 = pin[min(i0 + 3u, last)];',
    '  var a0 = vec2<f32>(0.0, 0.0); var a1 = a0; var a2 = a0; var a3 = a0;',
    '  for (var j0 = 0u; j0 < k; j0 = j0 + 64u) {',
    '    let jj = j0 + lid.x;',
    '    tile[lid.x] = select(vec2<f32>(0.0, 0.0), pin[min(jj, last)], jj < k);',
    '    workgroupBarrier();',
    '    let cnt = min(64u, k - j0);',
    '    for (var t = 0u; t < cnt; t = t + 1u) {',
    '      let xj = tile[t]; let word = dm[((j0 + t) * S + i0) >> 2u];',
    '      a0 = a0 + contrib(x0, xj, f32(word & 255u));',
    '      a1 = a1 + contrib(x1, xj, f32((word >> 8u) & 255u));',
    '      a2 = a2 + contrib(x2, xj, f32((word >> 16u) & 255u));',
    '      a3 = a3 + contrib(x3, xj, f32((word >> 24u) & 255u));',
    '    }',
    '    workgroupBarrier();',
    '  }',
    '  if (i0 < k) { pout[i0] = select(x0, a0 / wsum[i0], wsum[i0] > 0.0); }',
    '  if (i0 + 1u < k) { pout[i0 + 1u] = select(x1, a1 / wsum[i0 + 1u], wsum[i0 + 1u] > 0.0); }',
    '  if (i0 + 2u < k) { pout[i0 + 2u] = select(x2, a2 / wsum[i0 + 2u], wsum[i0 + 2u] > 0.0); }',
    '  if (i0 + 3u < k) { pout[i0 + 3u] = select(x3, a3 / wsum[i0 + 3u], wsum[i0 + 3u] > 0.0); }',
    '}'].join('\n');

  /** How much memory the tables need for k items: { dBytes, workBytes }. */
  function need(k) { var S = Math.ceil(k / 4) * 4, nb = Math.ceil(k / 32); return { S: S, nb: nb, dBytes: k * S, workBytes: 3 * nb * k * 4 }; }

  /** Ask for a device with the adapter's own large-buffer limits. Returns { device, adapter, info, software } or { error }. */
  async function getDevice() {
    if (!navigator.gpu) return { error: 'This browser has no WebGPU.' };
    var adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) return { error: 'No graphics adapter was offered.' };
    var info = adapter.info || {}, desc = [info.vendor, info.architecture, info.description || info.device].filter(Boolean).join(' / ');
    var lim = adapter.limits, req = {};
    ['maxStorageBufferBindingSize', 'maxBufferSize', 'maxComputeWorkgroupsPerDimension'].forEach(function (n) { if (lim[n]) req[n] = lim[n]; });
    var device;
    try { device = await adapter.requestDevice({ requiredLimits: req }); } catch (e) { device = await adapter.requestDevice(); }
    return { device: device, adapter: adapter, info: desc || 'unnamed adapter', software: !!adapter.isFallbackAdapter || /swiftshader|llvmpipe|software|lavapipe/i.test(desc), limits: { maxStorageBufferBindingSize: device.limits.maxStorageBufferBindingSize, maxBufferSize: device.limits.maxBufferSize } };
  }

  /** The whole job. opts: { steps (60), pivots (60), keepTable (false), chunk (steps per submit; 0 = by size), onProgress }.
   *  Returns { X (Float32Array 2k), ms: { start, upload, table, weights, steps, read, total }, levels, dTable? } or { error, tooBig }. */
  async function layout(dev, off, nbr, k, EDGE, opts) {
    opts = opts || {}; var device = dev.device, T0 = now(), ms = {}, steps = opts.steps || 60, nd = need(k), lim = dev.limits;
    if (nd.dBytes > lim.maxStorageBufferBindingSize || nd.workBytes / 3 > lim.maxStorageBufferBindingSize || nd.dBytes > lim.maxBufferSize) return { error: 'The hop table (' + Math.round(nd.dBytes / 1048576) + ' MB) does not fit in this graphics card\'s largest buffer (' + Math.round(lim.maxStorageBufferBindingSize / 1048576) + ' MB).', tooBig: true };
    var st = pivotStart(off, nbr, k, EDGE, opts.pivots); ms.start = st.ms;
    var L = Math.min(254, 2 * st.minEcc); if (2 * st.minEcc > 254) return { error: 'Some hop counts exceed 254, which one byte cannot hold.', tooLong: true };
    var Sx = nd.S, nb = nd.nb, GB = GPUBufferUsage;
    var mk = function (size, usage, data) { var bf = device.createBuffer({ size: Math.max(16, size), usage: usage, mappedAtCreation: !!data }); if (data) { new data.constructor(bf.getMappedRange()).set(data); bf.unmap(); } return bf; };
    var t1 = now();
    var offB = mk(off.length * 4, GB.STORAGE, Uint32Array.from(off)), nbrB = mk(nbr.length * 4, GB.STORAGE, Uint32Array.from(nbr));
    var RB = mk(nb * k * 4, GB.STORAGE), FA = mk(nb * k * 4, GB.STORAGE), FB = mk(nb * k * 4, GB.STORAGE), DM = mk(k * Sx, GB.STORAGE | GB.COPY_SRC), WS = mk(k * 4, GB.STORAGE | GB.COPY_SRC);
    var ua = 256, ubuf = new Uint32Array((L + 2) * ua / 4);   // one block of parameters per level (dynamic offsets)
    for (var lv = 0; lv <= L + 1; lv++) { ubuf[lv * ua / 4] = k; ubuf[lv * ua / 4 + 1] = Sx; ubuf[lv * ua / 4 + 2] = nb; ubuf[lv * ua / 4 + 3] = lv; }
    var UB = mk(ubuf.byteLength, GB.UNIFORM, ubuf);
    var bgl = device.createBindGroupLayout({ entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform', hasDynamicOffset: true } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }, { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
      { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }, { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
      { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }, { binding: 6, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }, { binding: 7, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }] });
    var pl = device.createPipelineLayout({ bindGroupLayouts: [bgl] }), bm = device.createShaderModule({ code: BFS_WGSL });
    var pipe = function (name) { return device.createComputePipeline({ layout: pl, compute: { module: bm, entryPoint: name } }); };
    var pInit = pipe('init'), pLevel = pipe('level'), pW = pipe('weights');
    var bgFor = function (fin, fout) { return device.createBindGroup({ layout: bgl, entries: [{ binding: 0, resource: { buffer: UB, size: 16 } }, { binding: 1, resource: { buffer: offB } }, { binding: 2, resource: { buffer: nbrB } }, { binding: 3, resource: { buffer: RB } }, { binding: 4, resource: { buffer: fin } }, { binding: 5, resource: { buffer: fout } }, { binding: 6, resource: { buffer: DM } }, { binding: 7, resource: { buffer: WS } }] }); };
    var bgAB = bgFor(FA, FB), bgBA = bgFor(FB, FA), gx = Math.ceil(k / 64);
    ms.upload = now() - t1;
    var t2 = now(), enc = device.createCommandEncoder(), pass = enc.beginComputePass();
    pass.setPipeline(pInit); pass.setBindGroup(0, bgBA, [0]); pass.dispatchWorkgroups(gx, nb);   // writes the starting frontier into FA
    pass.setPipeline(pLevel);
    for (var l = 1; l <= L; l++) { pass.setBindGroup(0, l % 2 ? bgAB : bgBA, [l * ua]); pass.dispatchWorkgroups(gx, nb); }
    pass.end(); device.queue.submit([enc.finish()]); await device.queue.onSubmittedWorkDone(); ms.table = now() - t2;
    var t3 = now(); enc = device.createCommandEncoder(); pass = enc.beginComputePass(); pass.setPipeline(pW); pass.setBindGroup(0, bgAB, [0]); pass.dispatchWorkgroups(gx); pass.end(); device.queue.submit([enc.finish()]); await device.queue.onSubmittedWorkDone(); ms.weights = now() - t3;
    RB.destroy(); FA.destroy(); FB.destroy();
    /* the majorization steps */
    var t4 = now(), sm = device.createShaderModule({ code: STEP_WGSL }), sp = device.createComputePipeline({ layout: 'auto', compute: { module: sm, entryPoint: 'step4' } });
    var PB = mk(16, GB.UNIFORM, new Uint32Array([k, Sx, new Uint32Array(new Float32Array([EDGE]).buffer)[0], 0]));
    var XA = mk(8 * k, GB.STORAGE | GB.COPY_SRC | GB.COPY_DST, st.X), XB = mk(8 * k, GB.STORAGE | GB.COPY_SRC | GB.COPY_DST);
    var sbg = function (a, b2) { return device.createBindGroup({ layout: sp.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: PB } }, { binding: 1, resource: { buffer: DM } }, { binding: 2, resource: { buffer: a } }, { binding: 3, resource: { buffer: b2 } }, { binding: 4, resource: { buffer: WS } }] }); };
    var s1 = sbg(XA, XB), s2 = sbg(XB, XA), RD = mk(8 * k, GB.COPY_DST | GB.MAP_READ), done = 0, sg = Math.ceil(k / 256);
    var chunk = opts.chunk || Math.max(1, Math.min(steps, Math.floor(4e8 / (k * k)) || 1)), snaps = opts.snapshots || [], snapOut = {};
    var readX = async function () { var e = device.createCommandEncoder(); e.copyBufferToBuffer(done % 2 ? XB : XA, 0, RD, 0, 8 * k); device.queue.submit([e.finish()]); await RD.mapAsync(GPUMapMode.READ); var out = new Float32Array(RD.getMappedRange().slice(0)); RD.unmap(); return out; };
    while (done < steps) {
      var upto = Math.min(steps, done + chunk), nextSnap = snaps.filter(function (s) { return s > done && s < upto; })[0]; if (nextSnap) upto = nextSnap;
      var e2 = device.createCommandEncoder(), p2 = e2.beginComputePass(); p2.setPipeline(sp);
      for (; done < upto; done++) { p2.setBindGroup(0, done % 2 ? s2 : s1); p2.dispatchWorkgroups(sg); }
      p2.end(); device.queue.submit([e2.finish()]); await device.queue.onSubmittedWorkDone();
      if (snaps.indexOf(done) >= 0 && done < steps) snapOut[done] = await readX();
      if (opts.onProgress) opts.onProgress(done / steps);
    }
    ms.steps = now() - t4; var t5 = now();
    var X = await readX(); ms.read = now() - t5;
    var dTable = null;
    if (opts.keepTable) { var rb = mk(k * Sx, GB.COPY_DST | GB.MAP_READ), e3 = device.createCommandEncoder(); e3.copyBufferToBuffer(DM, 0, rb, 0, k * Sx); device.queue.submit([e3.finish()]); await rb.mapAsync(GPUMapMode.READ); dTable = new Uint8Array(rb.getMappedRange().slice(0)); rb.unmap(); rb.destroy(); }
    [offB, nbrB, DM, WS, UB, PB, XA, XB, RD].forEach(function (bf) { bf.destroy(); });
    ms.total = now() - T0; snapOut[steps] = X;
    return { X: X, X0: st.X, ms: ms, levels: L, stride: Sx, dTable: dTable, snapshots: snapOut };
  }

  /** The same steps on the CPU in 64-bit numbers from the same start, for the correctness check (small k only). D: k*stride bytes. */
  function majCpu(X0, D, k, stride, EDGE, steps) {
    var cur = Float64Array.from(X0), nxt = new Float64Array(2 * k), ws = new Float64Array(k), i, j, s;
    for (i = 0; i < k; i++) for (j = 0; j < k; j++) { var d0 = D[j * stride + i]; if (d0) ws[i] += 1 / (d0 * d0); }
    for (s = 0; s < steps; s++) {
      for (i = 0; i < k; i++) {
        var ax = 0, ay = 0, xi = cur[2 * i], yi = cur[2 * i + 1];
        for (j = 0; j < k; j++) { var d = D[j * stride + i]; if (!d) continue; var dx = xi - cur[2 * j], dy = yi - cur[2 * j + 1], len = Math.max(Math.sqrt(dx * dx + dy * dy), 1e-6), w = 1 / (d * d), f = d * EDGE / len; ax += w * (cur[2 * j] + f * dx); ay += w * (cur[2 * j + 1] + f * dy); }
        if (ws[i] > 0) { nxt[2 * i] = ax / ws[i]; nxt[2 * i + 1] = ay / ws[i]; } else { nxt[2 * i] = xi; nxt[2 * i + 1] = yi; }
      }
      var sw = cur; cur = nxt; nxt = sw;
    }
    return cur;
  }
  return { pivotStart: pivotStart, getDevice: getDevice, layout: layout, majCpu: majCpu, need: need };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = NFMGpuStress;
