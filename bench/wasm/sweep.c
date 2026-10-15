/* Copyright (c) 2026 JNFoo. MIT License. Experiment only: the stress layout's inner loop in C, built to WebAssembly (see bench/wasm/README in docs/BENCHMARKS.md). */
typedef int i32;
__attribute__((export_name("sweep")))
void sweep(double *X, const i32 *pa, const i32 *pb, const float *pd, const float *pw, i32 cnt, double eta, i32 back) {
  i32 q = back ? cnt - 1 : 0, step = back ? -1 : 1;
  for (i32 n = 0; n < cnt; n++, q += step) {
    double mu = (double)pw[q] * eta; if (mu > 1) mu = 1;
    i32 a2 = pa[q] * 2, b2 = pb[q] * 2;
    double dx = X[a2] - X[b2], dy = X[a2 + 1] - X[b2 + 1], mag = __builtin_sqrt(dx * dx + dy * dy);
    if (mag == 0) mag = 1e-6;
    double r = (mu * (mag - (double)pd[q])) / (2 * mag), rx = r * dx, ry = r * dy;
    X[a2] -= rx; X[a2 + 1] -= ry; X[b2] += rx; X[b2 + 1] += ry;
  }
}
