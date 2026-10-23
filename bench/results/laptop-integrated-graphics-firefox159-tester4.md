# Net Flow Map Tester results

Version 2026.10.15.1601 · run 2026-10-15T20:05:50.145Z · took 48.6 s

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

**WARN** Graphics card faster in 6 of 7 runs (middle 1.6×), and as true or truer (within 3%) in 6 of 7. Truth: lower is truer.

| Network | Items | Processor time | Processor truth | Graphics-card time | Graphics-card truth | Faster by | Truth at 20 / 40 steps |
|---|---:|---:|---:|---:|---:|---:|---:|
| moderate | 2,000 | 416 ms | 0.149 | 325 ms | 0.152 | 1.3× | 0.155 / 0.153 |
| moderate | 5,000 | 528 ms | 0.159 | 325 ms | 0.155 | 1.6× | 0.156 / 0.155 |
| moderate | 10,000 | 1.69 s | 0.164 | 539 ms | 0.164 | 3.1× | 0.168 / 0.165 |
| complex | 5,000 | 415 ms | 0.144 | 396 ms | 0.143 | 1× | 0.144 / 0.143 |
| complex | 9,999 | 1.59 s | 0.147 | 525 ms | 0.156 | 3× | 0.158 / 0.156 |
| moderate | 20,000 | 5.18 s | 0.162 | 2.11 s | 0.164 | 2.5× | 0.17 / 0.166 |
| moderate | 30,000 | 2.57 s | 0.211 | 5.50 s | 0.164 | 0.5× | 0.168 / 0.165 |

_Above 20,000 items the app's best quality falls back to the quick sample, so the processor truth there is the quick one._

_Graphics-card time covers everything: the 60-point sketch, the upload, the hop table, 60 steps and reading the picture back. The processor time is the app's best-quality arrangement, which also includes the overlap clean-up that the graphics-card picture has not had yet, so the graphics-card truth is slightly flattering._

## Graphics-card program variants

**OK** At 10,000 items the program takes 547 ms with relaxation 1.2 and 534 ms with plain steps.

| Network | Variant | Total time | Truth at 1/3 of the steps | at 2/3 | at the end |
|---|---:|---:|---:|---:|---:|
| moderate 10,000 | new program, plain steps, 60 | 534 ms | 0.169 | 0.166 | 0.165 |
| moderate 10,000 | new program, relaxed 1.2, 60 | 547 ms | 0.168 | 0.165 | 0.164 |
| moderate 10,000 | new program without tables, relaxed 1.2, 60 | 675 ms | 0.168 | 0.165 | 0.164 |
| moderate 10,000 | new program, relaxed 1.6, 60 | 647 ms | 0.167 | 0.164 | 0.163 |
| moderate 10,000 | new program, relaxed 1.2, 30 | 544 ms | 0.171 | 0.168 | 0.166 |
| complex 9,999 | new program, relaxed 1.2, 60 | 523 ms | 0.158 | 0.156 | 0.156 |
| complex 9,999 | new program, relaxed 1.2, 150 | 844 ms | 0.156 | 0.154 | 0.153 |
| moderate 30,000 | plain steps, 60 | 5.71 s | 0.169 | 0.166 | 0.165 |
| moderate 30,000 | relaxed 1.2, 60 | 5.28 s | 0.168 | 0.165 | 0.164 |
| moderate 10,000 | parts (new program): sketch / setup / table+weights / 60 steps / read-back | 100 / 1 / 148 / 303 / 100 ms |  |  |  |

## First run against later runs (cold start)

**OK** For a 2,000-item file the first run took 1.24 s and later runs 1.24 s: about 7 ms (1%) is warm-up cost.

| Items | Step | First run | Second run | Third run |
|---|---:|---:|---:|---:|
| 500 | parse | 0 ms | 0 ms | 0 ms |
| 500 | import | 3 ms | 4 ms | 2 ms |
| 500 | prepare | 2 ms | 0 ms | 1 ms |
| 500 | check | 12 ms | 4 ms | 5 ms |
| 500 | flow | 26 ms | 12 ms | 13 ms |
| 500 | stress | 49 ms | 43 ms | 39 ms |
| 500 | force | 153 ms | 129 ms | 122 ms |
| 500 | total | 245 ms | 192 ms | 182 ms |
| 2,000 | parse | 0 ms | 1 ms | 1 ms |
| 2,000 | import | 7 ms | 6 ms | 6 ms |
| 2,000 | prepare | 4 ms | 3 ms | 4 ms |
| 2,000 | check | 19 ms | 15 ms | 17 ms |
| 2,000 | flow | 109 ms | 135 ms | 127 ms |
| 2,000 | stress | 415 ms | 392 ms | 391 ms |
| 2,000 | force | 690 ms | 712 ms | 691 ms |
| 2,000 | total | 1.24 s | 1.26 s | 1.24 s |

## Smaller checks: random draws, CSV reading, Force arrangement

**OK** Times for the same job repeated; the first run is the one a person feels, the later ones show the warmed-up speed.

| Check | Run 1 | Run 2 | Run 3 | Run 4 | Run 5 |
|---|---:|---:|---:|---:|---:|
| 1,000,000 normal draws | 18 ms | 17 ms | 17 ms | 18 ms | 17 ms |
| CSV reading, 120,115 rows | 11 ms | 23 ms | 10 ms | 26 ms | 31 ms |
| Force arrangement, 3,000 items | 1.12 s | 1.13 s | 1.14 s |  |  |

## Raw data

```json
{
 "version": "2026.10.15.1601",
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
   "cpuMs": 416,
   "cpuTruth": 0.149,
   "gpuMs": 325,
   "gpuTruth": 0.152,
   "parts": {
    "sketch": 11,
    "setup": 0,
    "stepsAndTable": 111,
    "read": 111
   },
   "split": 32,
   "levels": 14,
   "t20": 0.155,
   "t40": 0.153
  },
  {
   "kind": "moderate",
   "n": 5000,
   "cpuMs": 528,
   "cpuTruth": 0.159,
   "gpuMs": 325,
   "gpuTruth": 0.155,
   "parts": {
    "sketch": 31,
    "setup": 1,
    "stepsAndTable": 92,
    "read": 92
   },
   "split": 20,
   "levels": 16,
   "t20": 0.156,
   "t40": 0.155
  },
  {
   "kind": "moderate",
   "n": 10000,
   "cpuMs": 1690,
   "cpuTruth": 0.164,
   "gpuMs": 539,
   "gpuTruth": 0.164,
   "parts": {
    "sketch": 58,
    "setup": 1,
    "stepsAndTable": 279,
    "read": 101
   },
   "split": 10,
   "levels": 16,
   "t20": 0.168,
   "t40": 0.165
  },
  {
   "kind": "complex",
   "n": 5000,
   "cpuMs": 415,
   "cpuTruth": 0.144,
   "gpuMs": 396,
   "gpuTruth": 0.143,
   "parts": {
    "sketch": 28,
    "setup": 1,
    "stepsAndTable": 165,
    "read": 165
   },
   "split": 20,
   "levels": 10,
   "t20": 0.144,
   "t40": 0.143
  },
  {
   "kind": "complex",
   "n": 9999,
   "cpuMs": 1592,
   "cpuTruth": 0.147,
   "gpuMs": 525,
   "gpuTruth": 0.156,
   "parts": {
    "sketch": 64,
    "setup": 0,
    "stepsAndTable": 259,
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
   "cpuMs": 5178,
   "cpuTruth": 0.162,
   "gpuMs": 2108,
   "gpuTruth": 0.164,
   "parts": {
    "sketch": 127,
    "setup": 1,
    "stepsAndTable": 804,
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
   "cpuMs": 2567,
   "cpuTruth": 0.211,
   "gpuMs": 5505,
   "gpuTruth": 0.164,
   "parts": {
    "sketch": 226,
    "setup": 2,
    "stepsAndTable": 2414,
    "read": 101
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
    "totalMs": 534,
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
    "totalMs": 675,
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
    "totalMs": 647,
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
    "totalMs": 544,
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
    "totalMs": 523,
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
    "totalMs": 844,
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
    "totalMs": 5710,
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
    "totalMs": 5278,
    "truths": [
     0.168,
     0.165,
     0.164
    ],
    "split": 4
   }
  ],
  "parts": {
   "sketch": 100,
   "setup": 1,
   "tableAndWeights": 148,
   "steps60": 303,
   "read": 100,
   "levels": 16
  }
 },
 "cold": [
  {
   "n": 500,
   "first": 245,
   "second": 192,
   "third": 182
  },
  {
   "n": 2000,
   "first": 1244,
   "second": 1264,
   "third": 1237
  }
 ],
 "small": {
  "draws": [
   18,
   17,
   17,
   18,
   17
  ],
  "csv": [
   11,
   23,
   10,
   26,
   31
  ],
  "force": [
   1120,
   1131,
   1135
  ]
 }
}
```
