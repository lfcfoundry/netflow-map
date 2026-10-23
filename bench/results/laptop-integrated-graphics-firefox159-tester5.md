# Net Flow Map Tester results

Version 2026.10.15.1608 · run 2026-10-15T20:12:31.405Z · took 50.7 s

## Your computer

**OK** Graphics-card computing is available on: unnamed adapter.

| Item | Value |
|---|---:|
| Browser | Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:159.0) Gecko/20100101 Firefox/159.0 |
| Processor threads | 16 |
| Memory hint (GB) | not shared by this browser |
| Screen | 1536 x 960 at 1.25x |
| Graphics (as the page sees it) | ANGLE (AMD, Radeon R9 200 Series Direct3D11 vs_5_0 ps_5_0), or similar |
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

**WARN** Graphics card faster in 6 of 7 runs (middle 1.7×), and as true or truer (within 3%) in 6 of 7. Truth: lower is truer.

| Network | Items | Processor time | Processor truth | Graphics-card time | Graphics-card truth | Faster by | Truth at 20 / 30 steps |
|---|---:|---:|---:|---:|---:|---:|---:|
| moderate | 2,000 | 402 ms | 0.149 | 243 ms | 0.153 | 1.7× | 0.155 / 0.153 |
| moderate | 5,000 | 529 ms | 0.159 | 328 ms | 0.155 | 1.6× | 0.156 / 0.155 |
| moderate | 10,000 | 1.67 s | 0.164 | 457 ms | 0.165 | 3.7× | 0.168 / 0.165 |
| complex | 5,000 | 407 ms | 0.144 | 310 ms | 0.143 | 1.3× | 0.144 / 0.143 |
| complex | 9,999 | 1.58 s | 0.147 | 532 ms | 0.156 | 3× | 0.158 / 0.156 |
| moderate | 20,000 | 5.10 s | 0.162 | 2.20 s | 0.166 | 2.3× | 0.17 / 0.166 |
| moderate | 30,000 | 2.57 s | 0.211 | 3.98 s | 0.165 | 0.6× | 0.168 / 0.165 |

_Above 20,000 items the app's best quality falls back to the quick sample, so the processor truth there is the quick one._

_Graphics-card time covers everything: the 60-pivot sketch (made while the card builds the table), the upload, the hop table, 40 steps and reading the picture back. The processor time is the app's best-quality arrangement, which also includes the overlap clean-up that the graphics-card picture has not had yet, so the graphics-card truth is slightly flattering._

## Graphics-card program variants

**OK** At 10,000 items the program takes 447 ms with relaxation 1.2 and 617 ms with plain steps.

| Network | Variant | Total time | Truth at 1/3 of the steps | at 2/3 | at the end |
|---|---:|---:|---:|---:|---:|
| moderate 10,000 | new program, plain steps, 60 | 617 ms | 0.169 | 0.166 | 0.165 |
| moderate 10,000 | new program, relaxed 1.2, 60 | 447 ms | 0.168 | 0.165 | 0.164 |
| moderate 10,000 | new program without tables, relaxed 1.2, 60 | 649 ms | 0.168 | 0.165 | 0.164 |
| moderate 10,000 | new program, relaxed 1.6, 60 | 446 ms | 0.167 | 0.164 | 0.163 |
| moderate 10,000 | new program, relaxed 1.2, 30 | 446 ms | 0.171 | 0.168 | 0.166 |
| complex 9,999 | new program, relaxed 1.2, 60 | 629 ms | 0.158 | 0.156 | 0.156 |
| complex 9,999 | new program, relaxed 1.2, 150 | 848 ms | 0.156 | 0.154 | 0.153 |
| moderate 30,000 | plain steps, 60 | 4.39 s | 0.169 | 0.166 | 0.165 |
| moderate 30,000 | relaxed 1.2, 60 | 4.48 s | 0.168 | 0.165 | 0.164 |
| moderate 10,000 | parts (new program): sketch / setup / table+weights / 60 steps / read-back | 58 / 0 / 158 / 201 / 101 ms |  |  |  |

## Hop table: how many start items to walk together

**OK** At 20,000 items the table is quickest with 64 start items at a time (996 ms).

| Start items walked together | Hop table time | Whole job |
|---|---:|---:|
| 32 | 1.34 s | 1.55 s |
| 64 | 996 ms | 1.20 s |
| 128 | 1.08 s | 1.29 s |
| 256 | 998 ms | 1.21 s |
| 512 | 996 ms | 1.20 s |

## First run against later runs (cold start)

**OK** For a 2,000-item file the first run took 1.22 s and later runs 1.24 s: about 0 ms (0%) is warm-up cost.

| Items | Step | First run | Second run | Third run |
|---|---:|---:|---:|---:|
| 500 | parse | 1 ms | 0 ms | 0 ms |
| 500 | import | 3 ms | 2 ms | 2 ms |
| 500 | prepare | 2 ms | 1 ms | 1 ms |
| 500 | check | 10 ms | 4 ms | 3 ms |
| 500 | flow | 22 ms | 12 ms | 11 ms |
| 500 | stress | 43 ms | 39 ms | 42 ms |
| 500 | force | 147 ms | 124 ms | 120 ms |
| 500 | total | 228 ms | 182 ms | 179 ms |
| 2,000 | parse | 0 ms | 0 ms | 1 ms |
| 2,000 | import | 6 ms | 11 ms | 6 ms |
| 2,000 | prepare | 4 ms | 4 ms | 3 ms |
| 2,000 | check | 16 ms | 15 ms | 17 ms |
| 2,000 | flow | 111 ms | 114 ms | 149 ms |
| 2,000 | stress | 397 ms | 389 ms | 401 ms |
| 2,000 | force | 686 ms | 706 ms | 691 ms |
| 2,000 | total | 1.22 s | 1.24 s | 1.27 s |

## Smaller checks: random draws, CSV reading, Force arrangement

**OK** Times for the same job repeated; the first run is the one a person feels, the later ones show the warmed-up speed.

| Check | Run 1 | Run 2 | Run 3 | Run 4 | Run 5 |
|---|---:|---:|---:|---:|---:|
| 1,000,000 normal draws | 17 ms | 16 ms | 15 ms | 16 ms | 15 ms |
| CSV reading, 120,115 rows | 10 ms | 28 ms | 9 ms | 10 ms | 13 ms |
| Force arrangement, 3,000 items | 1.11 s | 1.12 s | 1.13 s |  |  |

## Raw data

```json
{
 "version": "2026.10.15.1608",
 "quick": false,
 "info": {
  "ua": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:159.0) Gecko/20100101 Firefox/159.0",
  "threads": 16,
  "mem": null,
  "gpu": "unnamed adapter",
  "gl": "ANGLE (AMD, Radeon R9 200 Series Direct3D11 vs_5_0 ps_5_0), or similar",
  "soft": false,
  "bufMB": 2048
 },
 "correct": {
  "table": true,
  "steps": true,
  "bad": 0,
  "diffPct": 0,
  "move": 0
 },
 "ladder": [
  {
   "kind": "moderate",
   "n": 2000,
   "cpuMs": 402,
   "cpuTruth": 0.149,
   "gpuMs": 243,
   "gpuTruth": 0.153,
   "parts": {
    "sketch": 12,
    "setup": 0,
    "stepsAndTable": 28,
    "read": 28
   },
   "split": 32,
   "levels": 16,
   "t20": 0.155,
   "t40": 0.153
  },
  {
   "kind": "moderate",
   "n": 5000,
   "cpuMs": 529,
   "cpuTruth": 0.159,
   "gpuMs": 328,
   "gpuTruth": 0.155,
   "parts": {
    "sketch": 29,
    "setup": 1,
    "stepsAndTable": 95,
    "read": 95
   },
   "split": 20,
   "levels": 16,
   "t20": 0.156,
   "t40": 0.155
  },
  {
   "kind": "moderate",
   "n": 10000,
   "cpuMs": 1672,
   "cpuTruth": 0.164,
   "gpuMs": 457,
   "gpuTruth": 0.165,
   "parts": {
    "sketch": 62,
    "setup": 1,
    "stepsAndTable": 191,
    "read": 101
   },
   "split": 10,
   "levels": 18,
   "t20": 0.168,
   "t40": 0.165
  },
  {
   "kind": "complex",
   "n": 5000,
   "cpuMs": 407,
   "cpuTruth": 0.144,
   "gpuMs": 310,
   "gpuTruth": 0.143,
   "parts": {
    "sketch": 27,
    "setup": 0,
    "stepsAndTable": 80,
    "read": 80
   },
   "split": 20,
   "levels": 10,
   "t20": 0.144,
   "t40": 0.143
  },
  {
   "kind": "complex",
   "n": 9999,
   "cpuMs": 1584,
   "cpuTruth": 0.147,
   "gpuMs": 532,
   "gpuTruth": 0.156,
   "parts": {
    "sketch": 68,
    "setup": 0,
    "stepsAndTable": 260,
    "read": 100
   },
   "split": 10,
   "levels": 8,
   "t20": 0.158,
   "t40": 0.156
  },
  {
   "kind": "moderate",
   "n": 20000,
   "cpuMs": 5103,
   "cpuTruth": 0.162,
   "gpuMs": 2199,
   "gpuTruth": 0.166,
   "parts": {
    "sketch": 144,
    "setup": 2,
    "stepsAndTable": 504,
    "read": 100
   },
   "split": 5,
   "levels": 18,
   "t20": 0.17,
   "t40": 0.166
  },
  {
   "kind": "moderate",
   "n": 30000,
   "cpuMs": 2571,
   "cpuTruth": 0.211,
   "gpuMs": 3979,
   "gpuTruth": 0.165,
   "parts": {
    "sketch": 215,
    "setup": 1,
    "stepsAndTable": 904,
    "read": 201
   },
   "split": 4,
   "levels": 18,
   "t20": 0.168,
   "t40": 0.165
  }
 ],
 "kernels": {
  "n": 10000,
  "variants": [
   {
    "kind": "moderate",
    "n": 10000,
    "variant": "new program, plain steps, 60",
    "totalMs": 617,
    "truths": [
     0.169,
     0.166,
     0.165
    ],
    "split": 10
   },
   {
    "kind": "moderate",
    "n": 10000,
    "variant": "new program, relaxed 1.2, 60",
    "totalMs": 447,
    "truths": [
     0.168,
     0.165,
     0.164
    ],
    "split": 10
   },
   {
    "kind": "moderate",
    "n": 10000,
    "variant": "new program without tables, relaxed 1.2, 60",
    "totalMs": 649,
    "truths": [
     0.168,
     0.165,
     0.164
    ],
    "split": 10
   },
   {
    "kind": "moderate",
    "n": 10000,
    "variant": "new program, relaxed 1.6, 60",
    "totalMs": 446,
    "truths": [
     0.167,
     0.164,
     0.163
    ],
    "split": 10
   },
   {
    "kind": "moderate",
    "n": 10000,
    "variant": "new program, relaxed 1.2, 30",
    "totalMs": 446,
    "truths": [
     0.171,
     0.168,
     0.166
    ],
    "split": 10
   },
   {
    "kind": "complex",
    "n": 9999,
    "variant": "new program, relaxed 1.2, 60",
    "totalMs": 629,
    "truths": [
     0.158,
     0.156,
     0.156
    ],
    "split": 10
   },
   {
    "kind": "complex",
    "n": 9999,
    "variant": "new program, relaxed 1.2, 150",
    "totalMs": 848,
    "truths": [
     0.156,
     0.154,
     0.153
    ],
    "split": 10
   },
   {
    "kind": "moderate",
    "n": 30000,
    "variant": "plain steps, 60",
    "totalMs": 4390,
    "truths": [
     0.169,
     0.166,
     0.165
    ],
    "split": 4
   },
   {
    "kind": "moderate",
    "n": 30000,
    "variant": "relaxed 1.2, 60",
    "totalMs": 4479,
    "truths": [
     0.168,
     0.165,
     0.164
    ],
    "split": 4
   }
  ],
  "parts": {
   "sketch": 58,
   "setup": 0,
   "tableAndWeights": 158,
   "steps60": 201,
   "read": 101,
   "levels": 18
  }
 },
 "groups": [
  {
   "group": 32,
   "tableMs": 1338,
   "totalMs": 1546
  },
  {
   "group": 64,
   "tableMs": 996,
   "totalMs": 1202
  },
  {
   "group": 128,
   "tableMs": 1083,
   "totalMs": 1293
  },
  {
   "group": 256,
   "tableMs": 998,
   "totalMs": 1206
  },
  {
   "group": 512,
   "tableMs": 996,
   "totalMs": 1204
  }
 ],
 "cold": [
  {
   "n": 500,
   "first": 228,
   "second": 182,
   "third": 179
  },
  {
   "n": 2000,
   "first": 1220,
   "second": 1239,
   "third": 1268
  }
 ],
 "small": {
  "draws": [
   17,
   16,
   15,
   16,
   15
  ],
  "csv": [
   10,
   28,
   9,
   10,
   13
  ],
  "force": [
   1115,
   1118,
   1126
  ]
 }
}
```
