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

  /** A valid bound on the longest hop count (twice the eccentricity of any item) from four quick walks; the sketch finds a tighter one later, but this lets the card start its table at once. */
  function quickBound(off, nbr, k) {
    var dist = new Int32Array(k), q = new Int32Array(k), src = 0, best = 1e9, r, h, t, u, far, ecc;
    for (r = 0; r < 4; r++) {
      dist.fill(-1); dist[src] = 0; q[0] = src; h = 0; t = 1; far = src; ecc = 0;
      while (h < t) { u = q[h++]; if (dist[u] > ecc) { ecc = dist[u]; far = u; } for (var e = off[u]; e < off[u + 1]; e++) { var w = nbr[e]; if (dist[w] < 0) { dist[w] = dist[u] + 1; q[t++] = w; } } }
      if (ecc < best) best = ecc; src = far;
    }
    return 2 * best;
  }

  /* ------------------------------------------------------------------ GPU programs */
  var BFS_WGSL = [
    'struct B { k: u32, S: u32, b0: u32, level: u32, gr: u32, rows: u32, p1: u32, p2: u32 };',   // b0: first 32-source batch of this group; gr: batches per group (the stride); rows: batches really in this group
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
    '  let v = gid.x / b.gr; let bt = gid.x % b.gr; if (v >= b.k || bt >= b.rows) { return; }',
    '  let lo = (b.b0 + bt) * 32u; var bit = 0u;',
    '  if (v >= lo && v < lo + 32u) { bit = 1u << (v - lo); }',
    '  R[v * b.gr + bt] = bit; Fout[v * b.gr + bt] = bit;',
    '}',
    '@compute @workgroup_size(64)',
    'fn level(@builtin(global_invocation_id) gid: vec3<u32>) {',
    '  let v = gid.x / b.gr; let bt = gid.x % b.gr; if (v >= b.k || bt >= b.rows) { return; }',   // the batches of one item sit side by side in memory: neighboring threads read neighboring words
    '  var acc = 0u;',
    '  let e1 = off[v + 1u];',
    '  for (var e = off[v]; e < e1; e = e + 1u) { acc = acc | Fin[nbr[e] * b.gr + bt]; }',
    '  let ri = v * b.gr + bt; let nw = acc & ~R[ri];',
    '  Fout[ri] = nw; R[ri] = R[ri] | nw;',
    '  if (nw != 0u) {',
    '    let lv = b.level; let row = (v * b.S + (b.b0 + bt) * 32u) >> 2u;',
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

  /* Version 2: no divisions (two small tables in workgroup memory give 1/d^2 and edge/d), one inverse square root per pair, and the j range
     split over several workgroups (small and middle sizes would otherwise leave most of the card idle); a second pass adds the pieces up and
     applies the over-relaxation  x <- x + omega * (target - x). */
  var step2Code = function (tables) { return [
    'struct P { k: u32, S: u32, edge: f32, omega: f32, jchunk: u32, pad1: u32, pad2: u32, pad3: u32 };',
    '@group(0) @binding(0) var<uniform> prm: P;',
    '@group(0) @binding(1) var<storage, read> dm: array<u32>;',
    '@group(0) @binding(2) var<storage, read> pin: array<vec2<f32>>;',
    '@group(0) @binding(3) var<storage, read_write> part: array<vec2<f32>>;',
    '@group(0) @binding(4) var<storage, read> wsum: array<f32>;',
    '@group(0) @binding(5) var<storage, read_write> pout: array<vec2<f32>>;',
    'var<workgroup> tile: array<vec2<f32>, 64>;',
    'var<workgroup> tabA: array<f32, 256>;',
    'var<workgroup> tabB: array<f32, 256>;',
    tables ? 'fn term(xi: vec2<f32>, xj: vec2<f32>, dq: u32) -> vec2<f32> { let dl = xi - xj; return tabA[dq] * xj + (tabB[dq] * inverseSqrt(max(dot(dl, dl), 1e-12))) * dl; }'
           : 'fn term(xi: vec2<f32>, xj: vec2<f32>, dq: u32) -> vec2<f32> { let iv = select(0.0, 1.0 / f32(dq), dq > 0u); let dl = xi - xj; return (iv * iv) * xj + (prm.edge * iv * inverseSqrt(max(dot(dl, dl), 1e-12))) * dl; }',
    '@compute @workgroup_size(64)',
    'fn part4(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>, @builtin(workgroup_id) wid: vec3<u32>) {',
    '  let k = prm.k; let S = prm.S; let last = k - 1u; let i0 = gid.x * 4u;',
    '  for (var t = 0u; t < 4u; t = t + 1u) { let d = lid.x * 4u + t; let fd = f32(d); tabA[d] = select(0.0, 1.0 / (fd * fd), d > 0u); tabB[d] = select(0.0, prm.edge / fd, d > 0u); }',
    '  let x0 = pin[min(i0, last)]; let x1 = pin[min(i0 + 1u, last)]; let x2 = pin[min(i0 + 2u, last)]; let x3 = pin[min(i0 + 3u, last)];',
    '  var a0 = vec2<f32>(0.0, 0.0); var a1 = a0; var a2 = a0; var a3 = a0;',
    '  let jlo = wid.y * prm.jchunk; let jhi = min(k, jlo + prm.jchunk);',
    '  for (var j0 = jlo; j0 < jhi; j0 = j0 + 64u) {',
    '    let jj = j0 + lid.x;',
    '    tile[lid.x] = select(vec2<f32>(0.0, 0.0), pin[min(jj, last)], jj < jhi);',
    '    workgroupBarrier();',
    '    let cnt = min(64u, jhi - j0);',
    '    for (var t = 0u; t < cnt; t = t + 1u) {',
    '      let xj = tile[t]; let word = dm[((j0 + t) * S + i0) >> 2u];',
    '      a0 = a0 + term(x0, xj, word & 255u);',
    '      a1 = a1 + term(x1, xj, (word >> 8u) & 255u);',
    '      a2 = a2 + term(x2, xj, (word >> 16u) & 255u);',
    '      a3 = a3 + term(x3, xj, word >> 24u);',
    '    }',
    '    workgroupBarrier();',
    '  }',
    '  let o = wid.y * k;',
    '  if (i0 < k) { part[o + i0] = a0; }',
    '  if (i0 + 1u < k) { part[o + i0 + 1u] = a1; }',
    '  if (i0 + 2u < k) { part[o + i0 + 2u] = a2; }',
    '  if (i0 + 3u < k) { part[o + i0 + 3u] = a3; }',
    '}',
    '@compute @workgroup_size(64)',
    'fn reduce(@builtin(global_invocation_id) gid: vec3<u32>) {',
    '  let i = gid.x; if (i >= prm.k) { return; }',
    '  let split = (prm.k + prm.jchunk - 1u) / prm.jchunk; var sum = vec2<f32>(0.0, 0.0);',
    '  for (var s = 0u; s < split; s = s + 1u) { sum = sum + part[s * prm.k + i]; }',
    '  let xi = pin[i]; let tg = select(xi, sum / wsum[i], wsum[i] > 0.0);',
    '  pout[i] = xi + prm.omega * (tg - xi);',
    '}'].join('\n'); };

  /** How much memory the tables need for k items: { dBytes, workBytes }. */
  function need(k) { var S = Math.ceil(k / 4) * 4, nb = Math.ceil(k / 32); return { S: S, nb: nb, dBytes: k * S, workBytes: 3 * nb * k * 4 }; }

  /** Ask for a device with the adapter's own large-buffer limits. Returns { device, adapter, info, software } or { error }. */
  async function getDevice() {
    if (!navigator.gpu) return { error: 'This browser has no WebGPU.' };
    var adapter = null, tries = [{ powerPreference: 'high-performance' }, undefined, { powerPreference: 'low-power' }];
    for (var ti = 0; ti < tries.length && !adapter; ti++) { try { adapter = await navigator.gpu.requestAdapter(tries[ti]); } catch (e) { adapter = null; } if (!adapter) await new Promise(function (r) { setTimeout(r, 300); }); }
    if (!adapter) return { error: 'No graphics adapter was offered.', noAdapter: true };
    var info = adapter.info || {}, desc = [info.vendor, info.architecture, info.description || info.device].filter(Boolean).join(' / ');
    var lim = adapter.limits, req = {};
    ['maxStorageBufferBindingSize', 'maxBufferSize', 'maxComputeWorkgroupsPerDimension'].forEach(function (n) { if (lim[n]) req[n] = lim[n]; });
    var device;
    try { device = await adapter.requestDevice({ requiredLimits: req }); } catch (e) { device = await adapter.requestDevice(); }
    var dv = { device: device, adapter: adapter, lostInfo: '' }; device.lost.then(function (i) { dv.lostInfo = (i.reason || '') + ' ' + (i.message || ''); });
    return { device: device, adapter: adapter, get lostInfo() { return dv.lostInfo; }, info: desc || 'unnamed adapter', software: !!adapter.isFallbackAdapter || /swiftshader|llvmpipe|software|lavapipe/i.test(desc), limits: { maxStorageBufferBindingSize: device.limits.maxStorageBufferBindingSize, maxBufferSize: device.limits.maxBufferSize } };
  }

  /** The whole job. opts: { steps (60), kernel ('v2' tables | 'v3' no tables | 'v1' first version), omega (1.2; the over-relaxation x <- x + omega * (target - x). Above about 1.5 the steps can run away on large networks), pivots (60), group (batches of 32 start items walked together, 16),
   *  keepTable (false), snapshots ([] step counts to also read back), profile (false: wait after each phase to time it; the waits cost about 0.1 s each in Firefox) }.
   *  Returns { X (Float32Array 2k), X0 (the sketch), ms: { start, upload, table, weights, steps, read, total }, levels, stride, dTable?, snapshots } or { error }. */
  async function layoutInner(dev, off, nbr, k, EDGE, opts) {
    opts = opts || {}; var device = dev.device, T0 = now(), ms = {}, steps = opts.steps || 60, nd = need(k), lim = dev.limits, kernel = opts.kernel || 'v2', omega = kernel !== 'v1' ? (opts.omega || 1.2) : 1, prof = !!opts.profile;
    if (nd.dBytes > lim.maxStorageBufferBindingSize || nd.dBytes > lim.maxBufferSize) return { error: 'The hop table (' + Math.round(nd.dBytes / 1048576) + ' MB) does not fit in this graphics card\'s largest buffer (' + Math.round(lim.maxStorageBufferBindingSize / 1048576) + ' MB).', tooBig: true };
    var bound = quickBound(off, nbr, k), L = Math.min(254, bound); if (bound > 254) return { error: 'Some hop counts may exceed 254, which one byte cannot hold.', tooLong: true };
    var Sx = nd.S, nb = nd.nb, GB = GPUBufferUsage, GR = Math.max(1, Math.min(nb, opts.group || 16)), ngr = Math.ceil(nb / GR);
    device.pushErrorScope('validation'); device.pushErrorScope('out-of-memory');
    var mk = function (size, usage, data) { var bf = device.createBuffer({ size: Math.max(16, size), usage: usage, mappedAtCreation: !!data }); if (data) { new data.constructor(bf.getMappedRange()).set(data); bf.unmap(); } return bf; };
    var wait = async function () { await device.queue.onSubmittedWorkDone(); };
    var t1 = now();
    var offB = mk(off.length * 4, GB.STORAGE, Uint32Array.from(off)), nbrB = mk(nbr.length * 4, GB.STORAGE, Uint32Array.from(nbr));
    var RB = mk(GR * k * 4, GB.STORAGE), FA = mk(GR * k * 4, GB.STORAGE), FB = mk(GR * k * 4, GB.STORAGE), DM = mk(k * Sx, GB.STORAGE | GB.COPY_SRC), WS = mk(k * 4, GB.STORAGE | GB.COPY_SRC);
    var ua = 256, nblk = ngr * (L + 1), ubuf = new Uint32Array(nblk * ua / 4);   // one block of parameters per (group, level): dynamic offsets
    for (var g0 = 0; g0 < ngr; g0++) for (var lv = 0; lv <= L; lv++) { var o = (g0 * (L + 1) + lv) * ua / 4; ubuf[o] = k; ubuf[o + 1] = Sx; ubuf[o + 2] = g0 * GR; ubuf[o + 3] = lv; ubuf[o + 4] = GR; ubuf[o + 5] = Math.min(GR, nb - g0 * GR); }
    var UB = mk(ubuf.byteLength, GB.UNIFORM, ubuf), SV = GPUShaderStage.COMPUTE;
    var bgl = device.createBindGroupLayout({ entries: [
      { binding: 0, visibility: SV, buffer: { type: 'uniform', hasDynamicOffset: true } },
      { binding: 1, visibility: SV, buffer: { type: 'read-only-storage' } }, { binding: 2, visibility: SV, buffer: { type: 'read-only-storage' } },
      { binding: 3, visibility: SV, buffer: { type: 'storage' } }, { binding: 4, visibility: SV, buffer: { type: 'read-only-storage' } },
      { binding: 5, visibility: SV, buffer: { type: 'storage' } }, { binding: 6, visibility: SV, buffer: { type: 'storage' } }, { binding: 7, visibility: SV, buffer: { type: 'storage' } }] });
    var pl = device.createPipelineLayout({ bindGroupLayouts: [bgl] }), bm = device.createShaderModule({ code: BFS_WGSL });
    var pipe = function (name) { return device.createComputePipeline({ layout: pl, compute: { module: bm, entryPoint: name } }); };
    var pInit = pipe('init'), pLevel = pipe('level'), pW = pipe('weights');
    var bgFor = function (fin, fout) { return device.createBindGroup({ layout: bgl, entries: [{ binding: 0, resource: { buffer: UB, size: 32 } }, { binding: 1, resource: { buffer: offB } }, { binding: 2, resource: { buffer: nbrB } }, { binding: 3, resource: { buffer: RB } }, { binding: 4, resource: { buffer: fin } }, { binding: 5, resource: { buffer: fout } }, { binding: 6, resource: { buffer: DM } }, { binding: 7, resource: { buffer: WS } }] }); };
    var bgAB = bgFor(FA, FB), bgBA = bgFor(FB, FA), gx = Math.ceil(k / 64);
    ms.upload = now() - t1;
    /* the hop table: group after group of 16 batches (512 start items), so the working arrays stay small enough for the card's caches */
    var t2 = now(), enc = null, pass = null, inEnc = 0, perEnc = Math.max(1, Math.floor(2e6 / (k * Math.max(1, L)) ) );   // a new submission after a few groups: no single job runs long
    var flush = function () { if (pass) { pass.end(); device.queue.submit([enc.finish()]); pass = null; enc = null; inEnc = 0; } };
    for (var gi = 0; gi < ngr; gi++) {
      if (!pass) { enc = device.createCommandEncoder(); pass = enc.beginComputePass(); }
      var rows = Math.min(GR, nb - gi * GR), base = gi * (L + 1);
      pass.setPipeline(pInit); pass.setBindGroup(0, bgBA, [base * ua]); pass.dispatchWorkgroups(Math.ceil(k * GR / 64));
      pass.setPipeline(pLevel);
      for (var l = 1; l <= L; l++) { pass.setBindGroup(0, l % 2 ? bgAB : bgBA, [(base + l) * ua]); pass.dispatchWorkgroups(Math.ceil(k * GR / 64)); }
      if (++inEnc >= perEnc) flush();
    }
    if (!pass) { enc = device.createCommandEncoder(); pass = enc.beginComputePass(); }
    pass.setPipeline(pW); pass.setBindGroup(0, bgAB, [0]); pass.dispatchWorkgroups(gx); flush();
    var st = pivotStart(off, nbr, k, EDGE, opts.pivots); ms.start = st.ms;   // the processor makes the sketch while the card builds the table
    if (prof || k >= 12000) { await wait(); ms.table = now() - t2; } else ms.table = null;   // big sizes wait once here so the card is never given more than a moment of queued work
    RB.destroy(); FA.destroy(); FB.destroy();
    /* the steps */
    var t4 = now(), PBdata, sp, spReduce = null, jchunk = 0, split = 1, sg;
    var XA = mk(8 * k, GB.STORAGE | GB.COPY_SRC | GB.COPY_DST, st.X), XB = mk(8 * k, GB.STORAGE | GB.COPY_SRC | GB.COPY_DST), PART = null, PB, stepBG1, stepBG2;
    var f32bits = function (v) { return new Uint32Array(new Float32Array([v]).buffer)[0]; };
    if (kernel === 'v1') {
      var sm = device.createShaderModule({ code: STEP_WGSL }); sp = device.createComputePipeline({ layout: 'auto', compute: { module: sm, entryPoint: 'step4' } });
      PB = mk(16, GB.UNIFORM, new Uint32Array([k, Sx, f32bits(EDGE), 0])); sg = Math.ceil(k / 256);
      var sbg = function (a, b2) { return device.createBindGroup({ layout: sp.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: PB } }, { binding: 1, resource: { buffer: DM } }, { binding: 2, resource: { buffer: a } }, { binding: 3, resource: { buffer: b2 } }, { binding: 4, resource: { buffer: WS } }] }); };
      stepBG1 = sbg(XA, XB); stepBG2 = sbg(XB, XA);
    } else {
      var groups = Math.ceil(k / 256); split = Math.max(1, Math.min(Math.ceil(k / 64), Math.ceil(384 / groups))); jchunk = Math.ceil(Math.ceil(k / split) / 64) * 64; split = Math.ceil(k / jchunk); sg = groups;
      PB = mk(32, GB.UNIFORM, new Uint32Array([k, Sx, f32bits(EDGE), f32bits(omega), jchunk, 0, 0, 0])); PART = mk(split * k * 8, GB.STORAGE);
      var m2 = device.createShaderModule({ code: step2Code(kernel !== 'v3') }), l2 = device.createBindGroupLayout({ entries: [
        { binding: 0, visibility: SV, buffer: { type: 'uniform' } }, { binding: 1, visibility: SV, buffer: { type: 'read-only-storage' } }, { binding: 2, visibility: SV, buffer: { type: 'read-only-storage' } },
        { binding: 3, visibility: SV, buffer: { type: 'storage' } }, { binding: 4, visibility: SV, buffer: { type: 'read-only-storage' } }, { binding: 5, visibility: SV, buffer: { type: 'storage' } }] }), pl2 = device.createPipelineLayout({ bindGroupLayouts: [l2] });
      sp = device.createComputePipeline({ layout: pl2, compute: { module: m2, entryPoint: 'part4' } }); spReduce = device.createComputePipeline({ layout: pl2, compute: { module: m2, entryPoint: 'reduce' } });
      var sbg2 = function (a, b2) { return device.createBindGroup({ layout: l2, entries: [{ binding: 0, resource: { buffer: PB } }, { binding: 1, resource: { buffer: DM } }, { binding: 2, resource: { buffer: a } }, { binding: 3, resource: { buffer: PART } }, { binding: 4, resource: { buffer: WS } }, { binding: 5, resource: { buffer: b2 } }] }); };
      stepBG1 = sbg2(XA, XB); stepBG2 = sbg2(XB, XA);
    }
    var snaps = (opts.snapshots || []).filter(function (x) { return x < steps; }), snapBufs = {};
    snaps.forEach(function (x) { snapBufs[x] = mk(8 * k, GB.COPY_DST | GB.MAP_READ); });
    var perSubmit = Math.max(1, Math.floor(1.5e9 / (k * k))), done = 0, sinceWait = 0, rate = 0;   // one submission is meant to be about 0.1 s of work on a mid-range card; the first one is timed and the size adjusted
    while (done < steps) {
      var upto = Math.min(steps, done + perSubmit); snaps.forEach(function (x) { if (x > done && x < upto) upto = x; });
      var from = done, e2 = device.createCommandEncoder(), p2 = e2.beginComputePass();
      for (; done < upto; done++) {
        var bg = done % 2 ? stepBG2 : stepBG1;
        p2.setPipeline(sp); p2.setBindGroup(0, bg); if (kernel === 'v1') p2.dispatchWorkgroups(sg); else { p2.dispatchWorkgroups(sg, split); p2.setPipeline(spReduce); p2.setBindGroup(0, bg); p2.dispatchWorkgroups(gx); }
      }
      p2.end(); if (snapBufs[done]) e2.copyBufferToBuffer(done % 2 ? XB : XA, 0, snapBufs[done], 0, 8 * k);
      device.queue.submit([e2.finish()]);
      if (k >= 8000 && done < steps) {   // pacing: time the first submission, then wait again whenever about half a second of work is queued
        var nsteps = upto - from;
        if (!rate) { var tq = now(); await wait(); rate = Math.max(0.05, (now() - tq) / nsteps); perSubmit = Math.max(1, Math.min(steps, Math.round(120 / rate))); }
        else { sinceWait += nsteps; if (sinceWait * rate > 900) { await wait(); sinceWait = 0; } }
      }
      if (opts.onProgress) opts.onProgress(done / steps);
    }
    var RD = mk(8 * k, GB.COPY_DST | GB.MAP_READ), e3 = device.createCommandEncoder(); e3.copyBufferToBuffer(done % 2 ? XB : XA, 0, RD, 0, 8 * k);
    var rb = null; if (opts.keepTable) { rb = mk(k * Sx, GB.COPY_DST | GB.MAP_READ); e3.copyBufferToBuffer(DM, 0, rb, 0, k * Sx); }
    if (prof) { await wait(); ms.steps = now() - t4; }
    var t5 = now(); device.queue.submit([e3.finish()]);
    await RD.mapAsync(GPUMapMode.READ); var X = new Float32Array(RD.getMappedRange().slice(0)); RD.unmap();
    if (!prof) ms.steps = now() - t4; ms.read = now() - t5;
    var dTable = null; if (rb) { await rb.mapAsync(GPUMapMode.READ); dTable = new Uint8Array(rb.getMappedRange().slice(0)); rb.unmap(); rb.destroy(); }
    var snapOut = {}; for (var key in snapBufs) { await snapBufs[key].mapAsync(GPUMapMode.READ); snapOut[key] = new Float32Array(snapBufs[key].getMappedRange().slice(0)); snapBufs[key].unmap(); snapBufs[key].destroy(); }
    var oom = await device.popErrorScope(), val = await device.popErrorScope();
    [offB, nbrB, DM, WS, UB, PB, XA, XB, RD].forEach(function (bf) { bf.destroy(); }); if (PART) PART.destroy();
    if (oom || val) return { error: 'The graphics card reported ' + (oom ? 'out of memory: ' + oom.message : 'an error: ' + val.message).slice(0, 200), oom: !!oom };
    ms.total = now() - T0; snapOut[steps] = X;
    return { X: X, X0: st.X, ms: ms, levels: L, stride: Sx, dTable: dTable, snapshots: snapOut, split: split, kernel: kernel, omega: omega };
  }

  /** Same as layoutInner, but any thrown error or message the card reports comes back as { error } instead of an exception. */
  async function layout(dev, off, nbr, k, EDGE, opts) {
    var errs = [], h = function (ev) { errs.push(String(ev.error && ev.error.message || ev.error).slice(0, 220)); }, r;
    dev.device.addEventListener('uncapturederror', h);
    try { r = await layoutInner(dev, off, nbr, k, EDGE, opts); }
    catch (e) { r = { error: 'Stopped: ' + String(e && e.message || e).slice(0, 160), thrown: true }; try { await dev.device.popErrorScope(); await dev.device.popErrorScope(); } catch (e2) { /* scopes already closed */ } }
    dev.device.removeEventListener('uncapturederror', h);
    if (r.error && errs.length) r.error += ' | the card said: ' + errs[0];
    if (r.error && dev.lostInfo) r.error += ' | device lost: ' + dev.lostInfo;
    return r;
  }

  /** The same steps on the CPU in 64-bit numbers from the same start, for the correctness check (small k only). D: k*stride bytes. */
  function majCpu(X0, D, k, stride, EDGE, steps, omega) {
    omega = omega || 1; var cur = Float64Array.from(X0), nxt = new Float64Array(2 * k), ws = new Float64Array(k), i, j, s;
    for (i = 0; i < k; i++) for (j = 0; j < k; j++) { var d0 = D[j * stride + i]; if (d0) ws[i] += 1 / (d0 * d0); }
    for (s = 0; s < steps; s++) {
      for (i = 0; i < k; i++) {
        var ax = 0, ay = 0, xi = cur[2 * i], yi = cur[2 * i + 1];
        for (j = 0; j < k; j++) { var d = D[j * stride + i]; if (!d) continue; var dx = xi - cur[2 * j], dy = yi - cur[2 * j + 1], len = Math.max(Math.sqrt(dx * dx + dy * dy), 1e-6), w = 1 / (d * d), f = d * EDGE / len; ax += w * (cur[2 * j] + f * dx); ay += w * (cur[2 * j + 1] + f * dy); }
        if (ws[i] > 0) { nxt[2 * i] = xi + omega * (ax / ws[i] - xi); nxt[2 * i + 1] = yi + omega * (ay / ws[i] - yi); } else { nxt[2 * i] = xi; nxt[2 * i + 1] = yi; }
      }
      var sw = cur; cur = nxt; nxt = sw;
    }
    return cur;
  }
  return { pivotStart: pivotStart, getDevice: getDevice, layout: layout, majCpu: majCpu, need: need };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = NFMGpuStress;
