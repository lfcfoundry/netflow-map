# Net Flow Map Tester results

Version 2026.10.15.1541 · run 2026-10-15T19:44:09.113Z · took 36.2 s

## Your computer

**OK** Graphics-card computing is available on: unnamed adapter.

| Item | Value |
|---|---:|
| Browser | Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:159.0) Gecko/20100101 Firefox/159.0 |
| Processor threads | 16 |
| Memory hint (GB) | not shared by this browser |
| Screen | 1536 x 960 at 1.25x |
| Graphics-card computing (WebGPU) | available |
| Graphics adapter | unnamed adapter |
| Largest buffer it allows | 2048 MB |

## Is the graphics-card answer right?

**OK** Yes. The graphics card builds the same hop table as the processor, and its steps give the same picture (distance error 0.146 against 0.146 on the processor).

| Check | Result |
|---|---:|
| Items | 1200 |
| Hop table: entries that differ from the CPU table | 0 of 1440000 |
| Distance error at the start (sketch) | 0.196 |
| After 20 steps, CPU math | 0.146 |
| After 20 steps, graphics card | 0.146 |
| Difference | 0% |
| Average item difference (share of one link) | 0 |

## How fast and how true is the graphics-card version?

**BAD** Graphics card faster in 0 of 6 runs (middle 0.7×), and as true or truer (within 3%) in 5 of 6. Truth: lower is truer.

| Network | Items | Processor time | Processor truth | Graphics-card time | Graphics-card truth | Faster by | Truth at 20 / 40 steps |
|---|---:|---:|---:|---:|---:|---:|---:|
| moderate | 2,000 | 505 ms | 0.149 | 749 ms | 0.153 | 0.7× | 0.156 / 0.154 |
| moderate | 5,000 | 547 ms | 0.159 | 1.11 s | 0.155 | 0.5× | 0.157 / 0.155 |
| moderate | 10,000 | 1.75 s | 0.164 | 2.10 s | 0.165 | 0.8× | 0.169 / 0.166 |
| complex | 5,000 | 513 ms | 0.144 | 1.10 s | 0.143 | 0.5× | 0.144 / 0.143 |
| complex | 9,999 | 1.66 s | 0.147 | 2.17 s | 0.156 | 0.8× | 0.158 / 0.157 |
| moderate | 20,000 | 5.22 s | 0.162 | 8.91 s | 0.164 | 0.6× | 0.171 / 0.167 |

_Graphics-card time covers everything: the 60-point sketch, the upload, the hop table, 60 steps and reading the picture back. The processor time is the app's best-quality arrangement, which also includes the overlap clean-up that the graphics-card picture has not had yet, so the graphics-card truth is slightly flattering._

## First run against later runs (cold start)

**OK** For a 2,000-item file the first run took 1.26 s and later runs 1.30 s: about 0 ms (0%) is warm-up cost.

| Items | Step | First run | Second run | Third run |
|---|---:|---:|---:|---:|
| 500 | parse | 1 ms | 0 ms | 0 ms |
| 500 | import | 5 ms | 2 ms | 2 ms |
| 500 | prepare | 0 ms | 0 ms | 1 ms |
| 500 | check | 11 ms | 5 ms | 5 ms |
| 500 | flow | 22 ms | 15 ms | 12 ms |
| 500 | stress | 44 ms | 42 ms | 40 ms |
| 500 | force | 132 ms | 127 ms | 121 ms |
| 500 | total | 215 ms | 191 ms | 181 ms |
| 2,000 | parse | 1 ms | 0 ms | 1 ms |
| 2,000 | import | 5 ms | 8 ms | 7 ms |
| 2,000 | prepare | 4 ms | 2 ms | 3 ms |
| 2,000 | check | 20 ms | 21 ms | 20 ms |
| 2,000 | flow | 110 ms | 111 ms | 191 ms |
| 2,000 | stress | 420 ms | 412 ms | 411 ms |
| 2,000 | force | 696 ms | 744 ms | 721 ms |
| 2,000 | total | 1.26 s | 1.30 s | 1.35 s |

## Smaller checks: random draws, CSV reading, Force arrangement

**OK** Times for the same job repeated; the first run is the one a person feels, the later ones show the warmed-up speed.

| Check | Run 1 | Run 2 | Run 3 | Run 4 | Run 5 |
|---|---:|---:|---:|---:|---:|
| 1,000,000 normal draws | 17 ms | 15 ms | 17 ms | 15 ms | 15 ms |
| CSV reading, 120,115 rows | 25 ms | 10 ms | 16 ms | 33 ms | 24 ms |
| Force arrangement, 3,000 items | 1.14 s | 1.13 s | 1.13 s |  |  |

## Raw data

```json
{
 "version": "2026.10.15.1541",
 "quick": false,
 "info": {
  "ua": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:159.0) Gecko/20100101 Firefox/159.0",
  "threads": 16,
  "mem": null,
  "gpu": "unnamed adapter",
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
   "cpuMs": 505,
   "cpuTruth": 0.149,
   "gpuMs": 749,
   "gpuTruth": 0.153,
   "parts": {
    "sketch": 13,
    "upload": 1,
    "table": 29,
    "weights": 100,
    "steps": 505,
    "read": 101
   },
   "levels": 14,
   "t20": 0.156,
   "t40": 0.154
  },
  {
   "kind": "moderate",
   "n": 5000,
   "cpuMs": 547,
   "cpuTruth": 0.159,
   "gpuMs": 1112,
   "gpuTruth": 0.155,
   "parts": {
    "sketch": 29,
    "upload": 1,
    "table": 76,
    "weights": 101,
    "steps": 804,
    "read": 101
   },
   "levels": 16,
   "t20": 0.157,
   "t40": 0.155
  },
  {
   "kind": "moderate",
   "n": 10000,
   "cpuMs": 1750,
   "cpuTruth": 0.164,
   "gpuMs": 2104,
   "gpuTruth": 0.165,
   "parts": {
    "sketch": 65,
    "upload": 1,
    "table": 122,
    "weights": 101,
    "steps": 1714,
    "read": 101
   },
   "levels": 16,
   "t20": 0.169,
   "t40": 0.166
  },
  {
   "kind": "complex",
   "n": 5000,
   "cpuMs": 513,
   "cpuTruth": 0.144,
   "gpuMs": 1104,
   "gpuTruth": 0.143,
   "parts": {
    "sketch": 54,
    "upload": 1,
    "table": 41,
    "weights": 101,
    "steps": 806,
    "read": 101
   },
   "levels": 10,
   "t20": 0.144,
   "t40": 0.143
  },
  {
   "kind": "complex",
   "n": 9999,
   "cpuMs": 1658,
   "cpuTruth": 0.147,
   "gpuMs": 2173,
   "gpuTruth": 0.156,
   "parts": {
    "sketch": 75,
    "upload": 0,
    "table": 180,
    "weights": 102,
    "steps": 1714,
    "read": 102
   },
   "levels": 8,
   "t20": 0.158,
   "t40": 0.157
  },
  {
   "kind": "moderate",
   "n": 20000,
   "cpuMs": 5224,
   "cpuTruth": 0.162,
   "gpuMs": 8915,
   "gpuTruth": 0.164,
   "parts": {
    "sketch": 126,
    "upload": 1,
    "table": 2335,
    "weights": 100,
    "steps": 6253,
    "read": 100
   },
   "levels": 18,
   "t20": 0.171,
   "t40": 0.167
  }
 ],
 "cold": [
  {
   "n": 500,
   "first": 215,
   "second": 191,
   "third": 181
  },
  {
   "n": 2000,
   "first": 1256,
   "second": 1298,
   "third": 1354
  }
 ],
 "small": {
  "draws": [
   17,
   15,
   17,
   15,
   15
  ],
  "csv": [
   25,
   10,
   16,
   33,
   24
  ],
  "force": [
   1139,
   1132,
   1126
  ]
 }
}
```
