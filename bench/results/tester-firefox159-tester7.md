# Net Flow Map Tester results

Version 2026.10.15.1625 · run 2026-10-15T20:29:31.122Z · took 150.7 s

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

**OK** The best graphics-card version was faster in 7 of 7 runs (middle 3.4×), and as true or truer (within 3%) in 7 of 7. Truth: lower is truer.

| Network | Items | Processor time | Processor truth | Old steps time | Old steps truth | Parallel pairs time | truth | + 5 clean-up steps time | truth | Best card faster by |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| moderate | 2,000 | 459 ms | 0.149 | 278 ms | 0.153 | 99 ms | 0.154 | 100 ms | 0.153 | 4.6× |
| moderate | 5,000 | 593 ms | 0.159 | 346 ms | 0.155 | 302 ms | 0.156 | 300 ms | 0.155 | 2× |
| moderate | 10,000 | 2.04 s | 0.164 | 557 ms | 0.165 | 804 ms | 0.161 | 804 ms | 0.161 | 3.7× |
| complex | 5,000 | 471 ms | 0.144 | 296 ms | 0.143 | 301 ms | 0.144 | 200 ms | 0.143 | 1.6× |
| complex | 9,999 | 1.85 s | 0.147 | 540 ms | 0.156 | 904 ms | 0.149 | 803 ms | 0.148 | 3.4× |
| moderate | 20,000 | 5.88 s | 0.162 | 1.26 s | 0.166 | 6.13 s | 0.163 | 7.13 s | 0.162 | 4.7× |
| moderate | 30,000 | 2.76 s | 0.211 | 2.61 s | 0.165 | 30.1 s | 0.163 | 27.3 s | 0.162 | 1.1× |

_Above 20,000 items the app's best quality falls back to the quick sample, so the processor truth there is the quick one._

_Graphics-card time covers everything: the 60-pivot sketch (made while the card builds the table), the upload, the hop table, 40 steps and reading the picture back. The processor time is the app's best-quality arrangement, which also includes the overlap clean-up that the graphics-card picture has not had yet, so the graphics-card truth is slightly flattering._

## Parallel-pairs variants

**OK** Ran 12 variants; compare time and truth in the table.

| Network | Variant | Total time | Truth |
|---|---:|---:|---:|
| complex 9,999 | parallel pairs, 3 sweeps | 935 ms | 0.149 |
| complex 9,999 | parallel pairs, 2 sweeps | 578 ms | 0.154 |
| complex 9,999 | parallel pairs, 3 sweeps + 5 clean-up steps | 983 ms | 0.148 |
| complex 9,999 | parallel pairs, 3 sweeps + 15 clean-up steps | 881 ms | 0.148 |
| complex 9,999 | old steps, relaxed 1.2, 60 | 378 ms | 0.156 |
| moderate 10,000 | parallel pairs, 3 sweeps | 864 ms | 0.161 |
| moderate 10,000 | parallel pairs, 2 sweeps | 675 ms | 0.164 |
| moderate 10,000 | parallel pairs, 3 sweeps + 5 clean-up steps | 878 ms | 0.161 |
| moderate 10,000 | parallel pairs, 4 sweeps | 876 ms | 0.16 |
| moderate 30,000 | parallel pairs, 2 sweeps | 14.6 s | 0.163 |
| moderate 30,000 | parallel pairs, 2 sweeps + 5 clean-up steps | 12.4 s | 0.162 |
| moderate 30,000 | parallel pairs, 3 sweeps | 17.8 s | 0.162 |
| moderate 10,000 | parts (parallel pairs): sketch / setup / table+weights / sweeps / read-back | 57 / 0 / 177 / 504 / 101 ms |  |

## Raw data

```json
{
 "version": "2026.10.15.1625",
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
  "move": 0,
  "sgdDiffPct": 0.4,
  "sgdMove": 1.383,
  "sgdOk": true
 },
 "ladder": [
  {
   "kind": "moderate",
   "n": 2000,
   "cpuMs": 459,
   "cpuTruth": 0.149,
   "gpuMs": 278,
   "gpuTruth": 0.153,
   "sgdMs": 99,
   "sgdTruth": 0.154,
   "sgdError": null,
   "sgdPolishMs": 100,
   "sgdPolishTruth": 0.153,
   "sweeps": 3,
   "parts": {
    "sketch": 12,
    "setup": 0,
    "stepsAndTable": 66,
    "read": 66
   },
   "sgdParts": {
    "stepsAndTable": 88,
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
   "cpuMs": 593,
   "cpuTruth": 0.159,
   "gpuMs": 346,
   "gpuTruth": 0.155,
   "sgdMs": 302,
   "sgdTruth": 0.156,
   "sgdError": null,
   "sgdPolishMs": 300,
   "sgdPolishTruth": 0.155,
   "sweeps": 3,
   "parts": {
    "sketch": 26,
    "setup": 1,
    "stepsAndTable": 117,
    "read": 117
   },
   "sgdParts": {
    "stepsAndTable": 274,
    "read": 271
   },
   "split": 20,
   "levels": 16,
   "t20": 0.156,
   "t30": 0.155
  },
  {
   "kind": "moderate",
   "n": 10000,
   "cpuMs": 2040,
   "cpuTruth": 0.164,
   "gpuMs": 557,
   "gpuTruth": 0.165,
   "sgdMs": 804,
   "sgdTruth": 0.161,
   "sgdError": null,
   "sgdPolishMs": 804,
   "sgdPolishTruth": 0.161,
   "sweeps": 3,
   "parts": {
    "sketch": 55,
    "setup": 1,
    "stepsAndTable": 298,
    "read": 100
   },
   "sgdParts": {
    "stepsAndTable": 751,
    "read": 500
   },
   "split": 10,
   "levels": 18,
   "t20": 0.168,
   "t30": 0.166
  },
  {
   "kind": "complex",
   "n": 5000,
   "cpuMs": 471,
   "cpuTruth": 0.144,
   "gpuMs": 296,
   "gpuTruth": 0.143,
   "sgdMs": 301,
   "sgdTruth": 0.144,
   "sgdError": null,
   "sgdPolishMs": 200,
   "sgdPolishTruth": 0.143,
   "sweeps": 3,
   "parts": {
    "sketch": 28,
    "setup": 0,
    "stepsAndTable": 66,
    "read": 66
   },
   "sgdParts": {
    "stepsAndTable": 273,
    "read": 270
   },
   "split": 20,
   "levels": 10,
   "t20": 0.144,
   "t30": 0.143
  },
  {
   "kind": "complex",
   "n": 9999,
   "cpuMs": 1854,
   "cpuTruth": 0.147,
   "gpuMs": 540,
   "gpuTruth": 0.156,
   "sgdMs": 904,
   "sgdTruth": 0.149,
   "sgdError": null,
   "sgdPolishMs": 803,
   "sgdPolishTruth": 0.148,
   "sweeps": 3,
   "parts": {
    "sketch": 54,
    "setup": 1,
    "stepsAndTable": 282,
    "read": 100
   },
   "sgdParts": {
    "stepsAndTable": 847,
    "read": 601
   },
   "split": 10,
   "levels": 8,
   "t20": 0.158,
   "t30": 0.157
  },
  {
   "kind": "moderate",
   "n": 20000,
   "cpuMs": 5881,
   "cpuTruth": 0.162,
   "gpuMs": 1261,
   "gpuTruth": 0.166,
   "sgdMs": 6129,
   "sgdTruth": 0.163,
   "sgdError": null,
   "sgdPolishMs": 7134,
   "sgdPolishTruth": 0.162,
   "sweeps": 2,
   "parts": {
    "sketch": 193,
    "setup": 2,
    "stepsAndTable": 702,
    "read": 200
   },
   "sgdParts": {
    "stepsAndTable": 5728,
    "read": 504
   },
   "split": 5,
   "levels": 18,
   "t20": 0.17,
   "t30": 0.167
  },
  {
   "kind": "moderate",
   "n": 30000,
   "cpuMs": 2761,
   "cpuTruth": 0.211,
   "gpuMs": 2614,
   "gpuTruth": 0.165,
   "sgdMs": 30081,
   "sgdTruth": 0.163,
   "sgdError": null,
   "sgdPolishMs": 27281,
   "sgdPolishTruth": 0.162,
   "sweeps": 2,
   "parts": {
    "sketch": 256,
    "setup": 1,
    "stepsAndTable": 1309,
    "read": 301
   },
   "sgdParts": {
    "stepsAndTable": 28934,
    "read": 202
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
    "variant": "parallel pairs, 3 sweeps",
    "totalMs": 935,
    "truth": 0.149,
    "split": 1
   },
   {
    "kind": "complex",
    "n": 9999,
    "variant": "parallel pairs, 2 sweeps",
    "totalMs": 578,
    "truth": 0.154,
    "split": 1
   },
   {
    "kind": "complex",
    "n": 9999,
    "variant": "parallel pairs, 3 sweeps + 5 clean-up steps",
    "totalMs": 983,
    "truth": 0.148,
    "split": 10
   },
   {
    "kind": "complex",
    "n": 9999,
    "variant": "parallel pairs, 3 sweeps + 15 clean-up steps",
    "totalMs": 881,
    "truth": 0.148,
    "split": 10
   },
   {
    "kind": "complex",
    "n": 9999,
    "variant": "old steps, relaxed 1.2, 60",
    "totalMs": 378,
    "truth": 0.156,
    "split": 10
   },
   {
    "kind": "moderate",
    "n": 10000,
    "variant": "parallel pairs, 3 sweeps",
    "totalMs": 864,
    "truth": 0.161,
    "split": 1
   },
   {
    "kind": "moderate",
    "n": 10000,
    "variant": "parallel pairs, 2 sweeps",
    "totalMs": 675,
    "truth": 0.164,
    "split": 1
   },
   {
    "kind": "moderate",
    "n": 10000,
    "variant": "parallel pairs, 3 sweeps + 5 clean-up steps",
    "totalMs": 878,
    "truth": 0.161,
    "split": 10
   },
   {
    "kind": "moderate",
    "n": 10000,
    "variant": "parallel pairs, 4 sweeps",
    "totalMs": 876,
    "truth": 0.16,
    "split": 1
   },
   {
    "kind": "moderate",
    "n": 30000,
    "variant": "parallel pairs, 2 sweeps",
    "totalMs": 14564,
    "truth": 0.163,
    "split": 1
   },
   {
    "kind": "moderate",
    "n": 30000,
    "variant": "parallel pairs, 2 sweeps + 5 clean-up steps",
    "totalMs": 12410,
    "truth": 0.162,
    "split": 4
   },
   {
    "kind": "moderate",
    "n": 30000,
    "variant": "parallel pairs, 3 sweeps",
    "totalMs": 17780,
    "truth": 0.162,
    "split": 1
   }
  ],
  "parts": {
   "sketch": 57,
   "setup": 0,
   "tableAndWeights": 177,
   "steps60": 504,
   "read": 101,
   "levels": 18
  }
 },
 "groups": null,
 "cold": null,
 "small": null
}
```
