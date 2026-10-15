# Net Flow Map Tester results

Version 2026.10.15.1641 · run 2026-10-15T20:45:06.971Z · took 43.5 s

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

**OK** The best graphics-card version was faster in 7 of 7 runs (middle 5.2×), and as true or truer (within 3%) in 7 of 7. Truth: lower is truer.

| Network | Items | Processor time | Processor truth | Old steps time | Old steps truth | Parallel pairs time | truth | Three-sweep version time | truth | Best card faster by |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| moderate | 2,000 | 452 ms | 0.149 | 233 ms | 0.153 | 100 ms | 0.155 | 102 ms | 0.154 | 4.5× |
| moderate | 5,000 | 516 ms | 0.159 | 321 ms | 0.155 | 100 ms | 0.155 | 202 ms | 0.156 | 5.2× |
| moderate | 10,000 | 1.64 s | 0.164 | 472 ms | 0.165 | 300 ms | 0.163 | 502 ms | 0.161 | 5.5× |
| complex | 5,000 | 407 ms | 0.144 | 273 ms | 0.143 | 101 ms | 0.143 | 201 ms | 0.144 | 4× |
| complex | 9,999 | 1.55 s | 0.147 | 447 ms | 0.156 | 300 ms | 0.151 | 503 ms | 0.149 | 5.2× |
| moderate | 20,000 | 5.63 s | 0.162 | 1.09 s | 0.166 | 2.01 s | 0.162 | - | - | 5.2× |
| moderate | 30,000 | 2.42 s | 0.211 | 1.89 s | 0.165 | 6.09 s | 0.162 | - | - | 1.3× |

_Above 20,000 items the app's best quality falls back to the quick sample, so the processor truth there is the quick one._

_Graphics-card time covers everything: the 60-pivot sketch (made while the card builds the table), the upload, the hop table, 40 steps and reading the picture back. The processor time is the app's best-quality arrangement, which also includes the overlap clean-up that the graphics-card picture has not had yet, so the graphics-card truth is slightly flattering._

## Parallel-pairs variants

**OK** Ran 14 variants; compare time and truth in the table.

| Network | Variant | Total time | Truth |
|---|---:|---:|---:|
| complex 9,999 | one smooth sweep (new default) | 312 ms | 0.151 |
| complex 9,999 | two smooth sweeps | 481 ms | 0.147 |
| complex 9,999 | one smooth sweep + 5 clean-up steps | 379 ms | 0.15 |
| complex 9,999 | one smooth sweep, bigger first step (0.1) | 381 ms | 0.151 |
| complex 9,999 | one smooth sweep, smaller steps (0.02) | 380 ms | 0.155 |
| complex 9,999 | three sweeps, steps shrink per sweep | 581 ms | 0.149 |
| complex 9,999 | old steps, relaxed 1.2, 40 | 278 ms | 0.156 |
| moderate 10,000 | one smooth sweep (new default) | 268 ms | 0.163 |
| moderate 10,000 | two smooth sweeps | 380 ms | 0.163 |
| moderate 10,000 | three smooth sweeps | 482 ms | 0.163 |
| moderate 10,000 | one smooth sweep + 5 clean-up steps | 281 ms | 0.163 |
| moderate 10,000 | three sweeps, steps shrink per sweep | 481 ms | 0.161 |
| moderate 30,000 | one smooth sweep | 6.09 s | 0.162 |
| moderate 30,000 | old steps, relaxed 1.2, 40 | 1.67 s | 0.165 |
| moderate 10,000 | parts (parallel pairs): sketch / setup / table+weights / sweeps / read-back | 57 / 0 / 156 / 302 / 100 ms |  |

## Raw data

```json
{
 "version": "2026.10.15.1641",
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
   "cpuMs": 452,
   "cpuTruth": 0.149,
   "gpuMs": 233,
   "gpuTruth": 0.153,
   "sgdMs": 100,
   "sgdTruth": 0.155,
   "sgdError": null,
   "sgdPolishMs": 102,
   "sgdPolishTruth": 0.154,
   "sweeps": 1,
   "parts": {
    "sketch": 12,
    "setup": 0,
    "stepsAndTable": 20,
    "read": 19
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
   "cpuMs": 516,
   "cpuTruth": 0.159,
   "gpuMs": 321,
   "gpuTruth": 0.155,
   "sgdMs": 100,
   "sgdTruth": 0.155,
   "sgdError": null,
   "sgdPolishMs": 202,
   "sgdPolishTruth": 0.156,
   "sweeps": 1,
   "parts": {
    "sketch": 28,
    "setup": 1,
    "stepsAndTable": 90,
    "read": 90
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
   "cpuMs": 1640,
   "cpuTruth": 0.164,
   "gpuMs": 472,
   "gpuTruth": 0.165,
   "sgdMs": 300,
   "sgdTruth": 0.163,
   "sgdError": null,
   "sgdPolishMs": 502,
   "sgdPolishTruth": 0.161,
   "sweeps": 1,
   "parts": {
    "sketch": 53,
    "setup": 1,
    "stepsAndTable": 216,
    "read": 100
   },
   "sgdParts": {
    "stepsAndTable": 248,
    "read": 100
   },
   "split": 10,
   "levels": 18,
   "t20": 0.168,
   "t30": 0.166
  },
  {
   "kind": "complex",
   "n": 5000,
   "cpuMs": 407,
   "cpuTruth": 0.144,
   "gpuMs": 273,
   "gpuTruth": 0.143,
   "sgdMs": 101,
   "sgdTruth": 0.143,
   "sgdError": null,
   "sgdPolishMs": 201,
   "sgdPolishTruth": 0.144,
   "sweeps": 1,
   "parts": {
    "sketch": 28,
    "setup": 0,
    "stepsAndTable": 42,
    "read": 42
   },
   "sgdParts": {
    "stepsAndTable": 73,
    "read": 72
   },
   "split": 20,
   "levels": 10,
   "t20": 0.144,
   "t30": 0.143
  },
  {
   "kind": "complex",
   "n": 9999,
   "cpuMs": 1552,
   "cpuTruth": 0.147,
   "gpuMs": 447,
   "gpuTruth": 0.156,
   "sgdMs": 300,
   "sgdTruth": 0.151,
   "sgdError": null,
   "sgdPolishMs": 503,
   "sgdPolishTruth": 0.149,
   "sweeps": 1,
   "parts": {
    "sketch": 61,
    "setup": 1,
    "stepsAndTable": 183,
    "read": 101
   },
   "sgdParts": {
    "stepsAndTable": 241,
    "read": 100
   },
   "split": 10,
   "levels": 8,
   "t20": 0.158,
   "t30": 0.157
  },
  {
   "kind": "moderate",
   "n": 20000,
   "cpuMs": 5627,
   "cpuTruth": 0.162,
   "gpuMs": 1089,
   "gpuTruth": 0.166,
   "sgdMs": 2011,
   "sgdTruth": 0.162,
   "sgdError": null,
   "sgdPolishMs": null,
   "sgdPolishTruth": null,
   "sweeps": 1,
   "parts": {
    "sketch": 176,
    "setup": 1,
    "stepsAndTable": 503,
    "read": 99
   },
   "sgdParts": {
    "stepsAndTable": 1710,
    "read": 502
   },
   "split": 5,
   "levels": 18,
   "t20": 0.17,
   "t30": 0.167
  },
  {
   "kind": "moderate",
   "n": 30000,
   "cpuMs": 2421,
   "cpuTruth": 0.211,
   "gpuMs": 1885,
   "gpuTruth": 0.165,
   "sgdMs": 6087,
   "sgdTruth": 0.162,
   "sgdError": null,
   "sgdPolishMs": null,
   "sgdPolishTruth": null,
   "sweeps": 1,
   "parts": {
    "sketch": 231,
    "setup": 1,
    "stepsAndTable": 1008,
    "read": 100
   },
   "sgdParts": {
    "stepsAndTable": 5426,
    "read": 300
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
    "totalMs": 312,
    "truth": 0.151,
    "split": 1
   },
   {
    "kind": "complex",
    "n": 9999,
    "variant": "two smooth sweeps",
    "totalMs": 481,
    "truth": 0.147,
    "split": 1
   },
   {
    "kind": "complex",
    "n": 9999,
    "variant": "one smooth sweep + 5 clean-up steps",
    "totalMs": 379,
    "truth": 0.15,
    "split": 10
   },
   {
    "kind": "complex",
    "n": 9999,
    "variant": "one smooth sweep, bigger first step (0.1)",
    "totalMs": 381,
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
    "totalMs": 581,
    "truth": 0.149,
    "split": 1
   },
   {
    "kind": "complex",
    "n": 9999,
    "variant": "old steps, relaxed 1.2, 40",
    "totalMs": 278,
    "truth": 0.156,
    "split": 10
   },
   {
    "kind": "moderate",
    "n": 10000,
    "variant": "one smooth sweep (new default)",
    "totalMs": 268,
    "truth": 0.163,
    "split": 1
   },
   {
    "kind": "moderate",
    "n": 10000,
    "variant": "two smooth sweeps",
    "totalMs": 380,
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
    "totalMs": 481,
    "truth": 0.161,
    "split": 1
   },
   {
    "kind": "moderate",
    "n": 30000,
    "variant": "one smooth sweep",
    "totalMs": 6093,
    "truth": 0.162,
    "split": 1
   },
   {
    "kind": "moderate",
    "n": 30000,
    "variant": "old steps, relaxed 1.2, 40",
    "totalMs": 1665,
    "truth": 0.165,
    "split": 4
   }
  ],
  "parts": {
   "sketch": 57,
   "setup": 0,
   "tableAndWeights": 156,
   "steps60": 302,
   "read": 100,
   "levels": 18
  }
 },
 "groups": null,
 "cold": null,
 "small": null
}
```
