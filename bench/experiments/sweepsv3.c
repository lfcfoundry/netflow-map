/* Copyright (c) 2026 LFC Foundry. MIT License. EXPERIMENT, not built into the app: Distances 3D two pairs at a time. Four-browser timings (docs/BENCHMARKS.md section 29) showed no gain (0.95 to 1.08 times, middle about 1.0), so it is kept here only so nobody has to write it again. To try it, paste it into wasm/stress.c after sweeps3 and select it in stressWasm for dim 3. */
/* Distances 3D, two pairs at a time, as sweepsv is for the flat picture: two neighbors in the shuffled order that share no item run side by side, so the positions are
 * the ones sweeps3 gives, to the last digit (same operations in the same order, one lane per pair). */
EXP("sweepsv3") void sweepsv3(double *X, const i32 *pa, const i32 *pb, const u16 *pc, const float *pdT, const float *pwT, i32 cnt, const double *etas, i32 tmax) {
  for (i32 t = 0; t < tmax; t++) {
    double eta = etas[t]; i32 back = t & 1, q = back ? cnt - 1 : 0, step = back ? -1 : 1; v128_t etav = wasm_f64x2_splat(eta); i32 n = 0;
    for (; n + 1 < cnt; ) {
      i32 q2 = q + step, a1 = pa[q], b1 = pb[q], a2 = pa[q2], b2 = pb[q2];
      if (a1 != a2 && a1 != b2 && b1 != a2 && b1 != b2) {
        i32 c1 = pc[q], c2 = pc[q2], a1i = a1 * 3, b1i = b1 * 3, a2i = a2 * 3, b2i = b2 * 3;
        v128_t mu = clampmu(wasm_f64x2_mul(wasm_f64x2_make((double)pwT[c1], (double)pwT[c2]), etav));
        v128_t dd = wasm_f64x2_make((double)pdT[c1], (double)pdT[c2]);
        v128_t xa = wasm_f64x2_make(X[a1i], X[a2i]), xb = wasm_f64x2_make(X[b1i], X[b2i]), ya = wasm_f64x2_make(X[a1i + 1], X[a2i + 1]), yb = wasm_f64x2_make(X[b1i + 1], X[b2i + 1]);
        v128_t za = wasm_f64x2_make(X[a1i + 2], X[a2i + 2]), zb = wasm_f64x2_make(X[b1i + 2], X[b2i + 2]);
        v128_t dx = wasm_f64x2_sub(xa, xb), dy = wasm_f64x2_sub(ya, yb), dz = wasm_f64x2_sub(za, zb);
        v128_t mag = fixmag(wasm_f64x2_sqrt(wasm_f64x2_add(wasm_f64x2_add(wasm_f64x2_mul(dx, dx), wasm_f64x2_mul(dy, dy)), wasm_f64x2_mul(dz, dz))));
        v128_t r = wasm_f64x2_div(wasm_f64x2_mul(mu, wasm_f64x2_sub(mag, dd)), wasm_f64x2_mul(wasm_f64x2_splat(2.0), mag));
        v128_t rx = wasm_f64x2_mul(r, dx), ry = wasm_f64x2_mul(r, dy), rz = wasm_f64x2_mul(r, dz);
        v128_t nxa = wasm_f64x2_sub(xa, rx), nya = wasm_f64x2_sub(ya, ry), nza = wasm_f64x2_sub(za, rz), nxb = wasm_f64x2_add(xb, rx), nyb = wasm_f64x2_add(yb, ry), nzb = wasm_f64x2_add(zb, rz);
        X[a1i] = wasm_f64x2_extract_lane(nxa, 0); X[a1i + 1] = wasm_f64x2_extract_lane(nya, 0); X[a1i + 2] = wasm_f64x2_extract_lane(nza, 0);
        X[b1i] = wasm_f64x2_extract_lane(nxb, 0); X[b1i + 1] = wasm_f64x2_extract_lane(nyb, 0); X[b1i + 2] = wasm_f64x2_extract_lane(nzb, 0);
        X[a2i] = wasm_f64x2_extract_lane(nxa, 1); X[a2i + 1] = wasm_f64x2_extract_lane(nya, 1); X[a2i + 2] = wasm_f64x2_extract_lane(nza, 1);
        X[b2i] = wasm_f64x2_extract_lane(nxb, 1); X[b2i + 1] = wasm_f64x2_extract_lane(nyb, 1); X[b2i + 2] = wasm_f64x2_extract_lane(nzb, 1);
        q += 2 * step; n += 2;
      } else {
        i32 c = pc[q]; double mu = (double)pwT[c] * eta; if (mu > 1) mu = 1;
        i32 a3 = a1 * 3, b3 = b1 * 3;
        double dx = X[a3] - X[b3], dy = X[a3 + 1] - X[b3 + 1], dz = X[a3 + 2] - X[b3 + 2], mag = __builtin_sqrt(dx * dx + dy * dy + dz * dz);
        if (mag == 0 || mag != mag) mag = 1e-6;
        double r = (mu * (mag - (double)pdT[c])) / (2 * mag), rx = r * dx, ry = r * dy, rz = r * dz;
        X[a3] -= rx; X[a3 + 1] -= ry; X[a3 + 2] -= rz; X[b3] += rx; X[b3 + 1] += ry; X[b3 + 2] += rz;
        q += step; n += 1;
      }
    }
    if (n < cnt) {
      i32 c = pc[q]; double mu = (double)pwT[c] * eta; if (mu > 1) mu = 1;
      i32 a3 = pa[q] * 3, b3 = pb[q] * 3;
      double dx = X[a3] - X[b3], dy = X[a3 + 1] - X[b3 + 1], dz = X[a3 + 2] - X[b3 + 2], mag = __builtin_sqrt(dx * dx + dy * dy + dz * dz);
      if (mag == 0 || mag != mag) mag = 1e-6;
      double r = (mu * (mag - (double)pdT[c])) / (2 * mag), rx = r * dx, ry = r * dy, rz = r * dz;
      X[a3] -= rx; X[a3 + 1] -= ry; X[a3 + 2] -= rz; X[b3] += rx; X[b3 + 1] += ry; X[b3 + 2] += rz;
    }
  }
}
