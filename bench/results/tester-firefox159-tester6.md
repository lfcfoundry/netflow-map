# Net Flow Map Tester results

Version 2026.10.15.1614 · run 2026-10-15T20:16:17.422Z · took 41.1 s

## Your computer

**OK** Graphics-card computing is available on: unnamed adapter.

| Item | Value |
|---|---:|
| Browser | Firefox 159 |
| Processor threads | 16 |
| Memory hint (GB) | not shared by this browser |
| Screen | 1536 x 960 at 1.25x |
| Graphics (as the page sees it) | (graphics name removed)|
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

**WARN** Graphics card faster in 7 of 7 runs (middle 1.9×), and as true or truer (within 3%) in 6 of 7. Truth: lower is truer.

| Network | Items | Processor time | Processor truth | Graphics-card time | Graphics-card truth | Faster by | Truth at 20 / 30 steps |
|---|---:|---:|---:|---:|---:|---:|---:|
| moderate | 2,000 | 441 ms | 0.149 | 313 ms | 0.153 | 1.4× | 0.155 / 0.153 |
| moderate | 5,000 | 559 ms | 0.159 | 296 ms | 0.155 | 1.9× | 0.156 / 0.155 |
| moderate | 10,000 | 1.73 s | 0.164 | 500 ms | 0.165 | 3.5× | 0.168 / 0.165 |
| complex | 5,000 | 423 ms | 0.144 | 289 ms | 0.143 | 1.5× | 0.144 / 0.143 |
| complex | 9,999 | 1.62 s | 0.147 | 501 ms | 0.156 | 3.2× | 0.158 / 0.156 |
| moderate | 20,000 | 5.22 s | 0.162 | 1.17 s | 0.166 | 4.5× | 0.17 / 0.166 |
| moderate | 30,000 | 2.52 s | 0.211 | 1.73 s | 0.165 | 1.5× | 0.168 / 0.165 |

_Above 20,000 items the app's best quality falls back to the quick sample, so the processor truth there is the quick one._

_Graphics-card time covers everything: the 60-pivot sketch (made while the card builds the table), the upload, the hop table, 40 steps and reading the picture back. The processor time is the app's best-quality arrangement, which also includes the overlap clean-up that the graphics-card picture has not had yet, so the graphics-card truth is slightly flattering._

## Graphics-card program variants

**OK** At 10,000 items the program takes 547 ms with relaxation 1.2 and 617 ms with plain steps.

| Network | Variant | Total time | Truth at 1/3 of the steps | at 2/3 | at the end |
|---|---:|---:|---:|---:|---:|
| moderate 10,000 | new program, plain steps, 60 | 617 ms | 0.169 | 0.166 | 0.165 |
| moderate 10,000 | new program, relaxed 1.2, 60 | 547 ms | 0.168 | 0.165 | 0.164 |
| moderate 10,000 | new program without tables, relaxed 1.2, 60 | 678 ms | 0.168 | 0.165 | 0.164 |
| moderate 10,000 | new program, relaxed 1.6, 60 | 446 ms | 0.167 | 0.164 | 0.163 |
| moderate 10,000 | new program, relaxed 1.2, 30 | 445 ms | 0.171 | 0.168 | 0.166 |
| complex 9,999 | new program, relaxed 1.2, 60 | 516 ms | 0.158 | 0.156 | 0.156 |
| complex 9,999 | new program, relaxed 1.2, 150 | 544 ms | 0.156 | 0.154 | 0.153 |
| moderate 30,000 | plain steps, 60 | 2.17 s | 0.169 | 0.166 | 0.165 |
| moderate 30,000 | relaxed 1.2, 60 | 2.17 s | 0.168 | 0.165 | 0.164 |
| moderate 10,000 | parts (new program): sketch / setup / table+weights / 60 steps / read-back | 57 / 1 / 154 / 302 / 100 ms |  |  |  |

## Hop table: how many start items to walk together

**OK** At 20,000 items the table is quickest with 512 start items at a time (294 ms).

| Start items walked together | Hop table time | Whole job |
|---|---:|---:|
| 32 | 1.65 s | 1.85 s |
| 64 | 693 ms | 901 ms |
| 128 | 392 ms | 599 ms |
| 256 | 394 ms | 602 ms |
| 512 | 294 ms | 502 ms |

## First run against later runs (cold start)

**OK** For a 2,000-item file the first run took 1.22 s and later runs 1.22 s: about 0 ms (0%) is warm-up cost.

| Items | Step | First run | Second run | Third run |
|---|---:|---:|---:|---:|
| 500 | parse | 0 ms | 0 ms | 0 ms |
| 500 | import | 5 ms | 3 ms | 2 ms |
| 500 | prepare | 1 ms | 0 ms | 1 ms |
| 500 | check | 9 ms | 5 ms | 5 ms |
| 500 | flow | 24 ms | 12 ms | 12 ms |
| 500 | stress | 43 ms | 40 ms | 38 ms |
| 500 | force | 151 ms | 127 ms | 122 ms |
| 500 | total | 233 ms | 187 ms | 180 ms |
| 2,000 | parse | 0 ms | 1 ms | 1 ms |
| 2,000 | import | 5 ms | 5 ms | 19 ms |
| 2,000 | prepare | 4 ms | 3 ms | 3 ms |
| 2,000 | check | 20 ms | 15 ms | 16 ms |
| 2,000 | flow | 104 ms | 109 ms | 129 ms |
| 2,000 | stress | 381 ms | 381 ms | 375 ms |
| 2,000 | force | 704 ms | 706 ms | 694 ms |
| 2,000 | total | 1.22 s | 1.22 s | 1.24 s |

## Smaller checks: random draws, CSV reading, Force arrangement

**OK** Times for the same job repeated; the first run is the one a person feels, the later ones show the warmed-up speed.

| Check | Run 1 | Run 2 | Run 3 | Run 4 | Run 5 |
|---|---:|---:|---:|---:|---:|
| 1,000,000 normal draws | 17 ms | 15 ms | 15 ms | 16 ms | 16 ms |
| CSV reading, 120,115 rows | 11 ms | 16 ms | 11 ms | 23 ms | 28 ms |
| Force arrangement, 3,000 items | 1.13 s | 1.11 s | 1.12 s |  |  |

## Raw data

```json
{
 "version": "2026.10.15.1614",
 "quick": false,
 "info": {
  "ua": "Firefox 159",
  "threads": 16,
  "mem": null,
  "gpu": "unnamed adapter",
  "gl": "(graphics name removed)",
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
   "cpuMs": 441,
   "cpuTruth": 0.149,
   "gpuMs": 313,
   "gpuTruth": 0.153,
   "parts": {
    "sketch": 13,
    "setup": 1,
    "stepsAndTable": 96,
    "read": 95
   },
   "split": 32,
   "levels": 16,
   "t20": 0.155,
   "t40": 0.153
  },
  {
   "kind": "moderate",
   "n": 5000,
   "cpuMs": 559,
   "cpuTruth": 0.159,
   "gpuMs": 296,
   "gpuTruth": 0.155,
   "parts": {
    "sketch": 28,
    "setup": 0,
    "stepsAndTable": 65,
    "read": 64
   },
   "split": 20,
   "levels": 16,
   "t20": 0.156,
   "t40": 0.155
  },
  {
   "kind": "moderate",
   "n": 10000,
   "cpuMs": 1730,
   "cpuTruth": 0.164,
   "gpuMs": 500,
   "gpuTruth": 0.165,
   "parts": {
    "sketch": 55,
    "setup": 1,
    "stepsAndTable": 239,
    "read": 100
   },
   "split": 10,
   "levels": 18,
   "t20": 0.168,
   "t40": 0.165
  },
  {
   "kind": "complex",
   "n": 5000,
   "cpuMs": 423,
   "cpuTruth": 0.144,
   "gpuMs": 289,
   "gpuTruth": 0.143,
   "parts": {
    "sketch": 29,
    "setup": 1,
    "stepsAndTable": 57,
    "read": 57
   },
   "split": 20,
   "levels": 10,
   "t20": 0.144,
   "t40": 0.143
  },
  {
   "kind": "complex",
   "n": 9999,
   "cpuMs": 1619,
   "cpuTruth": 0.147,
   "gpuMs": 501,
   "gpuTruth": 0.156,
   "parts": {
    "sketch": 68,
    "setup": 1,
    "stepsAndTable": 227,
    "read": 99
   },
   "split": 10,
   "levels": 8,
   "t20": 0.158,
   "t40": 0.156
  },
  {
   "kind": "moderate",
   "n": 20000,
   "cpuMs": 5224,
   "cpuTruth": 0.162,
   "gpuMs": 1172,
   "gpuTruth": 0.166,
   "parts": {
    "sketch": 121,
    "setup": 1,
    "stepsAndTable": 605,
    "read": 201
   },
   "split": 5,
   "levels": 18,
   "t20": 0.17,
   "t40": 0.166
  },
  {
   "kind": "moderate",
   "n": 30000,
   "cpuMs": 2524,
   "cpuTruth": 0.211,
   "gpuMs": 1728,
   "gpuTruth": 0.165,
   "parts": {
    "sketch": 205,
    "setup": 1,
    "stepsAndTable": 905,
    "read": 200
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
    "totalMs": 547,
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
    "totalMs": 678,
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
    "totalMs": 445,
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
    "totalMs": 516,
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
    "totalMs": 544,
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
    "totalMs": 2172,
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
    "totalMs": 2174,
    "truths": [
     0.168,
     0.165,
     0.164
    ],
    "split": 4
   }
  ],
  "parts": {
   "sketch": 57,
   "setup": 1,
   "tableAndWeights": 154,
   "steps60": 302,
   "read": 100,
   "levels": 18
  }
 },
 "groups": [
  {
   "group": 32,
   "tableMs": 1645,
   "totalMs": 1853
  },
  {
   "group": 64,
   "tableMs": 693,
   "totalMs": 901
  },
  {
   "group": 128,
   "tableMs": 392,
   "totalMs": 599
  },
  {
   "group": 256,
   "tableMs": 394,
   "totalMs": 602
  },
  {
   "group": 512,
   "tableMs": 294,
   "totalMs": 502
  }
 ],
 "cold": [
  {
   "n": 500,
   "first": 233,
   "second": 187,
   "third": 180
  },
  {
   "n": 2000,
   "first": 1218,
   "second": 1220,
   "third": 1237
  }
 ],
 "small": {
  "draws": [
   17,
   15,
   15,
   16,
   16
  ],
  "csv": [
   11,
   16,
   11,
   23,
   28
  ],
  "force": [
   1133,
   1115,
   1117
  ]
 }
}
```
