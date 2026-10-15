# Net Flow Map Tester results

Version 2026.10.15.1647 · run 2026-10-15T20:49:47.322Z · took 55.1 s

## Your computer

**OK** Graphics-card computing is available on: unnamed adapter.

| Item | Value |
|---|---:|
| Browser | Mozilla/5.0 (rv:159.0) Gecko/20100101 Firefox/159.0 |
| Processor threads | 16 |
| Memory hint (GB) | not shared by this browser |
| Screen | 1536 x 960 at 1.25x |
| Graphics (as the page sees it) | (graphics name removed), or similar |
| Graphics-card computing (WebGPU) | available |
| Graphics adapter | unnamed adapter |
| Largest buffer it allows | 2048 MB |

## Is the graphics-card answer right?

**OK** Yes. The graphics card builds the same hop table as the processor, and its steps give the same picture (distance error 0.145 against 0.145 on the processor).

| Check | Result |
|---|---:|
| Items | 1200 |
| Hop table: entries that differ from the CPU table | 0 of 1440000 |
| Distance error at the start (sketch) | 0.196 |
| After 20 steps, CPU math | 0.145 |
| After 20 steps, graphics card | 0.145 |
| Difference | 0% |
| Average item difference (share of one link) | 0 |

## How fast and how true is the graphics-card version?

**OK** The best graphics-card version was faster in 7 of 7 runs (middle 2.8×), and as true or truer (within 3%) in 7 of 7. Truth: lower is truer.

| Network | Items | Processor time | Processor truth | Old steps time | Old steps truth | One smooth sweep time | truth | App path with the card: whole build time | truth after clean-up | Faster by (app path) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| moderate | 2,000 | 451 ms | 0.149 | 240 ms | 0.153 | 100 ms | 0.155 | - | - | 4.5× |
| moderate | 5,000 | 550 ms | 0.159 | 265 ms | 0.155 | 100 ms | 0.155 | 196 ms | 0.153 | 2.8× |
| moderate | 10,000 | 1.92 s | 0.164 | 413 ms | 0.165 | 602 ms | 0.163 | 526 ms | 0.159 | 3.7× |
| complex | 5,000 | 437 ms | 0.144 | 328 ms | 0.143 | 200 ms | 0.143 | 182 ms | 0.143 | 2.4× |
| complex | 9,999 | 1.69 s | 0.147 | 481 ms | 0.156 | 501 ms | 0.151 | 740 ms | 0.147 | 2.3× |
| moderate | 20,000 | 5.51 s | 0.162 | 1.30 s | 0.166 | 2.81 s | 0.162 | 1.22 s | 0.162 | 4.5× |
| moderate | 30,000 | 2.82 s | 0.211 | 2.62 s | 0.165 | 9.48 s | 0.162 | 2.00 s | 0.165 | 1.4× |

_At 2,000 items the app path with the card's picture did not run._

_Above 20,000 items the app's best quality falls back to the quick sample, so the processor truth there is the quick one._

_Processor time and the app-path time are both whole builds (flow analysis, arrangement, clean-up). The "old steps" and "one smooth sweep" columns are the card's raw picture only: 60-pivot sketch (made while the card builds the table), hop table, steps or sweeps, read-back, without the app's overlap clean-up. The app path uses two smooth sweeps up to 12,500 items and 40 old steps above, then the engine's own spread, push-apart and settle on the card's picture._

## Parallel-pairs variants

**OK** Ran 14 variants; compare time and truth in the table.

| Network | Variant | Total time | Truth |
|---|---:|---:|---:|
| complex 9,999 | one smooth sweep (new default) | 311 ms | 0.151 |
| complex 9,999 | two smooth sweeps | 480 ms | 0.147 |
| complex 9,999 | one smooth sweep + 5 clean-up steps | 281 ms | 0.15 |
| complex 9,999 | one smooth sweep, bigger first step (0.1) | 382 ms | 0.151 |
| complex 9,999 | one smooth sweep, smaller steps (0.02) | 380 ms | 0.155 |
| complex 9,999 | three sweeps, steps shrink per sweep | 582 ms | 0.149 |
| complex 9,999 | old steps, relaxed 1.2, 40 | 279 ms | 0.156 |
| moderate 10,000 | one smooth sweep (new default) | 274 ms | 0.163 |
| moderate 10,000 | two smooth sweeps | 381 ms | 0.163 |
| moderate 10,000 | three smooth sweeps | 482 ms | 0.163 |
| moderate 10,000 | one smooth sweep + 5 clean-up steps | 281 ms | 0.163 |
| moderate 10,000 | three sweeps, steps shrink per sweep | 483 ms | 0.161 |
| moderate 30,000 | one smooth sweep | 6.55 s | 0.162 |
| moderate 30,000 | old steps, relaxed 1.2, 40 | 1.67 s | 0.165 |
| moderate 10,000 | parts (parallel pairs): sketch / setup / table+weights / sweeps / read-back | 56 / 1 / 162 / 302 / 101 ms |  |

## Raw data

```json
{
 "version": "2026.10.15.1647",
 "quick": false,
 "info": {
  "ua": "Mozilla/5.0 (rv:159.0) Gecko/20100101 Firefox/159.0",
  "threads": 16,
  "mem": null,
  "gpu": "unnamed adapter",
  "gl": "(graphics name removed), or similar",
  "soft": false,
  "bufMB": 2048
 },
 "correct": {
  "table": true,
  "steps": true,
  "bad": 0,
  "diffPct": 0,
  "move": 0,
  "sgdDiffPct": 0,
  "sgdMove": 0,
  "sgdOk": true
 },
 "ladder": [
  {
   "kind": "moderate",
   "n": 2000,
   "cpuMs": 451,
   "cpuTruth": 0.149,
   "gpuMs": 240,
   "gpuTruth": 0.153,
   "sgdMs": 100,
   "sgdTruth": 0.155,
   "sgdError": null,
   "appMs": null,
   "appTruth": null,
   "appMethod": null,
   "appGpuMs": null,
   "parts": {
    "sketch": 11,
    "setup": 0,
    "stepsAndTable": 28,
    "read": 28
   },
   "sgdParts": {
    "stepsAndTable": 86,
    "read": 86
   },
   "split": 32,
   "levels": 16,
   "t20": 0.155,
   "t30": 0.154
  },
  {
   "kind": "moderate",
   "n": 5000,
   "cpuMs": 550,
   "cpuTruth": 0.159,
   "gpuMs": 265,
   "gpuTruth": 0.155,
   "sgdMs": 100,
   "sgdTruth": 0.155,
   "sgdError": null,
   "appMs": 196,
   "appTruth": 0.153,
   "appMethod": "sgd 2 sweeps",
   "appGpuMs": 139,
   "parts": {
    "sketch": 27,
    "setup": 1,
    "stepsAndTable": 36,
    "read": 36
   },
   "sgdParts": {
    "stepsAndTable": 70,
    "read": 69
   },
   "split": 20,
   "levels": 16,
   "t20": 0.156,
   "t30": 0.155
  },
  {
   "kind": "moderate",
   "n": 10000,
   "cpuMs": 1923,
   "cpuTruth": 0.164,
   "gpuMs": 413,
   "gpuTruth": 0.165,
   "sgdMs": 602,
   "sgdTruth": 0.163,
   "sgdError": null,
   "appMs": 526,
   "appTruth": 0.159,
   "appMethod": "sgd 2 sweeps",
   "appGpuMs": 440,
   "parts": {
    "sketch": 61,
    "setup": 1,
    "stepsAndTable": 148,
    "read": 100
   },
   "sgdParts": {
    "stepsAndTable": 544,
    "read": 201
   },
   "split": 10,
   "levels": 18,
   "t20": 0.168,
   "t30": 0.166
  },
  {
   "kind": "complex",
   "n": 5000,
   "cpuMs": 437,
   "cpuTruth": 0.144,
   "gpuMs": 328,
   "gpuTruth": 0.143,
   "sgdMs": 200,
   "sgdTruth": 0.143,
   "sgdError": null,
   "appMs": 182,
   "appTruth": 0.143,
   "appMethod": "sgd 2 sweeps",
   "appGpuMs": 125,
   "parts": {
    "sketch": 28,
    "setup": 2,
    "stepsAndTable": 96,
    "read": 96
   },
   "sgdParts": {
    "stepsAndTable": 140,
    "read": 139
   },
   "split": 20,
   "levels": 10,
   "t20": 0.144,
   "t30": 0.143
  },
  {
   "kind": "complex",
   "n": 9999,
   "cpuMs": 1692,
   "cpuTruth": 0.147,
   "gpuMs": 481,
   "gpuTruth": 0.156,
   "sgdMs": 501,
   "sgdTruth": 0.151,
   "sgdError": null,
   "appMs": 740,
   "appTruth": 0.147,
   "appMethod": "sgd 2 sweeps",
   "appGpuMs": 617,
   "parts": {
    "sketch": 62,
    "setup": 0,
    "stepsAndTable": 217,
    "read": 101
   },
   "sgdParts": {
    "stepsAndTable": 445,
    "read": 101
   },
   "split": 10,
   "levels": 8,
   "t20": 0.158,
   "t30": 0.157
  },
  {
   "kind": "moderate",
   "n": 20000,
   "cpuMs": 5514,
   "cpuTruth": 0.162,
   "gpuMs": 1304,
   "gpuTruth": 0.166,
   "sgdMs": 2814,
   "sgdTruth": 0.162,
   "sgdError": null,
   "appMs": 1219,
   "appTruth": 0.162,
   "appMethod": "smacof 40 steps",
   "appGpuMs": 962,
   "parts": {
    "sketch": 124,
    "setup": 2,
    "stepsAndTable": 502,
    "read": 99
   },
   "sgdParts": {
    "stepsAndTable": 2313,
    "read": 100
   },
   "split": 5,
   "levels": 18,
   "t20": 0.17,
   "t30": 0.167
  },
  {
   "kind": "moderate",
   "n": 30000,
   "cpuMs": 2816,
   "cpuTruth": 0.211,
   "gpuMs": 2619,
   "gpuTruth": 0.165,
   "sgdMs": 9482,
   "sgdTruth": 0.162,
   "sgdError": null,
   "appMs": 2003,
   "appTruth": 0.165,
   "appMethod": "smacof 40 steps",
   "appGpuMs": 1718,
   "parts": {
    "sketch": 220,
    "setup": 3,
    "stepsAndTable": 1309,
    "read": 303
   },
   "sgdParts": {
    "stepsAndTable": 8439,
    "read": 402
   },
   "split": 4,
   "levels": 18,
   "t20": 0.168,
   "t30": 0.166
  }
 ],
 "kernels": {
  "n": 10000,
  "variants": [
   {
    "kind": "complex",
    "n": 9999,
    "variant": "one smooth sweep (new default)",
    "totalMs": 311,
    "truth": 0.151,
    "split": 1
   },
   {
    "kind": "complex",
    "n": 9999,
    "variant": "two smooth sweeps",
    "totalMs": 480,
    "truth": 0.147,
    "split": 1
   },
   {
    "kind": "complex",
    "n": 9999,
    "variant": "one smooth sweep + 5 clean-up steps",
    "totalMs": 281,
    "truth": 0.15,
    "split": 10
   },
   {
    "kind": "complex",
    "n": 9999,
    "variant": "one smooth sweep, bigger first step (0.1)",
    "totalMs": 382,
    "truth": 0.151,
    "split": 1
   },
   {
    "kind": "complex",
    "n": 9999,
    "variant": "one smooth sweep, smaller steps (0.02)",
    "totalMs": 380,
    "truth": 0.155,
    "split": 1
   },
   {
    "kind": "complex",
    "n": 9999,
    "variant": "three sweeps, steps shrink per sweep",
    "totalMs": 582,
    "truth": 0.149,
    "split": 1
   },
   {
    "kind": "complex",
    "n": 9999,
    "variant": "old steps, relaxed 1.2, 40",
    "totalMs": 279,
    "truth": 0.156,
    "split": 10
   },
   {
    "kind": "moderate",
    "n": 10000,
    "variant": "one smooth sweep (new default)",
    "totalMs": 274,
    "truth": 0.163,
    "split": 1
   },
   {
    "kind": "moderate",
    "n": 10000,
    "variant": "two smooth sweeps",
    "totalMs": 381,
    "truth": 0.163,
    "split": 1
   },
   {
    "kind": "moderate",
    "n": 10000,
    "variant": "three smooth sweeps",
    "totalMs": 482,
    "truth": 0.163,
    "split": 1
   },
   {
    "kind": "moderate",
    "n": 10000,
    "variant": "one smooth sweep + 5 clean-up steps",
    "totalMs": 281,
    "truth": 0.163,
    "split": 10
   },
   {
    "kind": "moderate",
    "n": 10000,
    "variant": "three sweeps, steps shrink per sweep",
    "totalMs": 483,
    "truth": 0.161,
    "split": 1
   },
   {
    "kind": "moderate",
    "n": 30000,
    "variant": "one smooth sweep",
    "totalMs": 6547,
    "truth": 0.162,
    "split": 1
   },
   {
    "kind": "moderate",
    "n": 30000,
    "variant": "old steps, relaxed 1.2, 40",
    "totalMs": 1671,
    "truth": 0.165,
    "split": 4
   }
  ],
  "parts": {
   "sketch": 56,
   "setup": 1,
   "tableAndWeights": 162,
   "steps60": 302,
   "read": 101,
   "levels": 18
  }
 },
 "groups": null,
 "cold": null,
 "small": null
}
```
