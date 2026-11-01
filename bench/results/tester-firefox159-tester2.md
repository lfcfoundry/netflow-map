# Net Flow Map Tester results

Version 2026.10.15.1554 · run 2026-10-15T19:55:40.437Z · took 31.1 s

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

**OK** Yes. The graphics card builds the same hop table as the processor, and its steps give the same picture (distance error 0.144 against 0.144 on the processor).

| Check | Result |
|---|---:|
| Items | 1200 |
| Hop table: entries that differ from the CPU table | 0 of 1440000 |
| Distance error at the start (sketch) | 0.196 |
| After 20 steps, CPU math | 0.144 |
| After 20 steps, graphics card | 0.144 |
| Difference | 0% |
| Average item difference (share of one link) | 0 |

## How fast and how true is the graphics-card version?

**WARN** Graphics card faster in 6 of 7 runs (middle 1.9×), and as true or truer (within 3%) in 5 of 7. Truth: lower is truer.

| Network | Items | Processor time | Processor truth | Graphics-card time | Graphics-card truth | Faster by | Truth at 20 / 40 steps |
|---|---:|---:|---:|---:|---:|---:|---:|
| moderate | 2,000 | 548 ms | 0.149 | 293 ms | 0.152 | 1.9× | 0.154 / 0.152 |
| moderate | 5,000 | 572 ms | 0.159 | 381 ms | 0.154 | 1.5× | 0.156 / 0.155 |
| moderate | 10,000 | 1.75 s | 0.164 | 560 ms | 0.163 | 3.1× | 0.167 / 0.164 |
| complex | 5,000 | 423 ms | 0.144 | 382 ms | 0.142 | 1.1× | 0.143 / 0.143 |
| complex | 9,999 | 1.65 s | 0.147 | 553 ms | 0.155 | 3× | 0.157 / 0.156 |
| moderate | 20,000 | 5.24 s | 0.162 | 1.55 s | 0.163 | 3.4× | 0.168 / 0.164 |
| moderate | 30,000 | 2.57 s | 0.211 | 4.30 s | 0.796 | 0.6× | 0.206 / 0.222 |

_Above 20,000 items the app's best quality falls back to the quick sample, so the processor truth there is the quick one._

_Graphics-card time covers everything: the 60-point sketch, the upload, the hop table, 60 steps and reading the picture back. The processor time is the app's best-quality arrangement, which also includes the overlap clean-up that the graphics-card picture has not had yet, so the graphics-card truth is slightly flattering._

## Old graphics-card program against the new one

**BAD** This step stopped with an error: Mapping WebGPU buffer failed: Invalid buffer

| Network | Variant | Total time | Truth at 1/3 of the steps | at 2/3 | at the end |
|---|---:|---:|---:|---:|---:|


## First run against later runs (cold start)

**OK** For a 2,000-item file the first run took 1.34 s and later runs 1.27 s: about 75 ms (6%) is warm-up cost.

| Items | Step | First run | Second run | Third run |
|---|---:|---:|---:|---:|
| 500 | parse | 1 ms | 0 ms | 0 ms |
| 500 | import | 4 ms | 1 ms | 2 ms |
| 500 | prepare | 2 ms | 2 ms | 0 ms |
| 500 | check | 10 ms | 6 ms | 4 ms |
| 500 | flow | 24 ms | 18 ms | 14 ms |
| 500 | stress | 49 ms | 42 ms | 41 ms |
| 500 | force | 154 ms | 127 ms | 125 ms |
| 500 | total | 244 ms | 196 ms | 186 ms |
| 2,000 | parse | 2 ms | 1 ms | 2 ms |
| 2,000 | import | 12 ms | 5 ms | 6 ms |
| 2,000 | prepare | 4 ms | 4 ms | 3 ms |
| 2,000 | check | 17 ms | 14 ms | 15 ms |
| 2,000 | flow | 141 ms | 109 ms | 140 ms |
| 2,000 | stress | 446 ms | 408 ms | 407 ms |
| 2,000 | force | 720 ms | 726 ms | 710 ms |
| 2,000 | total | 1.34 s | 1.27 s | 1.28 s |

## Smaller checks: random draws, CSV reading, Force arrangement

**OK** Times for the same job repeated; the first run is the one a person feels, the later ones show the warmed-up speed.

| Check | Run 1 | Run 2 | Run 3 | Run 4 | Run 5 |
|---|---:|---:|---:|---:|---:|
| 1,000,000 normal draws | 17 ms | 16 ms | 17 ms | 16 ms | 16 ms |
| CSV reading, 120,115 rows | 25 ms | 31 ms | 27 ms | 36 ms | 30 ms |
| Force arrangement, 3,000 items | 1.17 s | 1.16 s | 1.15 s |  |  |

## Raw data

```json
{
 "version": "2026.10.15.1554",
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
   "cpuMs": 548,
   "cpuTruth": 0.149,
   "gpuMs": 293,
   "gpuTruth": 0.152,
   "parts": {
    "sketch": 12,
    "setup": 1,
    "stepsAndTable": 79,
    "read": 79
   },
   "split": 32,
   "levels": 14,
   "t20": 0.154,
   "t40": 0.152
  },
  {
   "kind": "moderate",
   "n": 5000,
   "cpuMs": 572,
   "cpuTruth": 0.159,
   "gpuMs": 381,
   "gpuTruth": 0.154,
   "parts": {
    "sketch": 28,
    "setup": 1,
    "stepsAndTable": 151,
    "read": 151
   },
   "split": 20,
   "levels": 16,
   "t20": 0.156,
   "t40": 0.155
  },
  {
   "kind": "moderate",
   "n": 10000,
   "cpuMs": 1753,
   "cpuTruth": 0.164,
   "gpuMs": 560,
   "gpuTruth": 0.163,
   "parts": {
    "sketch": 65,
    "setup": 0,
    "stepsAndTable": 294,
    "read": 293
   },
   "split": 10,
   "levels": 16,
   "t20": 0.167,
   "t40": 0.164
  },
  {
   "kind": "complex",
   "n": 5000,
   "cpuMs": 423,
   "cpuTruth": 0.144,
   "gpuMs": 382,
   "gpuTruth": 0.142,
   "parts": {
    "sketch": 26,
    "setup": 1,
    "stepsAndTable": 154,
    "read": 154
   },
   "split": 20,
   "levels": 10,
   "t20": 0.143,
   "t40": 0.143
  },
  {
   "kind": "complex",
   "n": 9999,
   "cpuMs": 1648,
   "cpuTruth": 0.147,
   "gpuMs": 553,
   "gpuTruth": 0.155,
   "parts": {
    "sketch": 66,
    "setup": 0,
    "stepsAndTable": 285,
    "read": 285
   },
   "split": 10,
   "levels": 8,
   "t20": 0.157,
   "t40": 0.156
  },
  {
   "kind": "moderate",
   "n": 20000,
   "cpuMs": 5235,
   "cpuTruth": 0.162,
   "gpuMs": 1551,
   "gpuTruth": 0.163,
   "parts": {
    "sketch": 142,
    "setup": 1,
    "stepsAndTable": 1208,
    "read": 1207
   },
   "split": 5,
   "levels": 18,
   "t20": 0.168,
   "t40": 0.164
  },
  {
   "kind": "moderate",
   "n": 30000,
   "cpuMs": 2567,
   "cpuTruth": 0.211,
   "gpuMs": 4303,
   "gpuTruth": 0.796,
   "parts": {
    "sketch": 202,
    "setup": 1,
    "stepsAndTable": 3898,
    "read": 3898
   },
   "split": 4,
   "levels": 18,
   "t20": 0.206,
   "t40": 0.222
  }
 ],
 "kernels": null,
 "cold": [
  {
   "n": 500,
   "first": 244,
   "second": 196,
   "third": 186
  },
  {
   "n": 2000,
   "first": 1342,
   "second": 1267,
   "third": 1283
  }
 ],
 "small": {
  "draws": [
   17,
   16,
   17,
   16,
   16
  ],
  "csv": [
   25,
   31,
   27,
   36,
   30
  ],
  "force": [
   1174,
   1157,
   1145
  ]
 }
}
```
