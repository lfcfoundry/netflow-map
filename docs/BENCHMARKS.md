# Benchmarks

Measured in two desktop browsers, because real data work happens there: **ungoogled-chromium 154** and **Firefox 158**, headless, on a 2-core, 7 GB Linux machine. Every table below is generated from the raw files in `bench/results/*.jsonl` by `node bench/report.js`, so the numbers here are the numbers in the files.

Libraries we compare against (all current npm releases, bundled into the benchmark page): Papa Parse, d3-dsv, d3-force, graphology-layout-forceatlas2, dagre, ELK, graphology Louvain, d3-random, jStat, expr-eval, gifenc, graphology and Cytoscape.

## How the measurements were made

- Every job runs in a fresh page. Times are the median of up to three runs (seven interleaved runs for the CSV grid); anything slower than 600 ms is run once.
- A job that passes its time limit (5 minutes in the scale runs) or loses its page is recorded as a failure, and the browser is restarted. A bigger size of the same job is skipped when the smaller one failed, or when even a straight-line projection from it passes the limit.
- Firefox rounds its timer to 1 ms, so differences under about 3 ms are not meaningful there. Firefox does not report JS heap; its memory is whole-process memory, which is noisy at the MB scale.
- "Layout score" (also called truth) is the sampled stress of the picture: how far page distances are from hop counts after the best single scale factor (lower is truer). d3-force and ForceAtlas2 place points with no size and leave most items lying on top of each other (section 12), while ours keeps every sized item apart. That costs a little truth, so the score favors them; we count it as a standard we hold ourselves to, not a handicap to hide.
- Three kinds of structure at every scale: **simple** is a plain tree (two columns); **moderate** has communities, about 3 links per item, weights, groups and labels; **complex** adds hubs, cycles, self-links, repeated links, 12 columns, quoted text with commas, doubled quotes and line breaks, four state columns, and about 4 links per item.
- The earlier Node-only numbers in `RESEARCH-open-source-comparison.md` used a different Chromium (Playwright's 141) for its browser checks; everything here is ungoogled-chromium 154 and Firefox 158.

## Summary: are the wins consistent across both browsers?

| Area | Chromium 154 | Firefox 158 | Verdict |
|---|---|---|---|
| CSV reading vs Papa Parse (21 table shapes) | faster in 20, median 0.70× the time, worst 1.13× | faster in 18, median 0.82×, worst 1.32× | Consistent win on quoted, long-field and wide data; parity on small unquoted data |
| CSV reading, whole files of each structure (9 files) | at or under Papa in 3, up to 1.5× slower in the rest | at or under Papa in 2, up to 1.4× slower (one 6 ms parse read 2× against Firefox's 1 ms timer) | Parity, within about ±40%, noise-limited |
| Stress layout vs d3-force (20 cases, 200 to 10,000 items) | faster in 20 of 20 | faster in 20 of 20 | Consistent win: 2.4 to 12× faster up to 3,000 items, 14 to 23× at 10,000 (10 to 19× against ForceAtlas2) |
| Stress layout truth vs d3-force and ForceAtlas2 | as true or truer in 17 of 20 (both) | 17 of 20 (both) | Win up to 3,000 items (15 to 58% truer); at 10,000 items 10% truer to 9% less true than d3-force and 4% truer to 17% less true than ForceAtlas2 (was 7 to 28% less true) |
| **Items left touching (section 12)** | **0 in all 40 test layouts per browser; d3-force and ForceAtlas2 leave 70 to 100% of items overlapping at the same item sizes (ForceAtlas2 on a plain tree: 9%)** | same (the rule is in the code, and a test checks it) | **Vital advantage**: the picture can be read; the others need a zoom of 2.6× to 48× to separate their worst pair, or a slower collision pass |
| **Neighborhood preservation (section 15; 4 networks, Node, single runs)** | **Stress is below d3-force, d3-force + forceCollide and ForceAtlas2 in all four** | not run | **Weakness**: distance truth and local closeness disagree; Force is closer to the competitors |
| **Best-quality Stress (section 16; 6 networks, 10,000 items)** | **truer than d3-force and ForceAtlas2 in all 3 (0.137 to 0.161 against 0.18 to 0.21), 6.0 to 9.8× faster than the faster of them** | **same (0.136 to 0.163), 6.0 to 7.6× faster than the faster of them** | **Win, opt-in: 2.5 to 3.8 s at 10,000 items against 1.0 to 1.7 s for the normal arrangement; no overlaps** |
| **Closeness arrangement (section 17; 9 networks, 1,000 to 10,000 items, Node)** | **neighborhood score 1.3 to 4× the best of ForceAtlas2 and d3-force in all 9; distance truth 8 to 37% worse on moderate and complex networks, level or better on trees** | 18 browser runs: 0.4 to 5.3 s, nothing touching | **Win on the neighborhood question, loss on distances: a separate choice, not a replacement** |
| Force layout vs d3-force | faster in 20 of 20 | faster in 20 of 20 | Consistent win |
| Layered drawing vs dagre / ELK | 7 to 13× faster than dagre, but 7 to 117% more crossings | same | Speed win, quality loss (unchanged) |
| Formulas vs expr-eval | 3.8× faster | 5.0× faster | Consistent win |
| Poisson / binomial draws vs d3-random | 6.4 / 2.4× faster | 3.9 / 1.5× faster | Consistent win |
| Normal / lognormal draws vs d3-random, jStat | normal 2.3 / 2.5× faster (jStat / d3-random), lognormal 1.3× faster | normal 1.4 / 1.2× slower, lognormal and exponential 1.06 to 1.2× faster | Win in Chromium; tie or small loss in Firefox (section 14) |
| GIF export vs gifenc (shared palette) | 31 frames 1.24× faster, 4 frames 1.8× slower; color error 10 to 12× lower; files 7 to 8% larger | 31 frames 1.5× faster, 4 frames level (84 against 80 ms); color error 13 to 16× lower; files 6 to 7% larger | Win on speed for longer animations and on quality everywhere; a loss on the 4-frame run in Chromium and on file size (section 14) |
| Found groups vs Louvain | equal or better match at 1,000 and 3,000 items, 1.4 to 1.7× faster; merges planted groups at 300 | same, 1.4 to 2.5× faster | Win at size |
| Memory at 10,000 items | 5.9 MB heap (1.2 MB typed) vs graphology 11.1 and Cytoscape 56.8 | process memory only, too noisy at this size (graphology +92 MB, Cytoscape +204 MB) | Win in Chromium; Firefox points the same way |

## 1. CSV: why it was slower than Papa Parse, and what changed

**Cause.** The first reader built every field one character at a time by adding to a string. That costs time proportional to every character, and it got much worse with long fields: at 200 characters per field it took 3.2 s in Chromium (and 1.7 s in Firefox) for 50,000 rows against 42 and 128 ms for Papa and d3-dsv. Papa and d3 jump to the next delimiter or quote with the engine's own search and cut the text out in one piece.

**Fix.** A line with no quote mark is cut with the engine's own `split`; a record with quotes jumps from quote to quote and takes ordinary text in whole runs. The new reader gives identical rows to the old one (6,000 random tables are compared in `test/importers.test.js`, and a separate 120,000-case check found no differences).

**Chromium 154** (50,000 rows, 6 columns)

| data | ours: first version | ours: now | Papa Parse | d3-dsv | speedup |
| --- | ---: | ---: | ---: | ---: | ---: |
| quoted 0, field length 12 | 96 ms | 28 ms | 40 ms | 25 ms | 3.39× |
| quoted 0.1, field length 12 | 116 ms | 38 ms | 47 ms | 60 ms | 3.08× |
| quoted 0.5, field length 12 | 148 ms | 53 ms | 93 ms | 84 ms | 2.77× |
| quoted 1, field length 12 | 192 ms | 66 ms | 143 ms | 135 ms | 2.92× |
| quoted 0, field length 4 | 36 ms | 30 ms | 51 ms | 16 ms | 1.21× |
| quoted 0, field length 64 | 804 ms | 33 ms | 34 ms | 64 ms | 24.14× |
| quoted 0, field length 200 | 3.2 s | 27 ms | 42 ms | 128 ms | 117.31× |
| quoted 0.5, field length 12 | 193 ms | 55 ms | 85 ms | 84 ms | 3.50× |

**Firefox 158** (50,000 rows, 6 columns)

| data | ours: first version | ours: now | Papa Parse | d3-dsv | speedup |
| --- | ---: | ---: | ---: | ---: | ---: |
| quoted 0, field length 12 | 71 ms | 55 ms | 67 ms | 60 ms | 1.29× |
| quoted 0.1, field length 12 | 85 ms | 85 ms | 87 ms | 81 ms | 1.00× |
| quoted 0.5, field length 12 | 128 ms | 74 ms | 112 ms | 86 ms | 1.73× |
| quoted 1, field length 12 | 116 ms | 77 ms | 154 ms | 124 ms | 1.51× |
| quoted 0, field length 4 | 52 ms | 48 ms | 54 ms | 54 ms | 1.08× |
| quoted 0, field length 64 | 525 ms | 72 ms | 97 ms | 114 ms | 7.29× |
| quoted 0, field length 200 | 1.7 s | 75 ms | 128 ms | 236 ms | 22.12× |
| quoted 0.5, field length 12 | 101 ms | 66 ms | 109 ms | 87 ms | 1.53× |

**What is left is not parsing.** Parsing a whole file is now at parity with Papa and d3-dsv. Building a graph from the rows takes 2 to 5 times as long as parsing them, because every row becomes items and links with their own text cleanup, duplicate checks and attribute objects. Three changes cut that by about 20 to 30%: printable-ASCII text skips the Unicode and control-character clean-up, repeated-link checks use one number per pair instead of a joined string, and extra-column lists are worked out once instead of once per row. A hand test of the floor (the engine's own `split` on every line, with no quote handling at all) took the same time as the reader, so further gains need a different approach, not tuning.

**A bug found on the way.** In Node 22, one whole-text search for a carriage return inside the optimized reader froze it for 85 seconds after a few runs (no such stall appeared in either browser). The check is now done line by line, and 120 runs of each structure showed no stall.

### Parsing grid (50,000 rows unless stated)

**Chromium 154**

| rows | cols | share quoted | field length | share with line breaks | delimiter | ours | Papa Parse | d3-dsv | ours ÷ Papa |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1,000 | 6 | 0 | 12 | 0 | , | 0.5 ms | 0.8 ms | 1.2 ms | 0.63× |
| 10,000 | 6 | 0 | 12 | 0 | , | 7.5 ms | 9.0 ms | 6.5 ms | 0.83× |
| 100,000 | 6 | 0 | 12 | 0 | , | 80 ms | 94 ms | 122 ms | 0.85× |
| 1,000,000 | 6 | 0 | 12 | 0 | , | 853 ms | 934 ms | 934 ms | 0.91× |
| 50,000 | 2 | 0 | 12 | 0 | , | 25 ms | 34 ms | 18 ms | 0.73× |
| 50,000 | 6 | 0 | 12 | 0 | , | 28 ms | 40 ms | 25 ms | 0.70× |
| 50,000 | 12 | 0 | 12 | 0 | , | 61 ms | 54 ms | 68 ms | 1.13× |
| 50,000 | 30 | 0 | 12 | 0 | , | 133 ms | 142 ms | 164 ms | 0.94× |
| 50,000 | 6 | 0 | 12 | 0 | , | 48 ms | 63 ms | 40 ms | 0.76× |
| 50,000 | 6 | 0.1 | 12 | 0 | , | 38 ms | 47 ms | 60 ms | 0.81× |
| 50,000 | 6 | 0.5 | 12 | 0 | , | 53 ms | 93 ms | 84 ms | 0.57× |
| 50,000 | 6 | 1 | 12 | 0 | , | 66 ms | 143 ms | 135 ms | 0.46× |
| 50,000 | 6 | 0 | 4 | 0 | , | 30 ms | 51 ms | 16 ms | 0.58× |
| 50,000 | 6 | 0 | 12 | 0 | , | 25 ms | 36 ms | 33 ms | 0.70× |
| 50,000 | 6 | 0 | 64 | 0 | , | 33 ms | 34 ms | 64 ms | 0.97× |
| 50,000 | 6 | 0 | 200 | 0 | , | 27 ms | 42 ms | 128 ms | 0.65× |
| 50,000 | 6 | 0.5 | 12 | 0 | , | 56 ms | 106 ms | 96 ms | 0.53× |
| 50,000 | 6 | 0.5 | 12 | 0.05 | , | 55 ms | 85 ms | 84 ms | 0.65× |
| 50,000 | 6 | 0.5 | 12 | 0.3 | , | 51 ms | 90 ms | 103 ms | 0.57× |
| 50,000 | 6 | 0 | 12 | 0 | tab | 24 ms | 40 ms | 25 ms | 0.61× |
| 50,000 | 6 | 0.2 | 12 | 0 | ; | 43 ms | 61 ms | 67 ms | 0.71× |

**Firefox 158**

| rows | cols | share quoted | field length | share with line breaks | delimiter | ours | Papa Parse | d3-dsv | ours ÷ Papa |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1,000 | 6 | 0 | 12 | 0 | , | 1.0 ms | 2.0 ms | 1.0 ms | 0.50× |
| 10,000 | 6 | 0 | 12 | 0 | , | 15 ms | 13 ms | 21 ms | 1.15× |
| 100,000 | 6 | 0 | 12 | 0 | , | 76 ms | 70 ms | 80 ms | 1.09× |
| 1,000,000 | 6 | 0 | 12 | 0 | , | 746 ms | 566 ms | 707 ms | 1.32× |
| 50,000 | 2 | 0 | 12 | 0 | , | 21 ms | 32 ms | 18 ms | 0.66× |
| 50,000 | 6 | 0 | 12 | 0 | , | 55 ms | 67 ms | 60 ms | 0.82× |
| 50,000 | 12 | 0 | 12 | 0 | , | 101 ms | 114 ms | 157 ms | 0.89× |
| 50,000 | 30 | 0 | 12 | 0 | , | 216 ms | 235 ms | 340 ms | 0.92× |
| 50,000 | 6 | 0 | 12 | 0 | , | 56 ms | 63 ms | 63 ms | 0.89× |
| 50,000 | 6 | 0.1 | 12 | 0 | , | 85 ms | 87 ms | 81 ms | 0.98× |
| 50,000 | 6 | 0.5 | 12 | 0 | , | 74 ms | 112 ms | 86 ms | 0.66× |
| 50,000 | 6 | 1 | 12 | 0 | , | 77 ms | 154 ms | 124 ms | 0.50× |
| 50,000 | 6 | 0 | 4 | 0 | , | 48 ms | 54 ms | 54 ms | 0.89× |
| 50,000 | 6 | 0 | 12 | 0 | , | 60 ms | 68 ms | 82 ms | 0.88× |
| 50,000 | 6 | 0 | 64 | 0 | , | 72 ms | 97 ms | 114 ms | 0.74× |
| 50,000 | 6 | 0 | 200 | 0 | , | 75 ms | 128 ms | 236 ms | 0.59× |
| 50,000 | 6 | 0.5 | 12 | 0 | , | 76 ms | 107 ms | 94 ms | 0.71× |
| 50,000 | 6 | 0.5 | 12 | 0.05 | , | 66 ms | 109 ms | 87 ms | 0.61× |
| 50,000 | 6 | 0.5 | 12 | 0.3 | , | 69 ms | 117 ms | 95 ms | 0.59× |
| 50,000 | 6 | 0 | 12 | 0 | tab | 52 ms | 71 ms | 70 ms | 0.73× |
| 50,000 | 6 | 0.2 | 12 | 0 | ; | 70 ms | 81 ms | 71 ms | 0.86× |

### Whole files by structure (parse only, then the full import into a graph)

**Chromium 154**

| structure | rows | size | ours: parse | Papa Parse | d3-dsv | ours ÷ Papa | ours: full import into a graph | items |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| simple | 9,999 | 0.1 MB | 4.0 ms | 5.3 ms | 6.0 ms | 0.75× | 26 ms | 10,000 |
| simple | 99,999 | 1.3 MB | 43 ms | 32 ms | 46 ms | 1.35× | 287 ms | 100,000 |
| simple | 499,999 | 7.2 MB | 269 ms | 282 ms | 245 ms | 0.95× | 1.5 s | 500,000 |
| moderate | 29,938 | 0.8 MB | 32 ms | 30 ms | 13 ms | 1.06× | 114 ms | 10,000 |
| moderate | 299,757 | 8.4 MB | 247 ms | 163 ms | 197 ms | 1.52× | 1.2 s | 100,000 |
| moderate | 1,500,196 | 44.8 MB | 1.1 s | 945 ms | 946 ms | 1.13× | 7.2 s | 500,000 |
| complex | 41,975 | 5.2 MB | 54 ms | 71 ms | 49 ms | 0.76× | 197 ms | 10,000 |
| complex | 420,519 | 53.1 MB | 603 ms | 573 ms | 684 ms | 1.05× | 2.6 s | 100,000 |
| complex | 2,100,244 | 270 MB | 3.7 s | 3.0 s | 3.4 s | 1.21× | 15 s | 500,000 |

**Firefox 158**

| structure | rows | size | ours: parse | Papa Parse | d3-dsv | ours ÷ Papa | ours: full import into a graph | items |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| simple | 9,999 | 0.1 MB | 6.0 ms | 3.0 ms | 2.0 ms | 2.00× | 31 ms | 10,000 |
| simple | 99,999 | 1.3 MB | 36 ms | 62 ms | 52 ms | 0.58× | 326 ms | 100,000 |
| simple | 499,999 | 7.2 MB | 209 ms | 154 ms | 122 ms | 1.36× | 1.7 s | 500,000 |
| moderate | 29,938 | 0.8 MB | 29 ms | 21 ms | 20 ms | 1.38× | 92 ms | 10,000 |
| moderate | 299,757 | 8.4 MB | 233 ms | 187 ms | 267 ms | 1.25× | 1.3 s | 100,000 |
| moderate | 1,500,196 | 44.8 MB | 1.2 s | 938 ms | 1.1 s | 1.28× | 9.2 s | 500,000 |
| complex | 41,975 | 5.2 MB | 78 ms | 75 ms | 91 ms | 1.04× | 173 ms | 10,000 |
| complex | 420,519 | 53.1 MB | 796 ms | 931 ms | 1.1 s | 0.85× | 2.6 s | 100,000 |
| complex | 2,100,244 | 270 MB | 5.0 s | 4.5 s | 5.5 s | 1.11× | 17 s | 500,000 |

Limits found: the import has always stopped at 200,000 items or 800,000 links as a safety cap; it is now a default that the caller can change (`importAny(text, { maxNodes, maxEdges })`), and these runs lifted it. Chromium cannot hold a text over about 512 million characters in one string: the 1,000,000-item complex file (about 4.2 million rows, 540 MB) fails there with "Invalid string length", while Firefox read and imported it (11 s to parse, 40 s to import).

## 2. Stress layout against d3-force, ForceAtlas2 and our Force layout

**Why Stress was slower than d3-force at some sizes.** Below 700 items it used every pair of items, kept as one small array per pair, and shuffled them in memory each pass. At 600 items that is 180,000 pairs held as 180,000 separate arrays, read in random order 30 times: 124 to 300 ns per update, against 14 to 25 ns once the same pairs sit in typed arrays and are read in order. Above that size, most of the time went to pushing overlapping items apart, not to the layout itself (80% at 20,000 items in a Node profile).

**What changed.**
- Pairs are held in typed arrays (two integer lists, two decimal lists) and swept in memory order; the random order is made once.
- Distances come from a flat list of neighbors (CSR) instead of per-item arrays and map lookups.
- All pairs are now used up to 4,000 items (was 700, then 3,000), with fewer passes as the count grows, because the sweep is now cheap enough. This is the largest single gain in layout truth: at 1,000 items the score went from 0.18 to 0.12.
- Bigger pieces use pivots plus each item's nearest 100 neighbors (60 above 20,000 items; section 13 explains why this was the change that mattered), and the pair count is capped by memory (about 12 million pairs).
- Overlap removal (section 12) uses a plain grid with a counting sort, a cell sized to the largest items, and a first stretch of crowded pictures so little is left to push apart. Stress at 20,000 items went from 6.2 s to about 1.4 s (Node measurement).

**Chromium 154** (time / layout score, lower score = truer)

| structure | items | Stress (now) | Stress (before) | Force | d3-force | ForceAtlas2 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| simple | 200 | 28 ms / 0.106 | 48 ms / 0.107 | 129 ms / 0.140 | 189 ms / 0.177 | 94 ms / 0.180 |
| simple | 600 | 119 ms / 0.121 | 538 ms / 0.120 | 358 ms / 0.151 | 625 ms / 0.204 | 767 ms / 0.195 |
| simple | 1,000 | 218 ms / 0.121 | 369 ms / 0.184 | 644 ms / 0.171 | 1.3 s / 0.208 | 1.2 s / 0.189 |
| simple | 3,000 | 1.6 s / 0.130 | 1.2 s / 0.222 | 2.5 s / 0.191 | 4.9 s / 0.217 | 4.8 s / 0.203 |
| simple | 10,000 | 1.2 s / 0.192 | 2.1 s / 0.245 | 5.3 s / 0.260 | 26 s / 0.210 | 23 s / 0.201 |
| moderate | 200 | 35 ms / 0.087 | 65 ms / 0.087 | 113 ms / 0.116 | 236 ms / 0.176 | 99 ms / 0.164 |
| moderate | 600 | 125 ms / 0.124 | 573 ms / 0.127 | 413 ms / 0.163 | 745 ms / 0.189 | 714 ms / 0.184 |
| moderate | 1,000 | 247 ms / 0.137 | 343 ms / 0.224 | 637 ms / 0.162 | 1.2 s / 0.198 | 1.2 s / 0.174 |
| moderate | 3,000 | 2.0 s / 0.151 | 1.3 s / 0.234 | 2.7 s / 0.168 | 4.7 s / 0.194 | 5.1 s / 0.176 |
| moderate | 10,000 | 1.6 s / 0.207 | 3.5 s / 0.233 | 6.2 s / 0.252 | 22 s / 0.190 | 24 s / 0.180 |
| complex | 200 | 24 ms / 0.119 | 54 ms / 0.124 | 115 ms / 0.130 | 238 ms / 0.150 | 111 ms / 0.140 |
| complex | 600 | 121 ms / 0.119 | 799 ms / 0.155 | 413 ms / 0.130 | 848 ms / 0.144 | 874 ms / 0.141 |
| complex | 1,000 | 266 ms / 0.124 | 359 ms / 0.238 | 661 ms / 0.140 | 1.6 s / 0.187 | 1.5 s / 0.147 |
| complex | 3,000 | 1.8 s / 0.138 | 1.4 s / 0.243 | 2.6 s / 0.157 | 4.8 s / 0.172 | 5.7 s / 0.185 |
| complex | 10,000 | 1.5 s / 0.205 | 4.3 s / 0.246 | 6.4 s / 0.207 | 24 s / 0.195 | 27 s / 0.179 |
| planted | 200 | 40 ms / 0.077 | 56 ms / 0.077 | 141 ms / 0.122 | 217 ms / 0.185 | 122 ms / 0.118 |
| planted | 600 | 186 ms / 0.109 | 666 ms / 0.115 | 476 ms / 0.137 | 765 ms / 0.184 | 710 ms / 0.162 |
| planted | 1,000 | 275 ms / 0.129 | 480 ms / 0.195 | 690 ms / 0.153 | 1.4 s / 0.192 | 1.3 s / 0.170 |
| planted | 3,000 | 1.8 s / 0.146 | 1.5 s / 0.215 | 2.7 s / 0.172 | 5.4 s / 0.195 | 5.6 s / 0.180 |
| planted | 10,000 | 1.5 s / 0.203 | 5.0 s / 0.233 | 6.5 s / 0.275 | 23 s / 0.188 | 24 s / 0.190 |

**Firefox 158**(time / layout score, lower score = truer)

| structure | items | Stress (now) | Stress (before) | Force | d3-force | ForceAtlas2 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| simple | 200 | 21 ms / 0.107 | 78 ms / 0.107 | 156 ms / 0.139 | 257 ms / 0.177 | 115 ms / 0.170 |
| simple | 600 | 168 ms / 0.121 | 1.4 s / 0.120 | 424 ms / 0.151 | 869 ms / 0.204 | 587 ms / 0.195 |
| simple | 1,000 | 212 ms / 0.122 | 746 ms / 0.187 | 750 ms / 0.172 | 1.6 s / 0.208 | 1.1 s / 0.203 |
| simple | 3,000 | 1.6 s / 0.130 | 2.6 s / 0.215 | 3.4 s / 0.191 | 8.0 s / 0.217 | 4.5 s / 0.208 |
| simple | 10,000 | 1.4 s / 0.190 | 3.5 s / 0.253 | 8.6 s / 0.260 | 32 s / 0.210 | 20 s / 0.198 |
| moderate | 200 | 62 ms / 0.087 | 70 ms / 0.087 | 134 ms / 0.117 | 238 ms / 0.176 | 138 ms / 0.151 |
| moderate | 600 | 157 ms / 0.124 | 1.5 s / 0.127 | 993 ms / 0.163 | 943 ms / 0.189 | 486 ms / 0.178 |
| moderate | 1,000 | 641 ms / 0.136 | 827 ms / 0.212 | 1.3 s / 0.163 | 1.7 s / 0.198 | 1.2 s / 0.179 |
| moderate | 3,000 | 2.4 s / 0.151 | 2.7 s / 0.237 | 4.5 s / 0.168 | 6.9 s / 0.194 | 4.0 s / 0.184 |
| moderate | 10,000 | 1.8 s / 0.204 | 6.7 s / 0.229 | 10 s / 0.252 | 30 s / 0.190 | 21 s / 0.175 |
| complex | 200 | 36 ms / 0.119 | 86 ms / 0.123 | 142 ms / 0.130 | 230 ms / 0.150 | 107 ms / 0.151 |
| complex | 600 | 141 ms / 0.119 | 1.7 s / 0.151 | 497 ms / 0.130 | 998 ms / 0.144 | 559 ms / 0.140 |
| complex | 1,000 | 255 ms / 0.124 | 941 ms / 0.247 | 1.0 s / 0.140 | 1.8 s / 0.187 | 1.0 s / 0.146 |
| complex | 3,000 | 2.2 s / 0.138 | 3.5 s / 0.248 | 4.1 s / 0.158 | 9.6 s / 0.172 | 4.9 s / 0.169 |
| complex | 10,000 | 2.0 s / 0.207 | 7.7 s / 0.247 | 9.4 s / 0.206 | 34 s / 0.195 | 23 s / 0.179 |
| planted | 200 | 53 ms / 0.078 | 101 ms / 0.077 | 127 ms / 0.122 | 300 ms / 0.185 | 99 ms / 0.148 |
| planted | 600 | 158 ms / 0.109 | 1.5 s / 0.115 | 502 ms / 0.137 | 965 ms / 0.184 | 750 ms / 0.152 |
| planted | 1,000 | 303 ms / 0.129 | 901 ms / 0.200 | 1.0 s / 0.153 | 2.3 s / 0.192 | 1.0 s / 0.172 |
| planted | 3,000 | 2.2 s / 0.145 | 3.3 s / 0.216 | 4.1 s / 0.172 | 7.7 s / 0.195 | 4.1 s / 0.189 |
| planted | 10,000 | 2.1 s / 0.198 | 6.5 s / 0.243 | 8.9 s / 0.276 | 34 s / 0.188 | 21 s / 0.187 |

Reading it: **time** is lower for Stress in all 40 cases (20 per browser): 2.4 to 12× faster than d3-force up to 3,000 items, and 14 to 23× faster at 10,000 items (10 to 19× faster than ForceAtlas2). **Truth** is better than both competitors up to 3,000 items (ours scores 0.42 to 0.86 of their score). At 10,000 items it is 10% truer to 9% less true than d3-force and 4% truer to 17% less true than ForceAtlas2; that is 17 of 20 cases as true or truer in each browser, and the three that are not are the moderate, complex and planted networks at 10,000 items. The last round measured 7 to 28% worse at 10,000 items. Section 13 says what closed most of the gap, what was tried and did not help, and what is left. The "before" column is the engine as committed before the first round of this work, loaded in the same page; at 3,000 items in Chromium the engine now takes 1.2 to 1.5× longer than that column (in Firefox it is 1.1 to 1.6× faster) because it now also guarantees that no two items touch (section 12).

Memory trade: at 4,000 items the all-pairs method holds 8 million pairs (16 bytes each, 128 MB; designed, not separately measured), several times the old method's footprint at that size, and then returns it. Above 3,000 items it uses less memory than before.

## 3. What typed arrays cost, and what they save

**Chromium 154: the sweep itself, same pairs held three ways**

| items | pairs | held as | build | 30 sweeps | per update | heap |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 300 | 44,850 | arrays | 7.9 ms | 67 ms | 50 ns | 1.7 MB |
| 300 | 44,850 | typedIndexed | 3.7 ms | 44 ms | 33 ns | 1 MB |
| 300 | 44,850 | typedSeq | 8.5 ms | 37 ms | 27 ns | 2 MB |
| 600 | 179,700 | arrays | 28 ms | 671 ms | 124 ns | 8.3 MB |
| 600 | 179,700 | typedIndexed | 6.8 ms | 166 ms | 31 ns | 3.7 MB |
| 600 | 179,700 | typedSeq | 17 ms | 77 ms | 14 ns | 4.1 MB |
| 1500 | 1,124,250 | arrays | 88 ms | 4.1 s | 123 ns | 51.4 MB |
| 1500 | 1,124,250 | typedIndexed | 30 ms | 3.3 s | 97 ns | 21.7 MB |
| 1500 | 1,124,250 | typedSeq | 104 ms | 561 ms | 17 ns | 22 MB |

**Chromium 154: whole Stress layout, before and now**

| structure | items | engine | time | heap | process memory growth |
| --- | ---: | ---: | ---: | ---: | ---: |
| moderate | 3,000 | before | 1.8 s | 25.6 MB | 48 MB |
| moderate | 3,000 | now | 1.9 s | 76 MB | 98 MB |
| moderate | 10,000 | before | 3.7 s | 35.2 MB | 83 MB |
| moderate | 10,000 | now | 689 ms | 29 MB | 58 MB |
| complex | 3,000 | before | 1.6 s | 34.4 MB | 61 MB |
| complex | 3,000 | now | 1.9 s | 80.5 MB | 91 MB |
| complex | 10,000 | before | 4.1 s | 38.4 MB | 95 MB |
| complex | 10,000 | now | 731 ms | 29.5 MB | 73 MB |

**Chromium 154: sending a layout result (one object per item vs typed arrays)**

| items | objects (structured clone) | typed arrays: copied | typed arrays: moved | object size (rough) | typed size |
| --- | ---: | ---: | ---: | ---: | ---: |
| 10,000 | 25 ms | 0.3 ms | 0.5 ms | 1 MB | 0.3 MB |
| 100,000 | 246 ms | 3.6 ms | 0.0 ms | 9.9 MB | 3.1 MB |
| 500,000 | 1.5 s | 23 ms | 0.1 ms | 49.6 MB | 15.3 MB |
| 1,000,000 | 3.8 s | 64 ms | 0.2 ms | 99.2 MB | 30.5 MB |

**Firefox 158: the sweep itself, same pairs held three ways**

| items | pairs | held as | build | 30 sweeps | per update | heap |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 300 | 44,850 | arrays | 17 ms | 467 ms | 347 ns | – |
| 300 | 44,850 | typedIndexed | 3.0 ms | 74 ms | 55 ns | – |
| 300 | 44,850 | typedSeq | 11 ms | 32 ms | 24 ns | – |
| 600 | 179,700 | arrays | 23 ms | 1.3 s | 238 ns | – |
| 600 | 179,700 | typedIndexed | 5.0 ms | 386 ms | 72 ns | – |
| 600 | 179,700 | typedSeq | 21 ms | 120 ms | 22 ns | – |
| 1500 | 1,124,250 | arrays | 95 ms | 10.0 s | 296 ns | – |
| 1500 | 1,124,250 | typedIndexed | 25 ms | 4.6 s | 137 ns | – |
| 1500 | 1,124,250 | typedSeq | 207 ms | 737 ms | 22 ns | – |

**Firefox 158: whole Stress layout, before and now**

| structure | items | engine | time | heap | process memory growth |
| --- | ---: | ---: | ---: | ---: | ---: |
| moderate | 3,000 | before | 3.3 s | – | 295 MB |
| moderate | 3,000 | now | 2.1 s | – | 158 MB |
| moderate | 10,000 | before | 6.8 s | – | 192 MB |
| moderate | 10,000 | now | 861 ms | – | 106 MB |
| complex | 3,000 | before | 3.2 s | – | 127 MB |
| complex | 3,000 | now | 2.1 s | – | 164 MB |
| complex | 10,000 | before | 7.7 s | – | 156 MB |
| complex | 10,000 | now | 791 ms | – | 144 MB |

**Firefox 158: sending a layout result (one object per item vs typed arrays)**

| items | objects (structured clone) | typed arrays: copied | typed arrays: moved | object size (rough) | typed size |
| --- | ---: | ---: | ---: | ---: | ---: |
| 10,000 | 34 ms | 0.0 ms | 0.0 ms | 1 MB | 0.3 MB |
| 100,000 | 233 ms | 2.0 ms | 0.0 ms | 9.9 MB | 3.1 MB |
| 500,000 | 1.3 s | 18 ms | 0.0 ms | 49.6 MB | 15.3 MB |
| 1,000,000 | 2.7 s | 32 ms | 0.0 ms | 99.2 MB | 30.5 MB |

- **Speed:** the same pairs swept in memory order are 1.8 to 8.7× faster than one array per pair in Chromium and 11 to 15× in Firefox. Firefox's per-pair arrays are the slowest case of all (up to 347 ns per update).
- **The trap:** reading typed arrays through a shuffled index list keeps only a small part of that gain once the pairs no longer fit in cache (97 to 137 ns at 1.1 million pairs, against 17 to 22 ns in order). The fix was to shuffle the pairs once and sweep forward then backward.
- **Memory:** about 20 bytes per pair against 46 (16 for the four arrays, 4 for the order list), a drop of about 2.3×. Building the pairs is quicker (30 ms against 88 ms at 1,500 items) when their order is left alone.
- **Cost:** shuffling the pairs once in place brings the build back to about the old time (104 ms), and an all-pairs design that is now affordable also holds more pairs at once (see the memory note above).
- **Results:** sending a layout result as one object per item costs 25 ms at 10,000 items and 3.8 s at 1,000,000 in Chromium (2.7 s in Firefox); sent as typed arrays it is 64 ms copied or 0.2 ms moved. The app's layout results are still objects, so this saving is not taken yet; it is the best next use of typed arrays.

## 4. Where the engine stops: 100,000, 500,000 and 1,000,000 items

Time limit per job: 5 minutes. "skipped" means the smaller size failed or a straight-line projection from it passes the limit. "refused" is a built-in guard, not a crash. 1,000 sim runs start from one item (the simple tree is the long walk; in the other two the flow dies out quickly, so their times are short).

**Chromium 154**

| structure | items | CSV file | CSV parse | CSV import | prepare | check | groups | 1,000 sim runs | flow layout | Force layout | Stress layout |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| simple | 100,000 | 99,999 rows, 1.3 MB | 43 ms | 270 ms | 119 ms | 641 ms | 104 ms | 9.0 s | refused (too big) | 35 s | 7.9 s |
| simple | 500,000 | 499,999 rows, 7.2 MB | 215 ms | 1.4 s | 687 ms | 2.7 s | 178 ms | 40 s | skipped | 234 s | 66 s |
| simple | 1,000,000 | 999,999 rows, 14.8 MB | 438 ms | 3.3 s | 1.9 s | 6.2 s | 382 ms | 88 s | skipped | skipped | ✗ time limit 300 s |
| moderate | 100,000 | 299,757 rows, 8.4 MB | 168 ms | 1.1 s | 353 ms | 2.4 s | 1.4 s | 123 ms | refused (too big) | 62 s | 16 s |
| moderate | 500,000 | 1,500,196 rows, 44.8 MB | 1.1 s | 7.0 s | 2.3 s | 11 s | 9.0 s | 258 ms | skipped | skipped | ✗ time limit 300 s |
| moderate | 1,000,000 | 2,999,871 rows, 90.2 MB | 2.5 s | 15 s | 4.6 s | 24 s | 23 s | 344 ms | skipped | skipped | skipped |
| complex | 100,000 | 420,519 rows, 53.1 MB | 535 ms | 2.5 s | 659 ms | 2.9 s | 1.1 s | 126 ms | refused (too big) | 55 s | 18 s |
| complex | 500,000 | 2,100,244 rows, 270 MB | 3.6 s | 14 s | 2.1 s | 11 s | 13 s | 208 ms | skipped | ✗ time limit 300 s | ✗ time limit 300 s |
| complex | 1,000,000 | ✗ Invalid string length (after 4200383 rows) | – | – | 4.3 s | 24 s | 29 s | 352 ms | skipped | skipped | skipped |

**Firefox 158**

| structure | items | CSV file | CSV parse | CSV import | prepare | check | groups | 1,000 sim runs | flow layout | Force layout | Stress layout |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| simple | 100,000 | 99,999 rows, 1.3 MB | 60 ms | 409 ms | 129 ms | 695 ms | 61 ms | 13 s | refused (too big) | 52 s | 8.0 s |
| simple | 500,000 | 499,999 rows, 7.2 MB | 173 ms | 1.7 s | 1.0 s | 3.5 s | 277 ms | 64 s | skipped | ✗ time limit 300 s | 63 s |
| simple | 1,000,000 | 999,999 rows, 14.8 MB | 468 ms | 3.7 s | ✗ out of memory | ✗ out of memory | ✗ out of memory | ✗ out of memory | skipped | skipped | ✗ time limit 300 s |
| moderate | 100,000 | 299,757 rows, 8.4 MB | 207 ms | 1.3 s | 518 ms | 2.2 s | 2.0 s | 165 ms | refused (too big) | 75 s | 16 s |
| moderate | 500,000 | 1,500,196 rows, 44.8 MB | 823 ms | 7.9 s | 2.2 s | 11 s | 13 s | 306 ms | skipped | skipped | ✗ time limit 300 s |
| moderate | 1,000,000 | 2,999,871 rows, 90.2 MB | 2.2 s | 21 s | 5.7 s | 26 s | 28 s | 583 ms | skipped | skipped | skipped |
| complex | 100,000 | 420,519 rows, 53.1 MB | 787 ms | 2.9 s | 432 ms | 2.6 s | 1.9 s | 118 ms | refused (too big) | 76 s | 22 s |
| complex | 500,000 | 2,100,244 rows, 270 MB | 4.7 s | 16 s | 3.0 s | 12 s | 18 s | 195 ms | skipped | skipped | ✗ time limit 300 s |
| complex | 1,000,000 | 4,200,383 rows, 541.9 MB | 11 s | 40 s | 6.3 s | 32 s | 38 s | 279 ms | skipped | skipped | skipped |

What this says:
- **Reading data is not the limit.** Parsing and importing scale in a straight line to 1,000,000 items in both browsers (15 to 21 s for the 3-million-row moderate file). The only hard stop is one text of more than about 512 million characters in Chromium.
- **Analysis scales to 1,000,000 items:** prepare, check and groups each finish in 0.4 to 38 seconds everywhere. The one failure is Firefox at 1,000,000 simple items, where the page ran out of memory (the browser reached 6.4 GB on a 7 GB machine) while running the 1,000 simulation runs, so the whole job was lost.
- **Layouts are the limit.** Stress finishes 100,000 items in 8 to 22 s and 500,000 simple items in about a minute; Force takes 35 to 76 s at 100,000 items and 4 minutes at 500,000 simple items in Chromium (Firefox passed the 5-minute limit). No layout finishes at 1,000,000. The layered flow drawing refuses graphs that would need more than a fixed number of stops (it says to use the Network view), by design.
- The Network view is the one to use above about 50,000 items, and Stress is the faster of its two layouts at every size measured.

## 5. Everything else, in both browsers

### Chromium 154

Layered drawing (time, crossings)

| items | ours | crossings | dagre | crossings | ELK | crossings |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 100 | 14 ms | 566 | 103 ms | 527 | 582 ms | 429 |
| 200 | 35 ms | 2636 | 243 ms | 1746 | 786 ms | 1338 |
| 400 | 77 ms | 12279 | 1.0 s | 5654 | 1.3 s | 5393 |
| 1000 | 139 ms | 50483 | – | – | – | – |
| 3000 | 457 ms | 235925 | – | – | – | – |

Found groups (time, groups found, match with the planted groups; 1.0 = perfect)

| items | planted | ours | found | match | Louvain | found | match |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 300 | 6 | 0.9 ms | 4 | 0.852 | 6.0 ms | 6 | 1 |
| 1000 | 10 | 9.1 ms | 12 | 0.978 | 13 ms | 10 | 0.975 |
| 3000 | 20 | 16 ms | 20 | 0.984 | 27 ms | 20 | 0.957 |

Random draws, 1,000,000 each (ms)

| distribution | ours | d3-random | jStat |
| --- | ---: | ---: | ---: |
| normal | 21 | 53 | 48 |
| lognormal | 80 | 103 | – |
| poisson | 57 | 363 | 84 |
| binomial | 263 | 635 | – |
| exponential | 30 | 45 | – |

Formulas, 300,000 rows: ours 70 ms, expr-eval 265 ms (3.80× faster)

GIF export

| frames | size | ours | file | ours: color error (MSE / PSNR) | gifenc | file | gifenc: color error |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 4 | 960×540 | 109 ms | 68 KB | 0.016 / 66.1 dB | 61 ms | 63 KB | 0.159 / 56.1 dB |
| 31 | 960×540 | 238 ms | 521 KB | 0.023 / 64.5 dB | 296 ms | 487 KB | 0.287 / 53.6 dB |

Sending a layout from the worker to the page (moderate network)

| items | links | send as objects (write + read) | pack (worker) | send packed | unpack (page) | page waits, objects (half of the send) | page waits, packed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 10,000 | 29,813 | 160 ms | 40 ms | 6.3 ms | 19 ms | 80 ms | 25 ms |
| 30,000 | 90,029 | 547 ms | 152 ms | 24 ms | 201 ms | 274 ms | 225 ms |
| 100,000 | 299,762 | 2.0 s | 471 ms | 124 ms | 221 ms | 1.0 s | 345 ms |

Checker

| structure | items | links | time | findings |
| --- | ---: | ---: | ---: | ---: |
| simple | 1,000 | 999 | 15 ms | 4 |
| simple | 10,000 | 9,999 | 97 ms | 4 |
| simple | 50,000 | 49,999 | 313 ms | 4 |
| moderate | 1,000 | 2,983 | 39 ms | 6 |
| moderate | 10,000 | 30,054 | 198 ms | 6 |
| moderate | 50,000 | 149,980 | 851 ms | 6 |
| complex | 1,000 | 4,303 | 27 ms | 11 |
| complex | 10,000 | 42,059 | 287 ms | 10 |
| complex | 50,000 | 210,001 | 1.2 s | 11 |

Ingestion, one network three ways

| items | links | JSON | CSV | A -> B lines |
| --- | ---: | ---: | ---: | ---: |
| 1,000 | 2,956 | 11 ms | 7.4 ms | 9.8 ms |
| 10,000 | 30,928 | 107 ms | 62 ms | 68 ms |
| 50,000 | 155,405 | 624 ms | 346 ms | 356 ms |

Memory at 10,000 items

| what is held | process growth vs empty page | JS heap | note |
| --- | ---: | ---: | ---: |
| baseline | 0 MB | – |  |
| prepare | 0 MB | 5.9 MB | 1.2 MB typed |
| graphology | -1 MB | 11.1 MB |  |
| cytoscape | 145 MB | 56.8 MB |  |
| layout | 68 MB | 27.2 MB |  |

### Firefox 158

Layered drawing (time, crossings)

| items | ours | crossings | dagre | crossings | ELK | crossings |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 100 | 16 ms | 566 | 132 ms | 527 | 480 ms | 429 |
| 200 | 30 ms | 2636 | 217 ms | 1746 | 806 ms | 1338 |
| 400 | 79 ms | 12279 | 920 ms | 5654 | 1.4 s | 5393 |
| 1000 | 137 ms | 50483 | – | – | – | – |
| 3000 | 491 ms | 235925 | – | – | – | – |

Found groups (time, groups found, match with the planted groups; 1.0 = perfect)

| items | planted | ours | found | match | Louvain | found | match |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 300 | 6 | 2.0 ms | 4 | 0.852 | 5.0 ms | 6 | 1 |
| 1000 | 10 | 5.0 ms | 12 | 0.978 | 7.0 ms | 10 | 0.975 |
| 3000 | 20 | 13 ms | 20 | 0.984 | 27 ms | 20 | 0.957 |

Random draws, 1,000,000 each (ms)

| distribution | ours | d3-random | jStat |
| --- | ---: | ---: | ---: |
| normal | 60 | 51 | 42 |
| lognormal | 82 | 87 | – |
| poisson | 78 | 308 | 55 |
| binomial | 364 | 562 | – |
| exponential | 37 | 45 | – |

Formulas, 300,000 rows: ours 52 ms, expr-eval 258 ms (4.96× faster)

GIF export

| frames | size | ours | file | ours: color error (MSE / PSNR) | gifenc | file | gifenc: color error |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 4 | 960×540 | 84 ms | 67 KB | 0.015 / 66.4 dB | 80 ms | 63 KB | 0.191 / 55.3 dB |
| 31 | 960×540 | 212 ms | 515 KB | 0.022 / 64.6 dB | 316 ms | 485 KB | 0.347 / 52.7 dB |

Sending a layout from the worker to the page (moderate network)

| items | links | send as objects (write + read) | pack (worker) | send packed | unpack (page) | page waits, objects (half of the send) | page waits, packed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 10,000 | 29,813 | 162 ms | 31 ms | 4.0 ms | 45 ms | 81 ms | 49 ms |
| 30,000 | 90,029 | 644 ms | 186 ms | 18 ms | 225 ms | 322 ms | 243 ms |
| 100,000 | 299,762 | 1.9 s | 678 ms | 78 ms | 263 ms | 934 ms | 341 ms |

Checker

| structure | items | links | time | findings |
| --- | ---: | ---: | ---: | ---: |
| simple | 1,000 | 999 | 18 ms | 4 |
| simple | 10,000 | 9,999 | 101 ms | 4 |
| simple | 50,000 | 49,999 | 285 ms | 4 |
| moderate | 1,000 | 2,983 | 22 ms | 6 |
| moderate | 10,000 | 30,054 | 253 ms | 6 |
| moderate | 50,000 | 149,980 | 920 ms | 6 |
| complex | 1,000 | 4,303 | 23 ms | 11 |
| complex | 10,000 | 42,059 | 220 ms | 10 |
| complex | 50,000 | 210,001 | 1.5 s | 11 |

Ingestion, one network three ways

| items | links | JSON | CSV | A -> B lines |
| --- | ---: | ---: | ---: | ---: |
| 1,000 | 2,956 | 10 ms | 8.0 ms | 12 ms |
| 10,000 | 30,928 | 107 ms | 52 ms | 74 ms |
| 50,000 | 155,405 | 684 ms | 336 ms | 469 ms |

Memory at 10,000 items

| what is held | process growth vs empty page | JS heap | note |
| --- | ---: | ---: | ---: |
| baseline | 0 MB | – |  |
| prepare | -68 MB | – | 1.2 MB typed |
| graphology | 92 MB | – |  |
| cytoscape | 204 MB | – |  |
| layout | 139 MB | – |  |

Notes: GIF compares our encoder with gifenc using one shared palette on four synthetic frames and then 31 (section 14 has the reading and the color-error method). The Node result in the earlier research report (ours 0.4 s against 7.6 to 10.7 s) was gifenc with a palette per frame. The draws are 1,000,000 samples each; d3-random is given a fast LCG generator and jStat its own. "Sending a layout" is section 14.

## 6. Left for the next round

Done in the last rounds (sections 12 to 18): the 10,000+ Stress gap (7 to 28% down to 10% truer to 9% less true than d3-force), layout results as columns (about 2.5× faster end to end at 100,000 items, not the 70 to 100× estimated before the object rebuild was counted), the GIF encoder (now faster than gifenc from about 30 frames, and far truer in color) and the normal / lognormal draws (Chromium win; Firefox tie).

1. Stress at 10,000 items and above, normal arrangement: the last 5 to 9% of distance truth stays open for the quick arrangement (section 13, four rounds, all within noise). The slower **best quality** arrangement closes it (section 16). Open: making best quality faster still (the sweeps and the table of hop counts (about 1.4 s) are most of the 2.5 to 3.8 s at 10,000 items); a graphics-card version of the sweeps is checked for correctness (end of section 16) but not built into the page.
2. Neighborhood preservation (section 15): four corrections on top of Stress failed (section 13); a separate arrangement with its own objective works (section 17). Open: its distance truth on networks with hubs (23 to 37% worse than ForceAtlas2; section 17 shows that winning it back costs the neighborhood score), and checking the neighborhood score of the browsers' own runs (Node only so far).
3. GIF: the palette is a fixed cost that four frames cannot spread out (section 14). The histogram and the k-means step are what is left to trim.
4. Reading text over 512 million characters in Chromium needs a chunked reader; the import cap of 200,000 items / 800,000 links is still the app default.
5. A faster Force layout above 100,000 items; at that size it takes over a minute.
6. Rebuilding objects on the page is now the largest part of what the page itself still waits for when a big layout arrives (221 of 345 ms at 100,000 items in Chromium); handing out lazy views over the columns would remove it but touches about 150 places that read the layout.

## 7. Scorecard: one geometric mean for all the head-to-head results

How it is counted (you chose: each head-to-head counts once, with speed, memory and layout truth in the same mean):

- One comparison is one of our modules against one competitor on one data set in one browser. A ratio is the competitor's result divided by ours, so above 1 means we are better: 2.0× is twice as fast, uses half the memory, or draws a picture twice as true to the real link distances. Speed ratios are time ÷ time, memory ratios are bytes ÷ bytes, layout truth is the competitor's score ÷ ours (lower score is truer), crossings and group match are done the same way, and GIF file size counts as memory.
- A win is a ratio over 1.03, a tie is within 3%, a loss is under 0.97. Nothing is weighted: a 60× win and a 1.1× win each count once, and the geometric mean (the n-th root of the product) is the right average because 2× faster and 2× slower cancel exactly.
- Speed comparisons where both times are under 3 ms were dropped (Firefox's timer steps in whole milliseconds); 4 comparisons.
- "First place" means our module beats every competitor in that row (for example Stress against both d3-force and ForceAtlas2 at 3,000 complex items in Firefox).

**Overall** (a ratio above 1 means our module is better; a win is a ratio over 1.03, a tie is within 3%)

| | comparisons | wins / ties / losses | geometric mean (other ÷ ours) |
| --- | ---: | ---: | ---: |
| Speed only, both browsers | 314 | 256 / 7 / 51 | 2.20× |
| Speed only, Chromium 154 | 157 | 132 / 2 / 23 | 2.37× |
| Speed only, Firefox 158 | 157 | 124 / 5 / 28 | 2.04× |
| Speed + memory + layout truth, both browsers | 502 | 393 / 11 / 98 | 1.76× |
| Speed + memory + layout truth, Chromium 154 | 252 | 201 / 4 / 47 | 1.85× |
| Speed + memory + layout truth, Firefox 158 | 250 | 192 / 7 / 51 | 1.68× |

**First places on speed:** one benchmark row is one data set in one browser (for example Stress at 3,000 complex items in Firefox, against d3-force and ForceAtlas2 together). We come first, ahead of every competitor in the row, in 115 of 160 rows (Chromium 60 of 80, Firefox 55 of 80).

**By area** (both browsers, all metrics in the area)

| | comparisons | wins / ties / losses | geometric mean (other ÷ ours) |
| --- | ---: | ---: | ---: |
| CSV parsing | 116 | 77 / 4 / 35 | 1.17× |
| Stress layout | 80 | 80 / 0 / 0 | 5.49× |
| Stress layout truth | 80 | 68 / 0 / 12 | 1.35× |
| Force layout | 80 | 66 / 3 / 11 | 1.78× |
| Force layout truth | 80 | 63 / 0 / 17 | 1.09× |
| Layered drawing | 12 | 12 / 0 / 0 | 14.8× |
| Layered drawing truth | 12 | 0 / 0 / 12 | 0.60× |
| Found groups | 6 | 6 / 0 / 0 | 2.23× |
| Found groups truth | 6 | 0 / 4 / 2 | 0.96× |
| Random draws | 14 | 11 / 0 / 3 | 1.62× |
| Formulas | 2 | 2 / 0 / 0 | 4.34× |
| GIF export | 8 | 2 / 0 / 6 | 0.97× |
| GIF export truth | 4 | 4 / 0 / 0 | 12.5× |
| Network memory | 2 | 2 / 0 / 0 | 4.26× |

**By competitor** (all areas and metrics)

| | comparisons | wins / ties / losses | geometric mean (other ÷ ours) |
| --- | ---: | ---: | ---: |
| Papa Parse | 58 | 39 / 2 / 17 | 1.18× |
| d3-dsv | 58 | 38 / 2 / 18 | 1.16× |
| d3-force | 160 | 145 / 0 / 15 | 2.17× |
| ForceAtlas2 | 160 | 132 / 3 / 25 | 1.75× |
| dagre | 6 | 6 / 0 / 0 | 8.85× |
| dagre (crossings) | 6 | 0 / 0 / 6 | 0.66× |
| ELK | 6 | 6 / 0 / 0 | 24.8× |
| ELK (crossings) | 6 | 0 / 0 / 6 | 0.55× |
| Louvain | 6 | 6 / 0 / 0 | 2.23× |
| Louvain (match) | 6 | 0 / 4 / 2 | 0.96× |
| d3-random | 10 | 9 / 0 / 1 | 1.86× |
| jStat | 4 | 2 / 0 / 2 | 1.13× |
| expr-eval | 2 | 2 / 0 / 0 | 4.34× |
| gifenc | 12 | 6 / 0 / 6 | 2.27× |
| graphology | 1 | 1 / 0 / 0 | 1.88× |
| Cytoscape | 1 | 1 / 0 / 0 | 9.63× |

**Each area counted once:** the geometric mean of the 14 area means is 2.30×. Left out as below timer resolution: 4 comparisons.

Reading it plainly: counting every comparison once, we are **1.76× better on average** (393 wins, 11 ties, 98 losses out of 502; 1.85× in Chromium, 1.68× in Firefox), and **2.20× faster on speed alone**. We come first in 115 of the 160 speed rows. The mean is pulled up by Stress (5.5× faster than the two force layouts, with all 80 comparisons won), layered drawing (14.8× faster than dagre and ELK), formulas (4.3×) and the GIF encoder's color accuracy (12.5× lower error); it is pulled down by the places that are honestly behind: layered-drawing crossings (0.60×, we draw more crossings), GIF file size and the short 4-frame run (GIF export overall 0.97×, two wins and six losses), Firefox's normal draws, and CSV parsing, which is only 1.17× ahead on average with 35 losses out of 116 (mostly small unquoted files and whole-file parses that Papa Parse reads about as fast). Weighting each of the 14 areas equally instead of each comparison gives 2.30×.

Three things the scorecard cannot show. First, the Stress truth rows score only distances, so they do not credit what no competitor offers: zero overlapping items (section 12). Second, because of that guarantee the Stress truth rows are scored against pictures where the competitors are allowed to put items on top of each other; if they were made to separate their items as we do, their truth would fall (section 12 measures d3-force with a collision force: it stays about as true, but 3.6 to 17% of its items still touch, and it takes 1.5× longer than d3-force without it and 8 to 29× longer than ours). Third, distance truth is not the only way to judge a layout: on neighborhood preservation (are my linked items the ones nearest to me on the page?) our Stress layout is clearly behind d3-force and ForceAtlas2 (section 15).

Two things the scorecard cannot show. First, the Stress truth rows score only distances, so they do not credit what no competitor offers: zero overlapping items (section 12). Second, because of that guarantee the Stress truth rows are scored against pictures where the competitors are allowed to put items on top of each other; if they were made to separate their items as we do, their truth would fall (section 12 measures d3-force with a collision force: it stays about as true, but 3.6 to 17% of its items still touch, and it takes 1.5× longer than d3-force without it and 8 to 29× longer than ours).

Re-create the table: `node bench/geomean.js` (add `--json` for every individual comparison).

## 8. Reading zips, Excel and graph files

What the Data tab now takes (drop, choose files, or choose a folder): a **.zip** of anything below (any mix, folders inside, other zips inside up to 2 levels deep), **Excel .xlsx** (each sheet becomes a table; dates stay dates; sheets are merged by item name, so one sheet of links and another that describes the items work together), **GraphML** (including the labels yEd writes), **GEXF** (Gephi), **GML**, **Graphviz DOT** (clusters become groups, `{a b} -> {c d}` sets and `a -> b -> c` chains work), and everything that already worked (CSV, tab, semicolon and bar tables, JSON in many shapes, arrow lines, outlines, Markdown notes). Old `.xls` and `.ods` are named in a note with "Save as .xlsx or CSV". A table that only describes items (`id, label, group`, with no link columns) is now read as items instead of as a list of links.

Safety limits (all counted on what is really unpacked, never on what the file claims, so a zip bomb stops at the limit):

| Limit | Value |
|---|---|
| Files listed in one zip | 20,000 (first 5,000 text files are read) |
| One text file | 60 MB (a spreadsheet sheet: 150 MB of XML) |
| Everything unpacked from one drop, all zips together | 400 MB |
| Zip file itself | 300 MB |
| Zips inside zips | 3 levels |
| Names | cleaned of `..`, leading `/` and `\`; nothing is ever written to disk |
| Checks per file | the size and CRC-32 must match what the zip says; encrypted files and unknown compression methods are skipped with a note |

A bad file inside a zip is skipped with a plain-words note and the rest still loads. If the outer file is not a zip, or nothing readable is inside, the Data tab says so in words.

## 9. Testing and memory safety

Everything below was run on the final code (Node 22.22, Chromium 154, Firefox 158).

| Test | What it throws at the code | Result |
|---|---|---|
| `test/archive.test.js` (Node, 17 checks, 6 s) | Mixed zips, stored and deflated entries, junk in front of a zip, UTF-16 and Latin-1 text, nested zips, path tricks, Excel with dates, booleans, blank rows and a cell at the far corner of the sheet, a 300 MB zip bomb that lies and one that tells the truth, a total-size budget, bad checksums, cut-off data, password flags, odd compression methods, lying offsets and counts, 30,000-entry zips, 60,000-character names, hostile nesting in XML, GML and DOT, entity tricks, 3,000 files merged in linear time | all pass |
| `test/fuzz.test.js` (Node, three seeds of 70 s each) | about 600,000 random and mutated documents through every importer (tables, JSON shapes, arrows, outlines, notes, DOT, GML, GraphML, GEXF), about 118,000 randomly damaged zips and workbooks, 7 files full of `__proto__` and `constructor` keys, 12 awkward graph shapes through two layouts (empty, one item, self-link, stars, cliques, NaN and infinite weights), 120 random graphs through the Stress layout, then fixed dense-link, leak and bomb-release loops | 0 failures; 0 prototype pollution; every refusal in plain words; no damaged zip took over 2 s |
| `test/layout.test.js` (Node, 6 checks, 3 s) | Network layouts of 600 leaves on one hub (all wanting the same spot), several pieces, a pair and loners, a radial tree of 2,000 items, and 5,000 items in pivot mode: after layout, a grid search must find **no two items touching** | 0 failures; 0 touching in every case |
| `test/pack.test.js` (Node, 9 checks, 4 s) | A packed layout, once unpacked, is the same set of plain objects (same fields, order and values) as the original, for NaN, Infinity, -0, huge numbers, odd text, nulls, mixed columns, small results and a field named `__proto__` (never packed) | 0 failures |
| `test/fuzz.browser.js` (inside the real page) | The same zip damage run through the browser's own `DecompressionStream`, two 150 MB zip bombs, and 600 unzip-and-read laps with the process memory watched | see below |
| `test/browser.test.js` (both browsers, plus the packed page) | A zip of CSV, JSON, Excel and GraphML dropped through the real file picker, an Excel file alone, a damaged zip, a zip bomb (stopped in about 1.5 s with the rest still read), a GML file | all pass |

**Real bugs the new tests found, now fixed**
1. Outlines and notes with old-Mac (`\r`-only) or Unicode line endings crashed the outline reader. Every reader now splits on all line endings.
2. A `null` entry in a JSON `links` list (or any non-object) crashed the JSON reader.
3. Merging many files copied the whole graph once per file (quadratic): 3,000 files now merge in about 1 second. A single bad file among many is skipped with a note instead of cancelling the whole import.
4. A table with just `id, label, group` columns was read as a list of links (item to label) instead of as items.
5. The Stress layout writes into fixed-size arrays, and writing past the end of a typed array is silently ignored in JavaScript. A check now throws a clear error if the pair list could ever overflow (the 40 random graphs and the dense-link runs never hit it).

**Memory**
- Node: 48 rounds of unzip, read and two layouts: heap 483.1 MB to 483.3 MB (flat). A 120 MB zip bomb opened repeatedly releases all of its buffers (0.2 MB before and after).
- Browsers: see the table the browser fuzz printed (below). Firefox lets garbage pile up during hundreds of thousands of rapidly failing streams and returns it within about 12 seconds; the test waits for that and checks the settled number.

| Browser (30 s of damage) | Cases | Memory over 4 rounds of 150 unzip-and-read laps | Right after the damage run | After 12 s of tidying |
| --- | --- | --- | --- | --- |
| Chromium 154 | 154,914 damaged zips (0 unexpected errors, 0 slow) | 851 (start) -> 902 -> 926 -> 931 -> 936 MB | 1096 MB | 873 MB |
| Firefox 158 | 103,804 damaged zips (0 unexpected errors, 0 slow) | 1047 (start) -> 1279 -> 1250 -> 1292 -> 1226 MB | 5277 MB | 1077 MB |

Both bombs (a zip that claims 100 bytes but holds 150 MB, and one that honestly holds 150 MB, which is over the 60 MB limit for one file) are refused in under 0.6 s in both browsers, without unpacking more than the limit. The peak in the 'right after' column is Firefox collecting the leftovers of about 100,000 rapidly failing streams, which can reach several GB on this machine for those 30 seconds; a normal drop opens at most a few thousand streams.

**Dense links** (Node): 200 items with 15,704 links read in 48 ms and laid out in 67 ms; 1,000 items with 95,000 links in 225 + 786 ms; 2,000 items with 195,000 links in 561 + 2,506 ms (+212 MB heap); 1,000 items with 330,000 links in 1.1 + 2.2 s; one hub with 150,000 links is read whole.

## 10. Would another language noticeably help? WebAssembly experiment

The one loop that does the work in the Stress layout (one sweep over the pairs, 30 to 36 times) was written in C (`bench/wasm/sweep.c`, 515 bytes of WebAssembly, 512 with SIMD), and the engine was run with and without it on the same graphs. The WebAssembly version gives the same positions (bit for bit on these runs). The time includes copying the pairs into WebAssembly memory once and the item positions in and out on every sweep. Whole layout, best of 3, milliseconds (`node bench/wasm/exp.js`):

**Node 22 (V8, the engine inside Chromium)**

| items | structure | JavaScript | WebAssembly | WebAssembly + SIMD | same positions |
| ---: | --- | ---: | ---: | ---: | --- |
| 3,000 | moderate | 1,389 ms | 1,489 ms (0.93×) | 1,281 ms (1.08×) | yes |
| 10,000 | moderate | 709 ms | 519 ms (1.37×) | 477 ms (1.49×) | yes |
| 30,000 | moderate | 2,322 ms | 2,082 ms (1.12×) | 1,844 ms (1.26×) | yes |
| 10,000 | complex | 657 ms | 541 ms (1.21×) | 617 ms (1.06×) | yes |

**chromium 154.0.8037.97**

| items | structure | JavaScript | WebAssembly | WebAssembly + SIMD | same positions |
| ---: | --- | ---: | ---: | ---: | --- |
| 3,000 | moderate | 1,707 ms | 1,245 ms (1.37×) | 1,388 ms (1.23×) | yes |
| 10,000 | moderate | 602 ms | 452 ms (1.33×) | 439 ms (1.37×) | yes |
| 30,000 | moderate | 2,366 ms | 1,926 ms (1.23×) | 1,845 ms (1.28×) | yes |
| 10,000 | complex | 648 ms | 586 ms (1.11×) | 507 ms (1.28×) | yes |

**firefox firefox/158.0**

| items | structure | JavaScript | WebAssembly | WebAssembly + SIMD | same positions |
| ---: | --- | ---: | ---: | ---: | --- |
| 3,000 | moderate | 1,945 ms | 1,419 ms (1.37×) | 1,529 ms (1.27×) | yes |
| 10,000 | moderate | 711 ms | 505 ms (1.41×) | 569 ms (1.25×) | yes |
| 30,000 | moderate | 2,771 ms | 2,050 ms (1.35×) | 2,326 ms (1.19×) | yes |
| 10,000 | complex | 707 ms | 596 ms (1.19×) | 548 ms (1.29×) | yes |

What it says:
- **Gain: 1.1 to 1.4× on the whole layout**, about the same in all three engines, and not always more with SIMD. Node's first row even came out slower (1,389 ms against 1,489). That is real but not a change you would notice by eye. The 20 to 58× that Stress gained over d3-force at 10,000 items came from algorithms and typed arrays (section 3), not from the language.
- Most of what the app does is not arithmetic in a loop: reading text, building objects, drawing with the browser's canvas, WebGL or WebGPU, and the DOM. Those run in the browser's own native code already; compiling our JavaScript to WebAssembly would not make them faster, and text handling often gets slower once strings have to cross into WebAssembly.
- A second toolchain (clang, wasm-ld, or Rust) and a fallback for browsers without it would be needed, for roughly 25% on one module. The cost to the single file is trivial (the binary is under 1 KB); the cost to maintenance is not.
- What could give a large gain, and was **not measured here**: WebGPU compute for force layouts above 100,000 items (the only layouts that hit the 5-minute limit), and moving the whole Stress pipeline (breadth-first searches, pair building, overlap removal) into WebAssembly so the data never leaves its memory. Expect somewhere around 1.5 to 2× for the second, and a much larger step for the first, but only on machines where WebGPU works (Firefox 158 headless here had none).
- Web Workers are already used: the engine runs off the page's thread, so the interface stays responsive during layouts.

## 11. Your questions about definitions and limits

**How is "truest layout" defined and measured?** Truest means: distances on the page match how far apart the items really are in the network. For a layout, take the shortest path (number of links, in either direction) between pairs of items as the real distance `d`, and the distance between the items' centers on the page as `e`. Because a picture can be zoomed freely, find the single best zoom `s = Σ(e/d) / Σ(e²/d²)` and score the layout as the mean of `(d − s·e)² / d²`. Zero is a picture where every pair is exactly proportional; lower is truer. Dividing by `d²` makes neighbors matter most: getting two linked items placed far apart costs much more than misplacing two items that are 12 hops apart. To keep the check cheap, 60 evenly spaced source items are used, and each is compared with every other item (every 7th item above 3,000 items). It is the same number for every competitor, measured on their finished positions (`bench/suites.js`, `bench/stress-tune.js`). Two cautions: it is the quantity Stress minimizes, so Stress is naturally good at it; and it ignores item size, so d3-force and ForceAtlas2, which place points and never make room for boxes, are not penalized for overlaps, while ours guarantees that no two items touch. That guarantee is a vital advantage, not a footnote: a picture whose items sit on top of each other cannot be read, and the score gives those pictures credit for it. Keeping items apart costs a little truth, and the benchmark scores ours with that cost included (section 12 has the numbers). A third caution, found later: it is a distance measure, and on a local measure (do linked items sit nearest to each other?) our Stress layout scores clearly below d3-force and ForceAtlas2 (section 15). Layered-drawing quality is measured separately, as the number of crossing lines, and found groups as how well they match the planted groups.

**Are item counts only nodes? Do they limit how many links an item can have?** The counts are items (nodes) only. Links are limited separately, and one item can have as many links as the file has: a single hub with 150,000 links read whole, and 1,000 items with 330,000 links laid out in about 3 seconds. The app's default import caps are 200,000 items and 800,000 links, whichever comes first, with a plain-words note when reached (the benchmarks lift them to measure 1,000,000 items). The scale tables use about 1 link per item (simple), 3 (moderate) and 4.2 (complex, so the 1,000,000-item complex file holds 4.2 million links). More links per item makes everything cost more (reading is linear in links; the Stress layout's work grows with items times pivots plus links, and its pair memory is capped near 12 million pairs), but the cost is smooth and nothing stops at a link count.

**Did the network-mapping research improve our engine, in speed or quality?** Yes in speed, mixed in quality, and none of it came from copying library code (the research only compares; no code was taken). Measured on the same six-cluster test network (`docs/RESEARCH-open-source-comparison.md`, section 7, and sections 1 to 4 above):
- Speed: overlap removal was 9.9 of 12 seconds at 10,000 items and is about 4× faster; Stress at 10,000 items went from about 15.6 s to 1.2 to 2.1 s (14 to 23× faster than d3-force at that size); the minified build is 31% smaller; layout result memory fell 9% (17.8 to 16.3 MB at 10,000 items) and the pair lists use about a fifth of the memory.
- Quality: at 3,000 items Stress truth went from 0.286 to 0.224 and Force from 0.222 to 0.154 (d3-force: 0.179), so Force is now truer than d3-force there. Stress at 10,000 items is now 10% truer to 9% less true than d3-force (it was 7 to 28% less true), and, unlike d3-force and ForceAtlas2, it leaves no two items touching.
- Not improved: the layered flow drawing still has 60 to 100% more crossings than dagre and ELK (it is 7 to 117× faster), our own Louvain groups were not written, and GIF export is slower than gifenc on a short cold run (it is now faster from about 30 frames and far truer in color; section 14). The research listed these; they remain on the work list.

## 12. No two items touch: the comparison that the truth score cannot show

d3-force and ForceAtlas2 place points. They have no idea how big an item is, so at the item sizes this app draws they put most items on top of other items. Our network layouts (Stress and Force) finish with a step that removes every overlap, and that step is guaranteed, not best effort: push-apart passes, then (if any pair still touches) stretch the whole picture by 10% and repeat, up to 12 times (the truth score does not change when a picture is scaled), then move each remaining item to the nearest free spot on an outward spiral, which cannot land on another item. A test checks it (`test/layout.test.js`), and 40 layouts per browser were checked in Chromium and Firefox. This costs some truth and some time, and both costs are inside the numbers in sections 2 and 7. The competitors are scored without any such cost.

**How it was measured** (`node bench/overlap.js moderate 1000 3000 5000 10000`, Node 22, single runs; times indicative). The same network went to every method. Each competitor's picture was scaled so the median link is 130 units long, with every item drawn as a disc of the radius our layout gives it. "Items touching" is the share of items whose disc overlaps another item's disc. "Zoom" is how many times bigger the whole page would have to be for the worst pair to just separate (1 means nothing touches). "d3-force + forceCollide" is the standard way to make d3-force respect size: link distance 130, charge −300, collision radius equal to the item radius. ForceAtlas2 has its own "adjust sizes" switch; an attempt to emulate it here gave a visibly broken picture (truth 0.25, every item overlapping), so it is not shown and not claimed.

| network | items | method | time | truth (lower = truer) | overlapping pairs | items touching | zoom needed |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| moderate | 1,000 | **ours (Stress)** | 269 ms | 0.137 | **0** | **0%** | **1** |
| moderate | 1,000 | d3-force | 1.4 s | 0.198 | 1,141 | 81% | 7.2 |
| moderate | 1,000 | d3-force + forceCollide | 2.1 s | 0.195 | 34 | 6.5% | 1 |
| moderate | 1,000 | ForceAtlas2 | 1.5 s | 0.171 | 917 | 78% | 3.6 |
| moderate | 3,000 | **ours (Stress)** | 1.7 s | 0.152 | **0** | **0%** | **1** |
| moderate | 3,000 | d3-force | 6.3 s | 0.194 | 10,786 | 95% | 13 |
| moderate | 3,000 | d3-force + forceCollide | 8.3 s | 0.193 | 151 | 9.8% | 1 |
| moderate | 3,000 | ForceAtlas2 | 5.1 s | 0.176 | 9,483 | 95% | 6.4 |
| moderate | 5,000 | **ours (Stress)** | 782 ms | 0.198 | **0** | **0%** | **1** |
| moderate | 5,000 | d3-force | 11 s | 0.182 | 29,863 | 98.5% | 34 |
| moderate | 5,000 | d3-force + forceCollide | 16 s | 0.182 | 317 | 12% | 1 |
| moderate | 5,000 | ForceAtlas2 | 9.8 s | 0.183 | 27,069 | 98% | 7.4 |
| moderate | 10,000 | **ours (Stress)** | 1.5 s | 0.203 | **0** | **0%** | **1** |
| moderate | 10,000 | d3-force | 27 s | 0.190 | 122,584 | 99.6% | 48 |
| moderate | 10,000 | d3-force + forceCollide | 42 s | 0.189 | 916 | 17% | 1 |
| moderate | 10,000 | ForceAtlas2 | 25 s | 0.183 | 110,558 | 99.5% | 17 |
| planted groups | 5,000 | **ours (Stress)** | 813 ms | 0.195 | **0** | **0%** | **1** |
| planted groups | 5,000 | d3-force | 12 s | 0.195 | 18,402 | 92% | 13 |
| planted groups | 5,000 | d3-force + forceCollide | 16 s | 0.193 | 297 | 11% | 1 |
| planted groups | 5,000 | ForceAtlas2 | 10 s | 0.191 | 15,562 | 92% | 6.6 |
| simple tree | 5,000 | **ours (Stress)** | 696 ms | 0.184 | **0** | **0%** | **1** |
| simple tree | 5,000 | d3-force | 12 s | 0.206 | 3,021 | 70% | 7.8 |
| simple tree | 5,000 | d3-force + forceCollide | 18 s | 0.206 | 99 | 3.6% | 1 |
| simple tree | 5,000 | ForceAtlas2 | 10 s | 0.206 | 242 | 8.8% | 2.6 |

Reading it:
- **Ours is the only one with nothing touching**, in every row, at every size. d3-force and ForceAtlas2 leave 70 to 100% of items overlapping (the one low value, ForceAtlas2 on a plain tree, is 8.8%, because a tree spreads itself out).
- **Adding a collision force to d3-force helps but does not finish the job**: 3.6 to 17% of the items still touch after the extra pass, it takes 1.5× longer than d3-force alone, and it is 8 to 29× slower than ours. Its truth stays about the same, so it too pays for separating items, but it pays more and does not get there.
- **The truth cost of our guarantee is small and visible.** Compared with d3-force and ForceAtlas2 as they come (overlapping), ours is truer through 3,000 items, 7 to 9% less true than d3-force at 5,000 and 10,000 items on the moderate network, level with it on the planted-groups network and truer on the plain tree at 5,000 items. Comparing like with like (both with items apart) is not possible with the competitors as published, which is the point.
- **How it got here.** The first version of this round still left 2,400 overlapping pairs at 5,000 items and 10,341 at 10,000 (64% of items touching, zoom 187×), and the engine as committed before it left 8,412 at 5,000; no test had looked at this. The fix first moved each leftover item to the nearest free spot; that made the truth at 10,000 items blow up to 0.68 to 0.72, because items in a dense core get moved far. Stretching the whole picture before the spiral step brought it back to 0.20.

## 13. Stress for 10,000+ items: what was tried and what stayed

`docs/RESEARCH-r-packages.md` lists the methods read (graphlayouts sparse stress and pivot MDS, igraph, packcircles, ggrepel) and has the full table of tried ideas. The short result: the change that mattered was giving the short-range pairs more weight in the sample (100 nearest neighbors per item instead of 16, pivot terms at 0.3 of the normal weight), because the truth score divides each pair's error by the squared hop count, so nearby pairs carry most of it and 16 per item under-sampled them. Three ideas that looked promising did not help: a coarse-first multilevel start (same truth at twice the time), the region-size pivot weights of the sparse stress paper (unstable under gradient descent, 0.204 to 0.27), and fresh random source items on every sweep (worse).

**Chromium 154, before this round and now** (time / truth; the "before" engine left items overlapping, the "now" engine does not)

| network | items | before | now |
| --- | ---: | ---: | ---: |
| simple | 10,000 | 641 ms / 0.231 | 1.2 s / 0.192 |
| moderate | 10,000 | 853 ms / 0.213 | 1.6 s / 0.207 |
| complex | 10,000 | 928 ms / 0.233 | 1.5 s / 0.205 |
| planted groups | 10,000 | 1.1 s / 0.240 | 1.5 s / 0.203 |
| moderate | 3,000 | 1.9 s / 0.151 | 2.0 s / 0.151 |

At 10,000 items the engine now spends 1.4 to 1.9 times as long and is 3 to 17% truer, and now guarantees that nothing touches (the "before" engine left overlaps: 8,412 pairs at 5,000 items). Node measurements for the middle sizes: 3,500 items 0.234 to 0.189; 5,000 items 0.235 to 0.199. Raising the all-pairs limit from 3,000 to 4,000 items gives 0.156 at about 3 s, against 0.204 for the sparse method at that size. All pairs at 10,000 items would be 0.160, but takes 18.6 s.

**Tried a second time, and not kept** (Node, moderate network, 10,000 items; the engine as it stands scores 0.203 in 1.5 s):

| Idea | Truth | Time |
|---|---:|---:|
| Pivot-MDS start (Brandes and Pich 2006) instead of the spiral | 0.209 | 1.9 s |
| Pivot-MDS start with 20 sweeps instead of 36 | 0.210 | 1.5 s |
| Majorization polish after the sweeps, 8 steps | 0.204 | 1.8 s |
| Majorization polish, 20 steps | 0.206 | 2.4 s |
| 20 sweeps then 12 majorization steps | 0.210 | 1.6 s |
| Lighter pivot weight (0.1) plus 6 majorization steps | 0.211 | 1.6 s |
| Pivots at the centers of k-means groups of a pivot-MDS picture | 0.214 (complex network: 0.197 against 0.198) | 1.8 s (complex: 2.0 s against 1.7 s) |
| 160 nearest neighbors per item (was 100) | 0.200 | 1.9 s |
| 50 sweeps (was 36) | 0.204 | 1.6 s |

Single runs, so differences under about 0.005 are noise. A pivot-MDS start gives the right global shape, but the truth score is limited by local detail, which the extra neighbor pairs already supply. Majorization is stable with any weights, but as a polish it does not beat the annealed sweeps. 160 neighbors buys 0.003 for 30% more time. None of this code was kept.

**A third round, after reading the recent papers** (`docs/RESEARCH-layout-papers.md`). Same network and method as above, truth then time; the baseline row is the engine as it stands. Differences under about 0.005 are noise (the same setting scored 0.199 on the moderate network and 0.208 on the complex one).

| Idea | moderate | complex | planted | simple |
|---|---:|---:|---:|---:|
| Engine as it stands | 0.203 | 0.198 | 0.205 | 0.199 |
| Lower final step size (0.03; the engine uses 0.1) | 0.199 | 0.208 | 0.206 | 0.195 |
| Lower final step size 0.02 | 0.213 | 0.202 | 0.205 | 0.192 |
| Lower final step size 0.03 and pivot weight 0.15 | 0.215 | 0.203 | 0.202 | 0.193 |
| Final step size 0.3 / 0.01 | 0.204 / 0.210 | – | – | – |
| Pivot terms heavy early, light late (3× to 0.3×) | 0.208 | – | – | – |
| Pivot terms light early, heavy late (0.3× to 3×) | 0.206 | – | – | – |
| 300 pivots instead of 30 to 120, weight 0.3 / 0.1 / 1.0 | 0.209 / 0.206 / 0.229 | – | – | – |
| 120 random pivots instead of the farthest-apart, weight 0.3 / 1.0 | 0.202 / 0.214 | – | – | – |
| 300 random pivots, weight 1.0 / 0.5 | 0.216 / 0.206 | – | – | – |

Link pairs weighted 3× and 8× (to pull linked items closer) moved nothing that matters: truth 0.123 and 0.125 against 0.121 on a 1,000-item tree, and 0.152 and 0.155 against 0.152 on 3,000 moderate items. None of this code was kept.

What the papers say, in short, and how it fits. Börsig, Brandes and Pásztor's re-test of the stochastic-gradient claim finds no significant difference in final stress between gradient descent and majorization once majorization is started well, and the start matters for majorization only; that matches our majorization and pivot-MDS-start results. The 2025 resistance-distance paper reports that random pair sampling beats pivot sampling on small graphs (100 to 1,000 items), but at 10,000 items our random pivots were not better (0.202 against 0.203), and giving far pairs more weight made things worse, not better. DRGraph, the t-distribution force layout and its sparse-negative-sampling successor optimize neighborhood preservation, not distances, and report worse stress than the stress methods; they are answers to a different question (section 15). The one clear lever left is the pair model itself: all pairs at 10,000 items scores 0.160 but takes 18.6 s, so the open question is a cheaper way to get most of that. The paper-backed route is a parallel majorization over all pairs on the graphics chip (about 100 MB for a 10,000 by 10,000 byte matrix of hop counts), which this environment cannot test.

**A fourth round: a neighborhood term, and majorization on every pair** (Node, single runs; the moderate network of 3,000 items unless noted). The aim was to lift neighborhood preservation (section 15) without giving up distance truth. Each row is truth then neighborhood score, against 0.152 and 0.007 for the engine as it stands.

| Idea | Truth | Neighborhood |
|---|---:|---:|
| Six gentle extra sweeps over the link and near pairs only | 0.155 | 0.001 |
| The same, link pairs weighted 3× | 0.157 | 0.000 |
| Twelve such sweeps, larger steps, link pairs 3×, near pairs 0.3× | 0.161 | 0.000 |
| A short-range push between items that are not linked (reach 1× the link length), 8 rounds | 0.566 | 0.006 |
| The same with reach 0.8×, 8 rounds | 0.206 | 0.005 |
| Push at 1.2× plus pulling long links in twice as hard, 15 rounds | 0.763 | 0.000 |
| A short cool Force run after Stress, 20 steps | 0.155 | 0.007 |
| The same, 40 steps, warmer | 0.161 | 0.007 |
| The same, 40 steps, warmest | 0.163 | 0.010 |

Nothing lifted the neighborhood score by more than noise, and the stronger versions cost distance truth. The reading: the score is low because of what Stress asks for (distances), and a correction on top of it fights the distances instead of improving the picture. None of this code was kept. Whoever wants closeness should pick Force, which was built for it.

On the same network at 5,000 items, majorization on every pair (all items moving together, a calculation a graphics card could run in parallel) reached 0.152 after 3 sweeps of the normal method plus 30 majorization steps, the same as 12 normal sweeps on every pair (0.152) or 30 (0.153), and 80 steps gave 0.152 again. Started right after a single sweep it stuck at 0.210. So majorization buys no truth over the sweeps once every pair is used; at most it could make the same result faster. That is the evidence behind the graphics-card question in section 16.

**What is left.** Against d3-force the gap at 10,000 items is 10% truer to 9% less true; against ForceAtlas2 it is 4% truer to 17% less true (section 2). The three ideas that were still untried last round (a pivot-MDS start, k-means pivots, majorization) have now been tried, above. A note on the limits of this evidence: the truth score is the quantity Stress minimizes, so it favors Stress over methods that do not optimize it; a different measure, such as how many of an item's nearest neighbors stay nearest on the page, could rank the methods differently, and was not measured.

## 14. Layout results as columns, the GIF encoder and the random draws

**Layout results as columns.** The worker used to send a big layout as one object per item (about 37 fields) and one per link (about 13 fields), which the browser copies field by field twice. Now each field travels as one typed array (text as one long string plus lengths) and the page rebuilds the same plain objects from them, so nothing that reads a layout had to change (`src/pack.js`, `test/pack.test.js`). Lists of objects with an odd shape fall back to being sent as they are, and small results (under 2,000 items) are not packed.

**Chromium 154**

| items | links | send as objects (write + read) | pack (worker) | send packed | unpack (page) | page waits, objects (half of the send) | page waits, packed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 10,000 | 29,813 | 160 ms | 40 ms | 6.3 ms | 19 ms | 80 ms | 25 ms |
| 30,000 | 90,029 | 547 ms | 152 ms | 24 ms | 201 ms | 274 ms | 225 ms |
| 100,000 | 299,762 | 2.0 s | 471 ms | 124 ms | 221 ms | 1.0 s | 345 ms |

**Firefox 158**

| items | links | send as objects (write + read) | pack (worker) | send packed | unpack (page) | page waits, objects (half of the send) | page waits, packed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 10,000 | 29,813 | 162 ms | 31 ms | 4.0 ms | 45 ms | 81 ms | 49 ms |
| 30,000 | 90,029 | 644 ms | 186 ms | 18 ms | 225 ms | 322 ms | 243 ms |
| 100,000 | 299,762 | 1.9 s | 678 ms | 78 ms | 263 ms | 934 ms | 341 ms |

How to read it: "send as objects" is the browser's own copy of the whole layout (the page waits for about half of that, an estimate). Packing happens in the worker, so the page's own wait is "send packed" plus "unpack". The end-to-end saving (pack + send + unpack against the plain copy) is 2.5× at 100,000 items in Chromium and 1.8× in Firefox (1.5× at 30,000 items in both). The page's own wait falls by 3.2×, 1.2× and 2.9× at 10,000, 30,000 and 100,000 items in Chromium (1.7×, 1.3× and 2.7× in Firefox), so the gain is modest in the middle, where rebuilding the objects dominates. The earlier estimate of 70 to 100× counted only the arrays; rebuilding the objects on the page (the "unpack" column) is a real cost that stays. Handing out lazy views over the columns would remove it but touches about 150 places that read the layout, so it was not done.

**GIF encoder.** The changes: a faster path for runs of one color in the compressor (the output is byte for byte what the plain compressor writes, and a test compares the two), a changed-pixel list so that unchanged parts of a frame cost nothing, a small cache for nearest-palette-color lookups, and a palette made by median cut and refined by k-means. Quality is measured by decoding each GIF (with omggif) and comparing every pixel with the original frame (mean squared error per color channel; PSNR in decibels, higher is better). gifenc is given one palette for all frames (its fastest mode).

**Chromium 154**

| frames | size | ours | file | ours: color error (MSE / PSNR) | gifenc | file | gifenc: color error |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 4 | 960×540 | 109 ms | 68 KB | 0.016 / 66.1 dB | 61 ms | 63 KB | 0.159 / 56.1 dB |
| 31 | 960×540 | 238 ms | 521 KB | 0.023 / 64.5 dB | 296 ms | 487 KB | 0.287 / 53.6 dB |

Sending a layout from the worker to the page (moderate network)

| items | links | send as objects (write + read) | pack (worker) | send packed | unpack (page) | page waits, objects (half of the send) | page waits, packed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 10,000 | 29,813 | 160 ms | 40 ms | 6.3 ms | 19 ms | 80 ms | 25 ms |
| 30,000 | 90,029 | 547 ms | 152 ms | 24 ms | 201 ms | 274 ms | 225 ms |
| 100,000 | 299,762 | 2.0 s | 471 ms | 124 ms | 221 ms | 1.0 s | 345 ms |

**Firefox 158**

| frames | size | ours | file | ours: color error (MSE / PSNR) | gifenc | file | gifenc: color error |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 4 | 960×540 | 84 ms | 67 KB | 0.015 / 66.4 dB | 80 ms | 63 KB | 0.191 / 55.3 dB |
| 31 | 960×540 | 212 ms | 515 KB | 0.022 / 64.6 dB | 316 ms | 485 KB | 0.347 / 52.7 dB |

Sending a layout from the worker to the page (moderate network)

| items | links | send as objects (write + read) | pack (worker) | send packed | unpack (page) | page waits, objects (half of the send) | page waits, packed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 10,000 | 29,813 | 162 ms | 31 ms | 4.0 ms | 45 ms | 81 ms | 49 ms |
| 30,000 | 90,029 | 644 ms | 186 ms | 18 ms | 225 ms | 322 ms | 243 ms |
| 100,000 | 299,762 | 1.9 s | 678 ms | 78 ms | 263 ms | 934 ms | 341 ms |

Reading it: ours is 10 to 16× lower in color error (+10 to +12 dB) in both browsers and at both lengths, which is visible as less banding, and 1.24× (Chromium) to 1.5× (Firefox) faster at 31 frames. On a 4-frame run it is 1.8× slower in Chromium (the palette work is a fixed cost that four frames cannot spread out) and level in Firefox (84 against 80 ms). Files are 6 to 8% larger (the reason was not isolated). That is a real trade, not a win on every axis.

**Where the 4-frame time goes in Firefox, and what was done about it.** A profile of the encoder (`bench/gif-profile.sh`; the suite is `gifprof`) shows, for the second of three runs in a fresh page (the number this document reports is the median of three runs), about 85 ms in Firefox 158: the palette 48 ms (the color histogram over 2 million pixels about 22 ms, the k-means step about 20 ms while the code is still cold and 5 ms when warm, the median cut 3 ms), mapping and comparing the four frames 22 to 29 ms, compressing 5 to 10 ms. The same run in gifenc is 63 ms: 12 ms to build one palette from one picture and about 13 ms per frame. So our per-frame work is already cheaper (about 7 ms against 13 ms warm) and the whole gap is the palette, which looks at four pictures and then refines the cut. The first run in a fresh page takes 100 to 135 ms and the third 55 to 70 ms (gifenc 56 to 60 ms), so most of the rest is the engine's code warming up.

**A correction.** The previous round reported that two palette changes made the encoder about 30% slower in Firefox and reverted them. That measurement ran the variants one after another; repeated in an interleaved test (five rounds of four fresh-page jobs per variant, three runs each) the committed encoder and the variants were the same within noise (second-run totals 83, 90, 96 and 91 ms), so those changes were neither a Firefox loss nor a Firefox gain. They were still left out.

**What shipped.** For pictures totaling over a million pixels the palette histogram now looks at every other pixel, and the k-means step runs 2 rounds instead of 3. In the same interleaved Firefox test the palette fell from 48 to 35 ms and the second-run total from 83 to 75 ms; the decoded color error in Node moved from 0.130 to 0.135 at 4 frames and from 0.137 to 0.132 at 31 frames, and the file size by about 1%. In the tables above (single runs) the 4-frame run is now level with gifenc in Firefox and 1.8× slower in Chromium (Chromium's timings on this machine swing by 30% from run to run, so that last number is rough). From about four frames on, the lower per-frame cost makes up for the palette.

**Random draws.** The normal draw is a Marsaglia and Tsang ziggurat with 128 layers, the exponential draw is a 256-layer ziggurat, and Poisson draws with a small mean invert a cached cumulative table (lognormal is the normal draw exponentiated). The same seed always gives the same numbers, and tests check the means, spreads and tail counts (`test/sim.test.js`). One million draws, in milliseconds:

**Chromium 154**

| distribution | ours | d3-random | jStat |
| --- | ---: | ---: | ---: |
| normal | 21 | 53 | 48 |
| lognormal | 80 | 103 | – |
| poisson | 57 | 363 | 84 |
| binomial | 263 | 635 | – |
| exponential | 30 | 45 | – |

**Firefox 158**

| distribution | ours | d3-random | jStat |
| --- | ---: | ---: | ---: |
| normal | 60 | 51 | 42 |
| lognormal | 82 | 87 | – |
| poisson | 78 | 308 | 55 |
| binomial | 364 | 562 | – |
| exponential | 37 | 45 | – |

Reading it: in Chromium ours is faster in every row (normal 2.3 to 2.5×, Poisson 1.5 to 6.4×, binomial 2.4×). In Firefox it is a tie or a loss on normal draws (1.2× slower than d3-random and 1.4× slower than jStat) and slower than jStat on Poisson (1.4×), but still faster than d3-random there (Poisson 3.9×, binomial 1.5×, lognormal and exponential 1.1 to 1.2×). Two honest notes: d3-random was given a fast simple generator (a multiplicative one), and jStat uses the browser's own random numbers, so both are favorable to them; and ours uses a stronger generator (mulberry32) than d3's multiplicative one, so the comparison is not slanted toward us. An attempt to speed up the normal draw further for Firefox did not change the result beyond noise, so it was left alone.

## 15. Neighborhood preservation: where the Stress layout is weaker

Distance truth (the score used everywhere above) asks whether page distances follow hop counts. A second, common measure asks something local: for each item, are the items it is linked to the ones nearest to it on the page? This is neighborhood preservation as used by tsNET and DRGraph: for 600 evenly spaced items with k links, the overlap (Jaccard) between the k linked items and the k nearest items on the page; 1 is perfect, higher is better. It was added to `bench/overlap.js` (Node, single runs; `ARR=force` runs our Force arrangement).

| network | items | ours: Stress | ours: Force | d3-force | d3-force + forceCollide | ForceAtlas2 |
|---|---:|---:|---:|---:|---:|---:|
| simple tree | 1,000 | 0.012 (truth 0.121) | 0.082 (0.172) | 0.109 (0.208) | 0.089 (0.208) | 0.159 (0.197) |
| complex | 1,000 | 0.020 (0.124) | 0.026 (0.140) | 0.034 (0.187) | 0.028 (0.197) | 0.045 (0.147) |
| moderate | 3,000 | 0.007 (0.152) | 0.011 (0.168) | 0.027 (0.194) | 0.024 (0.193) | 0.031 (0.178) |
| moderate | 5,000 | 0.001 (0.198) | – | 0.014 (0.182) | 0.013 (0.182) | 0.023 (0.179) |

Each cell is the neighborhood score with the distance truth in parentheses. Reading it:
- **Stress is clearly the weakest here**: 7 to 13× lower than the competitors on the tree, 1.4 to 2.3× on the complex network, 3 to 4× on moderate 3,000 and 13 to 23× on moderate 5,000. Its edge in distance truth is real, and so is this gap; the two measures disagree about which layout is better, which is a known property of the two measures, not a bug in either.
- **It is not the overlap removal.** With the push-apart, stretch and settle steps switched off the score is the same (0.012 on the tree, 0.006 against 0.007 on moderate 3,000), and it is the same for the all-pairs version used below 4,000 items. It comes from the stress model: it puts linked items at the target length and siblings only a little farther, so around a parent with seven or more children the siblings are nearer to each other than to the parent. Weighting link pairs 3× and 8× did not change it (0.010 and 0.013 on the tree).
- **Our Force arrangement is nearer the competitors**, and still behind ForceAtlas2, with the overlap guarantee in place.
- All scores are small on the networks with random cross links, because no two-dimensional picture can keep every item's links among its nearest items.
- **What this does not show.** It is one local measure on four networks and single runs. It says that "truest layout" depends on what is being asked: Stress for how far apart things really are, Force or ForceAtlas2 for who sits next to whom. The in-app wording for the arrangements should say so (it already points Stress at distances). A hybrid that adds a local term to the stress model, as the (SGD)² paper does for neighborhood preservation, is the natural next experiment and was not tried.

## 16. "Distances, best quality (slower)": every pair, for networks of 4,001 to 20,000 items

The normal Stress layout samples pairs (pivots, links and near neighbors) once a network has more than 4,000 items. That is fast, and it is the plateau described in section 13: about 0.20 at 10,000 items whatever was tuned. The remaining route was to use every pair of items, which is what the layout does up to 4,000 items. It is now available above that size as its own choice in the Arrangement list, **Distances, best quality (slower)**. Nothing else changes: the normal arrangement stays the default, and both guarantee that no two items touch.

How it fits in memory and time:
- Hop counts between all pairs are kept in one byte each, one byte per pair (50 MB for 10,000 items, 200 MB for 20,000). The old way, 16 bytes per pair, would need 800 MB at 10,000 items.
- Pairs are visited one offset at a time in a random order (item 1 against the item 7 places on, then item 2 against the item 7 places on, and so on). That is as good as a fully random order for the result, and memory is read in straight lines, which is what makes it fast. A first version that took each item against its next neighbors in turn reached only 0.19 to 0.21 at 5,000 items; the offset order reached 0.152.
- Building the table of hop counts is done 32 searches at a time (each item carries a 32-bit mask of the searches that reached it), which cut that step at 10,000 items from 4.8 s to 1.8 s with byte-for-byte identical tables. A later pass made it 64 searches at a time and skipped writing the half of each item's pairs that only repeats the other half, which took it to about 1.4 s (Node, three runs each, tables again identical). Where the 1.8 s went: about 0.8 s passing masks along links, 0.7 s turning newly set bits into hop counts, 0.2 s writing the table across.
- **Three sweeps up to 12,000 items, two above, with a first step sized to match.** The first version used 12, 6 and 4 sweeps with the same step schedule. Four sweeps score the same as twelve at 5,000 items (moderate 0.153 against 0.152, complex 0.144 against 0.143, simple 0.133 against 0.133). With the first step made smaller when there are fewer sweeps (0.3 of the largest hop count squared for three, 0.1 for two; last step 0.3 and 0.5), three sweeps match four on every network tried (moderate 10,000: 0.162 against 0.161; complex 10,000: 0.148 against 0.150; simple 10,000: 0.137 against 0.137) and two sweeps are within 0.002 to 0.007 (complex 10,000: 0.157), which is why two are used only above 12,000 items. With the old schedule two sweeps failed (0.212 at 10,000 items). Time at 10,000 items fell from about 4.2 s to 2.8 s in Node; at 20,000 items from 13 s to 8.6 s.
- The inner loop keeps the x and y of the items in separate lists and handles the pairs that wrap round to the start of the list as their own stretch; in isolation that made a sweep about 15 to 20% faster.
- A piece with a path longer than 254 hops (a long chain) is left to the normal method, because one byte cannot count that far; so is a device that cannot give the memory.

**Node, same machine, one run each** (time / truth, lower truth is truer; same item sizes for all; ours leave no items touching, d3-force and ForceAtlas2 leave 10 to 100% of items overlapping at these sizes, section 12):

| network | items | normal Stress | best quality | d3-force | ForceAtlas2 |
|---|---:|---:|---:|---:|---:|
| simple tree | 5,000 | 0.6 s / 0.184 | **0.7 s / 0.134** | 12.2 s / 0.206 | 9.6 s / 0.205 |
| simple tree | 10,000 | 1.0 s / 0.199 | **2.5 s / 0.137** | 27.4 s / 0.210 | 22.2 s / 0.199 |
| moderate | 5,000 | 0.9 s / 0.198 | **1.0 s / 0.155** | 10.5 s / 0.182 | 10.2 s / 0.182 |
| moderate | 10,000 | 1.8 s / 0.203 | **2.7 s / 0.162** | 26.3 s / 0.190 | 22.9 s / 0.184 |
| complex | 5,000 | 0.9 s / 0.201 | **0.9 s / 0.144** | 10.9 s / 0.187 | 10.9 s / 0.171 |
| complex | 10,000 | 1.6 s / 0.198 | **2.6 s / 0.148** | 27.1 s / 0.195 | 24.9 s / 0.179 |

At 20,000 items on the moderate network: 8.6 s, truth 0.163 (the first version took 28 s).

**In the browsers, 10,000 items** (time / truth, one run each; d3-force and ForceAtlas2 from section 2):

| network | browser | normal Stress | best quality | d3-force | ForceAtlas2 |
|---|---|---:|---:|---:|---:|
| simple | Chromium 154 | 1.0 s / 0.192 | 2.5 s / 0.137 | 25.6 s / 0.210 | 22.6 s / 0.201 |
| simple | Firefox 158 | 1.2 s / 0.190 | 3.0 s / 0.136 | 31.6 s / 0.210 | 20.4 s / 0.198 |
| moderate | Chromium 154 | 1.2 s / 0.207 | 3.2 s / 0.161 | 21.7 s / 0.190 | 24.0 s / 0.180 |
| moderate | Firefox 158 | 1.5 s / 0.204 | 3.8 s / 0.163 | 29.6 s / 0.190 | 21.0 s / 0.175 |
| complex | Chromium 154 | 1.5 s / 0.205 | 3.0 s / 0.148 | 24.5 s / 0.195 | 26.7 s / 0.179 |
| complex | Firefox 158 | 1.7 s / 0.207 | 3.4 s / 0.152 | 34.5 s / 0.195 | 22.6 s / 0.179 |

At 5,000 items the browsers took 0.8 to 1.3 s (truth 0.134 to 0.157). Raw numbers are in `bench/results/*-best.jsonl`.

Reading it:
- **At 5,000 to 20,000 items this closes the gap.** It is truer than d3-force and ForceAtlas2 on every network tried (12 to 31% truer at 10,000 items in Node, 9 to 32% in the browsers) and 8.7 to 12× faster than the faster of them at 10,000 items in Node (6.0 to 9.8× in the browsers), and nothing touches. The normal arrangement remains the quick choice: 1.9 to 2.5× faster again in the browsers, and about 0.20 true.
- **Neighborhood preservation is not helped** (0.001 to 0.005 here against 0.008 to 0.02 for the others on the moderate networks): the same weakness as section 15.
- **Single runs, one machine, one generator.** Differences under about 0.005 are noise. The competitors were run with the settings used in section 2 and are not tuned further.

**The graphics-card question, with a check instead of a guess.** Majorization (every item moving at once to the weighted mean of where each other item wants it) is the form of this calculation a graphics card can run in parallel, and on the CPU it reaches the same truth as the sweeps, not a better one (section 13, fourth round). `bench/suites.js` now has a check, `gpumaj`, that runs 20 such steps in a WebGPU compute shader and again on the CPU from the same start and reports whether the two pictures agree, in plain words (`NFM_CHROME_ARGS='--enable-unsafe-webgpu ...' node bench/run.js chromium gpumaj`; the flags are in the plan). In Chromium 154 on the adapter available here, it agrees at 500, 1,500 and 3,000 items: the distance error is identical to the digit shown (2092.1, 2414.1 and 2570.2, from starts of 5,911, 32,407 and 71,986) and items differ by less than 0.05% of a link length. So the shader is right. What it does not tell is how fast a real card would be: that adapter is a software one, and its times (106, 638 and 2,450 ms against 53, 350 and 1,256 ms on the CPU) are not evidence either way. It is not part of the page. After the changes above, the sweeps are well under half of the time at 10,000 items (about 1 of 2.8 s; the rest is the table of hop counts and the overlap step), so the most a card could save is that share, and only on a card that is fast enough to beat the CPU on a table of 100 MB moved across.

## 17. "Closeness (nearest are linked)": an arrangement for the neighborhood question

Section 15 showed that Stress is weak when the question is "are my linked items the ones nearest to me?", and section 13 (fourth round) that bolting a closeness term onto Stress does not work. So closeness is its own arrangement in the Arrangement list, **Closeness (nearest are linked)**, with its own objective instead of a correction:
- It starts from the Stress picture, so the overall shape is right.
- Then, for 150 rounds, every link pulls its two items together and each linked item is pushed away from 10 randomly chosen other items. The force falls off slowly with distance (the shape used by t-SNE and UMAP; the random pushes are the sampling used by LargeVis), the step shrinks to zero, and big pieces (over 20,000 items) use fewer rounds.
- The same steps as for Stress then stretch a crowded picture and separate any items that touch, so nothing touches.
- Seeded: the same data gives the same picture.

**Node, one run each** (neighborhood score / distance truth; higher neighborhood score is better, lower truth is truer; competitors from sections 12 and 15 and the runs of section 16, so the sizes differ by row):

| network | items | closeness | ForceAtlas2 | d3-force | our Force | normal Stress |
|---|---:|---:|---:|---:|---:|---:|
| simple tree | 1,000 | **0.208** / 0.154 | 0.159 / 0.197 | 0.109 / 0.208 | 0.082 / 0.172 | 0.012 / 0.121 |
| complex | 1,000 | **0.129** / 0.188 | 0.045 / 0.147 | 0.034 / 0.187 | 0.026 / 0.140 | 0.020 / 0.124 |
| moderate | 3,000 | **0.068** / 0.199 | 0.031 / 0.178 | 0.027 / 0.194 | 0.011 / 0.168 | 0.007 / 0.152 |
| simple tree | 5,000 | **0.165** / 0.195 | 0.091 / 0.205 | 0.072 / 0.206 | – | 0.000 / 0.184 |
| moderate | 5,000 | **0.047** / 0.197 | 0.020 / 0.182 | 0.014 / 0.182 | – | 0.001 / 0.198 |
| complex | 5,000 | **0.044** / 0.234 | 0.011 / 0.171 | 0.006 / 0.187 | – | 0.001 / 0.201 |
| simple tree | 10,000 | **0.143** / 0.202 | 0.061 / 0.199 | 0.067 / 0.210 | – | 0.002 / 0.199 |
| moderate | 10,000 | **0.028** / 0.200 | 0.011 / 0.184 | 0.008 / 0.190 | – | 0.000 / 0.203 |
| complex | 10,000 | **0.024** / 0.221 | 0.008 / 0.179 | 0.005 / 0.195 | – | 0.000 / 0.198 |

**In the browsers** (time / distance truth, one run each; nothing touched in any of the 18 runs):

| network | items | Chromium 154 | Firefox 158 |
|---|---:|---:|---:|
| simple tree | 1,000 / 5,000 / 10,000 | 0.4 s / 0.151, 1.2 s / 0.186, 2.6 s / 0.198 | 0.5 s / 0.153, 1.1 s / 0.186, 1.9 s / 0.192 |
| moderate | 1,000 / 5,000 / 10,000 | 0.7 s / 0.188, 2.8 s / 0.194, 4.5 s / 0.193 | 0.5 s / 0.191, 1.6 s / 0.197, 3.3 s / 0.194 |
| complex | 1,000 / 5,000 / 10,000 | 0.7 s / 0.202, 2.7 s / 0.225, 5.3 s / 0.246 | 0.5 s / 0.188, 2.0 s / 0.225, 3.3 s / 0.269 |

Reading it:
- **On the neighborhood question it wins every row**: 1.3 to 2.9× the neighborhood score of the best of ForceAtlas2 and d3-force at 1,000 to 3,000 items, and 1.8 to 4× at 5,000 and 10,000, while taking 1 to 5 s where the others take 10 to 35 s at 5,000 and 10,000 items.
- **It is not the choice for distances.** On the plain tree its distance truth is level with or better than ForceAtlas2 and d3-force (0.154 against 0.197 at 1,000 items, 0.195 against 0.205 at 5,000, 0.202 against 0.199 at 10,000); on moderate networks it is 8 to 12% less true, and on complex networks with hubs 23 to 37% less true (0.221 to 0.246 against 0.179 at 10,000 items). For distances use Distances (section 16 for big networks).
- **Runs differ between engines.** The same data scored 0.221 in Node and 0.246 and 0.269 in Chromium and Firefox for the complex network at 10,000 items; the optimization is sensitive to the last digits of the number routines. Single runs; differences under about 0.01 are noise.
- **What did not matter.** Starting step size 0.1 to 0.5, 80 to 600 rounds, 2 to 10 random pushes (more pushes raised the score a little at 5,000 items and were kept), and dividing each item's steps by its number of links, all moved the results by less than the run-to-run difference or in the wrong direction. A first version that started from the spiral instead of the Stress picture scored 0.202 on the 1,000-item tree but only 0.25 to 0.37 in distance truth.
- **Winning the distance truth back on networks with hubs: tried, and it is a trade, not a fix** (Node, 5,000-item networks and the 1,000-item tree; each cell is distance truth / neighborhood score; as shipped, then with Stress sweeps added after the closeness rounds):

| | complex 5,000 | moderate 5,000 | simple 1,000 |
|---|---:|---:|---:|
| As shipped | 0.234 / 0.044 | 0.197 / 0.047 | 0.154 / 0.208 |
| 2 gentle sweeps (step 0.05) | 0.184 / 0.010 | 0.188 / 0.022 | 0.141 / 0.105 |
| 4 gentle sweeps (step 0.05) | 0.177 / 0.007 | 0.184 / 0.016 | 0.137 / 0.052 |
| 4 sweeps (step 0.1) | 0.170 / 0.004 | 0.181 / 0.010 | 0.133 / 0.023 |
| 4 sweeps (step 0.3) | 0.166 / 0.002 | 0.172 / 0.004 | 0.127 / 0.012 |
| 8 sweeps (step 1.0) | 0.174 / 0.001 | 0.178 / 0.001 | 0.122 / 0.013 |
| Far pairs only (3+ hops), 4 sweeps (step 0.3) | 0.224 / 0.009 | 0.187 / 0.008 | 0.128 / 0.019 |
| Far pairs only (4+ hops), 4 sweeps (step 0.3) | 0.230 / 0.026 | 0.209 / 0.025 | 0.128 / 0.010 |
| ForceAtlas2, for reference | 0.171 / 0.011 | 0.182 / 0.020 | 0.197 / 0.159 |

Distance truth comes back with a few Stress sweeps, and the neighborhood score goes with it: the two objectives pull the same items in different directions, so there is a curve and no free point on it. The middle of the curve (2 sweeps at step 0.05) matches ForceAtlas2 on both scores at 5,000 items (0.184 / 0.010 against 0.171 / 0.011 on the complex network) and keeps no neighborhood advantage. Keeping the near pairs out of the sweeps, so only the far ones act, did not help either. None of this code was kept: Closeness stays at the neighborhood end of the curve, Distances at the other.
- **A bug found on the way:** the step that stretches a crowded picture before separating items was only applied to Stress; without it the complex network at 5,000 items scored 0.225 even with zero rounds of the new method. Closeness now gets it too.

## 18. Firefox against Chromium across our own modules

The same jobs were run in both browsers for sections 1 to 17, so the Firefox-to-Chromium time ratio can be read for every one of our modules (156 comparable numbers in the saved results; the median ratio is 1.20: Firefox is 20% slower on these jobs, in the middle of what the two engines usually differ by). The ones far above that:

| Module | Firefox / Chromium before | Cause | After |
|---|---:|---|---:|
| Force arrangement, 3,000 to 10,000 items | 1.4 to 1.7× (1.5× at 3,000, 1.7× at 10,000) | A small array made for every tree node and spring visited in the force calculation (millions per picture); Firefox pays far more for those than Chromium | 0.9 to 1.2× |
| Normal random draws, 1,000,000 | 2.8× (60 against 21 ms) | See "Normal draws and CSV, looked at again" below: a cold first run plus the engine's own speed on integer and table work; no change made | unchanged |
| CSV reading, 50,000 rows | 1.35× median, up to 2.8× for mid-size files | See below: cold-start and memory-cleanup variation in Firefox, not the method; no change made | unchanged |
| GIF export, 4 frames | about 1× | Section 14 | already done |
| Stress arrangement | 1.0 to 1.3× | | unchanged |

**Normal draws and CSV, looked at again** (nothing changed in the code; the raw numbers are `*-drawsRun.jsonl`, `*-drawsVar.jsonl`, `*-csvVar.jsonl` and `*-csvCold.jsonl` in `bench/results`, and the jobs are `drawsRun`, `drawsVar`, `csvVar` and `csvCold` in `bench/plans.js`):

- *Normal draws.* The first 1,000,000 draws in a page are slow in both browsers (73 ms in Chromium, 66 ms in Firefox) and settle after a few runs: Chromium to 13 ms, Firefox to 31 to 35 ms (it jumps between 31 and 72 ms from run to run on this two-core machine). The 2.8× in the table above mixed the cold run with the steady one; the steady ratio is about 2.5×. Six ways of writing the generator (state in a closure, inlined, in a typed array, in an object field, compare before multiply, and a batch that fills an array) were timed: the best in Firefox, the batch, saves about 20% and needs every caller to change, and the others are within 10% of what ships. Even the tightest loop costs Firefox 17 to 25 ns a draw and Chromium 4 to 10 ns, so this is the engines' own speed on this kind of integer and table work. Still faster than d3 (51 ms) and jStat (42 to 48 ms) in Chromium, level with them in Firefox, at 1,000,000 draws.
- *CSV reading.* Timed one after another in one page with all the methods taking turns, the reader takes 11 to 34 ms in Firefox and 19 to 52 ms in Chromium for 50,000 rows (6 to 12 columns, 12 to 200 characters a field): the same, and no other way of cutting the lines (splitting the whole file first, a regular expression, one flat split) is faster by more than the run-to-run noise. The slow Firefox numbers in section 1 were measured with the reader, Papa Parse and d3-dsv taking turns in one page, where Firefox's memory cleanup runs in the middle of the timing; read cold, one reader per fresh page, the first parse takes Firefox 18 to 70 ms (middle about 45) and Chromium about 33 ms. So a person opening one file sees about 1.3× in Firefox with a wide swing, not 2.4×, and Papa Parse shows the same pattern in the same pages. Nothing to change in the reader.

**The Force fix, measured** (one run each, time, in the same engine before and after; distance truth is identical to three digits and the pictures are byte for byte identical in 2D and 3D):

| network | items | Chromium before to after | Firefox before to after |
|---|---:|---:|---:|
| moderate | 1,000 | 0.60 s to 0.51 s | 1.0 s to 0.89 s |
| moderate | 3,000 | 2.1 s to 1.7 s | 3.2 s to 2.3 s |
| moderate | 10,000 | 5.3 s to 4.2 s | 6.7 s to 3.8 s |
| complex | 1,000 | 0.59 s to 0.49 s | 0.93 s to 0.48 s |
| complex | 3,000 | 2.3 s to 1.9 s | 3.5 s to 2.0 s |
| complex | 10,000 | 5.1 s to 4.7 s | 8.0 s to 5.7 s |

Chromium gains 9 to 27%, Firefox 12 to 95%. A search of the engine, simulation and scene code for the same pattern (a small array made inside a hot loop) found no other instance. Raw numbers: `bench/results/*-force-before.jsonl` and `*-force.jsonl`; the job list is `node run.js firefox forceOurs`.

## 19. Cold start, and best quality on the graphics card

**Cold start** (`node run.js firefox cold`; raw: `bench/results/*-cold.jsonl`). Every step a person triggers on a new file (read, import, prepare, check, flow drawing, Distances, Force), run three times in a fresh page on three different files of the same kind and size; middle of three pages.

| file | Firefox first run | Firefox third run | Chromium first run | Chromium third run |
|---|---:|---:|---:|---:|
| moderate, 500 items | 568 ms | 349 ms | 475 ms | 344 ms |
| moderate, 2,000 items | 2.90 s | 2.69 s | 2.61 s | 2.72 s |
| complex, 2,000 items | 3.22 s | 2.68 s | 2.79 s | 2.94 s |

The first run pays a fixed warm-up of about 130 to 220 ms in both browsers (the code is compiled the first time it runs), spread over the checker, the flow drawing, Distances and Force. At 2,000 items Chromium shows no warm-up cost any more; Firefox keeps 0.2 to 0.5 s (7 to 17%), most of it in Force (1.62 s first against 1.26 s later). A warm-up pass on a tiny network while the page is idle would save most of the fixed part, so it is a candidate for the next round, not something shipped.

**Best quality on the graphics card** (research; not in the app). Majorization steps ("every item moves to the weighted mean of where each other item wants it", weights 1 / hops squared, the same quantity the truth score measures) need only the hop table and positions, and each item's update is independent, so the work fits a graphics card. In Node, with plain 64-bit math, started from a cheap 60-pivot sketch (0.14 to 0.18 s at 5,000 items) the steps reach best-quality truth in a few steps:

| network, 5,000 items | sketch only | 30 steps | 80 steps | 150 steps | app's best quality |
|---|---:|---:|---:|---:|---:|
| moderate | 0.197 | 0.156 | 0.155 | 0.154 | 0.155 |
| complex | 0.177 | 0.144 | 0.143 | 0.142 | 0.144 |

(Started from the app's quick Distances picture instead of the sketch, the same steps need 30 to 80 to get there, 0.159 and 0.150 at 30; the sketch is both cheaper and a better start.) The prototype in `src/gpustress.js` does all of it on the card with WebGPU: the hop table by bit-parallel breadth-first walks (32 start items per word, one byte per pair, all batches in one dispatch per level), the weights, and the steps (4 items per thread, positions shared through workgroup memory). Checked on this machine's software WebGPU stand-in (not a real card): the hop table matches the processor's in every one of 360,000 entries at 600 items, the steps match the processor's 64-bit math (0% difference in distance error), and at 5,000 items the truth after 20 / 40 / 60 steps is 0.157 / 0.155 / 0.155 (moderate) and 0.144 / 0.143 / 0.143 (complex), the same as the numbers above. Speed on a real card is unmeasured; `bench/netflow-map-tester.html` measures it on a laptop (below).

**First run on a real card** (laptop with integrated graphics (2 GB of graphics memory), 14 GB DDR5, Windows, Firefox 159; `bench/results/laptop-integrated-graphics-firefox159-tester1.md`). The graphics-card hop table matched the processor's in all 1,440,000 entries at 1,200 items and the steps matched. But the first kernel was not faster than the processor's best quality on this fast laptop (0.5 to 0.8×):

| network | items | processor | graphics card (v1) | truth, processor / card |
|---|---:|---:|---:|---:|
| moderate | 2,000 | 0.51 s | 0.75 s | 0.149 / 0.153 |
| moderate | 5,000 | 0.55 s | 1.11 s | 0.159 / 0.155 |
| moderate | 10,000 | 1.75 s | 2.10 s | 0.164 / 0.165 |
| complex | 5,000 | 0.51 s | 1.10 s | 0.144 / 0.143 |
| complex | 9,999 | 1.66 s | 2.17 s | 0.147 / 0.156 |
| moderate | 20,000 | 5.2 s | 8.9 s | 0.162 / 0.164 |

What the numbers say: the 60 steps ran at about 3.7 billion item pairs a second whatever the size (that is 1.7 s of the 2.1 s at 10,000 items), well under what the card can do, because the kernel does two divisions and a square root per pair; at 2,000 items it ran 8 times slower per pair than at 10,000 because 2,000 items fill only 8 workgroups of a 12-unit card; the weights pass and the read-back each cost a flat 100 ms in Firefox (a wait, not work); and at 20,000 items the hop table took 2.3 s against 0.12 s at 10,000 (the working arrays no longer fit the cache). Truth was equal except complex 10,000, where plain steps stop at a local minimum (0.156 at 60 steps against 0.147 for the processor; from the app's quick picture 0.154; over-relaxed steps, x <- x + 1.8 (target - x), reach 0.154 at 60 and 0.152 at 120 steps in Node). The same file shows Firefox 159 on this laptop is warm from the first run (cold start 215 ms against 181 ms, no extra cost at 2,000 items) and does 1,000,000 normal draws in 15 ms.

Version 2 of the kernel (in the tester built after this result) answers each of those: no divisions (two small tables, or one reciprocal, plus one inverse square root per pair), the item range split over workgroups so the card is full at every size, hop table walked 512 start items at a time, waits removed (only the final read-back waits), 150 steps available, and over-relaxation. Correct on the software stand-in at 800 items (0% difference from the processor's math). The next laptop run times old against new.

**Second run (version 2 of the kernel, same laptop; `bench/results/laptop-integrated-graphics-firefox159-tester2.md`).** The graphics card is now faster than the processor's best quality in 6 of 7 runs, with equal truth:

| network | items | processor | graphics card (v2) | faster by | truth, processor / card |
|---|---:|---:|---:|---:|---:|
| moderate | 2,000 | 0.55 s | 0.29 s | 1.9× | 0.149 / 0.152 |
| moderate | 5,000 | 0.57 s | 0.38 s | 1.5× | 0.159 / 0.154 |
| moderate | 10,000 | 1.75 s | 0.56 s | 3.1× | 0.164 / 0.163 |
| complex | 5,000 | 0.42 s | 0.38 s | 1.1× | 0.144 / 0.142 |
| complex | 9,999 | 1.65 s | 0.55 s | 3.0× | 0.147 / 0.155 |
| moderate | 20,000 | 5.2 s | 1.55 s | 3.4× | 0.162 / 0.163 |
| moderate | 30,000 | 2.6 s (quick sample, above the best-quality limit) | 4.3 s | | 0.211 / 0.796 (ran away) |

The 30,000-item run is the one that matters (the processor cannot do best quality there) and it failed: the steps diverged (truth 0.206 at 20 steps, 0.222 at 40, 0.796 at 60). The cause is the over-relaxation factor 1.6 used in that run: the simultaneous (Jacobi) update has iteration-matrix eigenvalues down to some negative number, and a factor of 1.6 overshoots once that number is below about -0.25; it was fine up to 20,000 items and not above. Version 2's default is now 1.2 (safe to about -0.8), and the tester runs 30,000 items with factors 1.0 and 1.2 and flags a run-away. The old-against-new comparison step also failed on the laptop ("Invalid buffer", before any row): the old kernel's run is the likely cause and is now caught per variant with the card's own message and any device-lost reason recorded. Complex 9,999 items still ends at 0.155 against 0.147; the 150-step variant in the next run shows how far more steps close that. Cold start is 244 ms against 186 ms at 500 items and 1.34 s against 1.28 s at 2,000.

**Third run (version 2 with gentler pacing; `bench/results/laptop-integrated-graphics-firefox159-tester4.md`).** Stable at every size, including 30,000 items, which the app cannot do at best quality today:

| network | items | processor | graphics card | faster by | truth, processor / card |
|---|---:|---:|---:|---:|---:|
| moderate | 2,000 | 0.42 s | 0.33 s | 1.3× | 0.149 / 0.152 |
| moderate | 5,000 | 0.53 s | 0.33 s | 1.6× | 0.159 / 0.155 |
| moderate | 10,000 | 1.69 s | 0.54 s | 3.1× | 0.164 / 0.164 |
| complex | 5,000 | 0.42 s | 0.40 s | 1.0× | 0.144 / 0.143 |
| complex | 9,999 | 1.59 s | 0.53 s | 3.0× | 0.147 / 0.156 |
| moderate | 20,000 | 5.2 s | 2.1 s | 2.5× | 0.162 / 0.164 |
| moderate | 30,000 | 2.6 s (quick sample) | 5.5 s | | **0.211 / 0.164** |

At 30,000 items best quality is 22% truer than the quick sample the app uses there, and 30,000 is not the limit: the hop table needs k x k bytes, so a 2 GB buffer allows about 46,000 items. Variants at 10,000 items (60 steps): plain steps 0.165 in 534 ms, relaxed 1.2 0.164 in 547 ms, relaxed 1.6 0.163 in 647 ms, the no-table version 0.164 in 675 ms (so the tables version stays), 30 steps 0.166 in 544 ms. Complex 9,999 items: 60 steps 0.156, 150 steps 0.153 (844 ms), against 0.147 for the processor, so on hub-heavy networks the card's plain steps stay about 0.006 to 0.009 short; the processor's random-order sweeps escape a local minimum that these steps do not. Parts of one 10,000-item job: sketch 0.1 s, hop table and weights 0.15 s, 60 steps 0.30 s, read-back 0.1 s (a flat wait in Firefox). Cold start is 245 against 182 ms at 500 items and nothing at 2,000.

Version 3 (next tester) overlaps the processor's sketch with the card's table, uses 40 steps (0.165 against 0.164 at 60), paces with fewer waits, and times how many start items to walk together (32 to 512) at 20,000 items, since the table is now the largest part at big sizes (about 1.0 s of 2.1 s at 20,000 and 2.7 s of 5.5 s at 30,000).

**Fourth run (sketch overlapped, 40 steps; `bench/results/laptop-integrated-graphics-firefox159-tester5.md`).** 10,000 items: 0.46 s against 1.67 s (3.7×, truth 0.165 against 0.164); 20,000: 2.2 s against 5.1 s (2.3×, 0.166 against 0.162); 30,000: 4.0 s (was 5.5 s) at truth 0.165 against the app's quick 0.211; complex 9,999: 3.0× at 0.156 against 0.147. Relaxation 1.2 and 1.6 both converge (0.164 and 0.163 at 60 steps against 0.165 plain); 1.2 stays the default. Hop table by start items walked together (20,000 items): 32: 1.34 s, 64: 1.00 s, 128: 1.08 s, 256: 1.00 s, 512: 1.00 s, so the table is not limited by the working arrays fitting a cache; it is limited by about 1.3 billion scattered reads (625 batches x 18 levels x 120,000 edge reads). Version 4 (in the next tester) interleaves the batches of one item side by side in memory so neighboring threads read neighboring words, which turns that into line-sized reads; the table's answer is unchanged (0 of 360,000 entries differ at 600 items on the software stand-in).

**Fifth run (batches of one item side by side in memory; `bench/results/laptop-integrated-graphics-firefox159-tester6.md`).** Faster than the processor in all 7 sizes:

| network | items | processor | graphics card | faster by | truth, processor / card |
|---|---:|---:|---:|---:|---:|
| moderate | 2,000 | 0.44 s | 0.31 s | 1.4× | 0.149 / 0.153 |
| moderate | 5,000 | 0.56 s | 0.30 s | 1.9× | 0.159 / 0.155 |
| moderate | 10,000 | 1.73 s | 0.50 s | 3.5× | 0.164 / 0.165 |
| complex | 5,000 | 0.42 s | 0.29 s | 1.5× | 0.144 / 0.143 |
| complex | 9,999 | 1.62 s | 0.50 s | 3.2× | 0.147 / 0.156 |
| moderate | 20,000 | 5.2 s | 1.17 s | 4.5× | 0.162 / 0.166 |
| moderate | 30,000 | 2.5 s (quick sample) | 1.73 s | 1.5× | 0.211 / 0.165 |

The hop table at 20,000 items fell from 1.0 s to 0.29 s (512 start items together; 32 together 1.65 s, 64: 0.69 s, 128 and 256: 0.39 s); at 30,000 items the whole job is 1.7 s, faster than the quick sample and 22% truer. What is left at 10,000 items (0.5 s): sketch 0.06 s (overlapped), table 0.15 s, 40 steps 0.2 s, read-back 0.1 s (a flat wait in Firefox). What this does not yet do: run the app's overlap clean-up on the card's picture, and match the processor's truth on hub-heavy networks (complex 9,999: 0.156 at 40 or 60 steps, 0.153 at 150, against 0.147).

**Sixth run (parallel random pairs; `bench/results/laptop-integrated-graphics-firefox159-tester7.md`).** The graphics card now also runs the processor's own best-quality method in parallel: with the items in a random order, one dispatch pairs item i with item i+m for one offset m, every pair moves both ends as in the processor's loop, and 3 sweeps (2 above 12,000 items) over all offsets use the processor's step schedule. It matches a 64-bit processor copy of the same sweeps to within 0.4% in distance error (and to under 0.002 of a link on single sweeps; many tiny steps let 32-bit and 64-bit positions drift apart, which is why only the distance error is compared). Total time and truth, old 40 steps against the new method:

| network | items | processor | old steps | parallel pairs | truth, processor / old / new |
|---|---:|---:|---:|---:|---:|
| moderate | 2,000 | 0.46 s | 0.28 s | 0.10 s | 0.149 / 0.153 / 0.154 |
| moderate | 5,000 | 0.59 s | 0.35 s | 0.30 s | 0.159 / 0.155 / 0.156 |
| moderate | 10,000 | 2.04 s | 0.56 s | 0.80 s | 0.164 / 0.165 / 0.161 |
| complex | 5,000 | 0.47 s | 0.30 s | 0.30 s | 0.144 / 0.143 / 0.144 |
| complex | 9,999 | 1.85 s | 0.54 s | 0.90 s | 0.147 / 0.156 / 0.149 |
| moderate | 20,000 | 5.9 s | 1.26 s | 6.1 s | 0.162 / 0.166 / 0.163 |
| moderate | 30,000 | 2.8 s (quick) | 2.6 s | 30 s | 0.211 / 0.165 / 0.163 |

Five clean-up steps after the sweeps change little (complex 9,999: 0.148; moderate 10,000: 0.161). More sweeps help a little (moderate 10,000: 2 sweeps 0.164, 3: 0.161, 4: 0.160); 2 sweeps on complex 9,999 give 0.154 in 0.58 s. So the gap on hub-heavy networks closes (0.156 to 0.149 against the processor's 0.147) and on moderate networks the card is truer than the processor (0.161 against 0.164), at about 1.5 times the old steps' time at 10,000 items. Above about 12,000 items it is not worth it: every pair lookup is a random read of one byte from a table of hundreds of megabytes, which costs 1.7 ns each at 10,000 items, 7 ns at 20,000 and 16 ns at 30,000 (6 s and 30 s), for a gain of 0.003 in truth. Reordering the offsets so neighboring dispatches share cache lines did not work: in a processor emulation, running 16 or 64 neighboring offsets together raises the distance error from 0.144 to 0.179 and 0.189 (complex 5,000), and 2 neighboring offsets together is fine (0.144). Policy that follows from this: parallel pairs up to about 12,000 items, the old 40 steps above.

**Seventh run (one smooth sweep; `bench/results/laptop-integrated-graphics-firefox159-tester8.md`).** The step size now shrinks a little with every dispatch instead of only between sweeps, so one sweep does the work of three (processor emulation first: complex 5,000 0.144 with one smooth sweep against 0.144 with three; neighboring-offset ordering stays rejected). On the card, whole job, one smooth sweep against the old 40 steps and the processor:

| network | items | processor | old steps | one smooth sweep | truth, processor / old / new |
|---|---:|---:|---:|---:|---:|
| moderate | 2,000 | 0.45 s | 0.23 s | 0.10 s | 0.149 / 0.153 / 0.155 |
| moderate | 5,000 | 0.52 s | 0.32 s | 0.10 s | 0.159 / 0.155 / 0.155 |
| moderate | 10,000 | 1.64 s | 0.47 s | 0.30 s | 0.164 / 0.165 / 0.163 |
| complex | 5,000 | 0.41 s | 0.27 s | 0.10 s | 0.144 / 0.143 / 0.143 |
| complex | 9,999 | 1.55 s | 0.45 s | 0.30 s | 0.147 / 0.156 / 0.151 |
| moderate | 20,000 | 5.6 s | 1.09 s | 2.0 s | 0.162 / 0.166 / 0.162 |
| moderate | 30,000 | 2.4 s (quick) | 1.9 s | 6.1 s | 0.211 / 0.165 / 0.162 |

Variants at about 10,000 items (complex / moderate): two smooth sweeps 0.48 s, truth 0.147 / 0.163 (the processor's 0.147 / 0.164); three smooth sweeps 0.163 on moderate (no gain); three old-style sweeps 0.58 s, 0.149 / 0.161; five clean-up steps after one sweep change nothing; a bigger first step (0.1) the same, smaller steps (0.02) worse (0.155). The sweep part at 10,000 items is 0.30 s including the flat read-back wait. The card now matches the processor's truth on hub-heavy networks and beats it on moderate ones, 3 to 5 times faster, up to about 12,000 items. Above that the pair lookups are random reads from a table of hundreds of megabytes (2.0 s at 20,000 and 6.1 s at 30,000 for a gain of 0.003 to 0.004), so the old 40 steps stay the choice there. Policy that follows: two smooth sweeps up to about 12,000 items, the old 40 steps above.

**Eighth run (the whole app path, including the app's own overlap clean-up; `bench/results/laptop-integrated-graphics-firefox159-tester9.md`).** The engine got a small hook (`stressTuning.external`): when it reaches the arrangement of a big piece it can be handed a finished picture, and then runs its own spread, push-apart and settle on it as usual. The tester captures the piece, has the card make the picture (two smooth sweeps up to 12,500 items, 40 old steps above), hands it back, and times and scores the whole build. Whole build, processor against the card's picture through the app's clean-up (truth measured after the clean-up on both):

| network | items | processor | with the card | faster by | truth, processor / card |
|---|---:|---:|---:|---:|---:|
| moderate | 5,000 | 0.55 s | 0.20 s | 2.8× | 0.159 / 0.153 |
| moderate | 10,000 | 1.92 s | 0.53 s | 3.7× | 0.164 / 0.159 |
| complex | 5,000 | 0.44 s | 0.18 s | 2.4× | 0.144 / 0.143 |
| complex | 9,999 | 1.69 s | 0.74 s | 2.3× | 0.147 / 0.147 |
| moderate | 20,000 | 5.5 s | 1.2 s | 4.5× | 0.162 / 0.162 |
| moderate | 30,000 | 2.8 s (quick sample) | 2.0 s | 1.4× | 0.211 / 0.165 |

The clean-up costs the card's picture about 0.004 of truth (the processor's own picture goes through the same clean-up), and the card's picture is at least as true as the processor's everywhere, equal on the hub-heavy network (0.147). At 2,000 items the hook is not used (pieces of 4,000 items or fewer take the engine's normal path). Everything needed for the integration is now measured; what remains is the asynchronous step in the app, the processor fallback and the plain-words note.

**The laptop tester.** `node tools/build-tester.mjs` writes one self-contained page, `bench/netflow-map-tester.html`. Opened in a browser it starts by itself, runs five checks (the computer and its graphics adapter; whether the graphics-card hop table and steps match the processor's; time and truth of the processor's best quality against the graphics card at 2,000 to 20,000 items; first run against later runs; random draws, CSV reading and Force repeated), explains each in plain words, and offers a results file (`netflow-map-tester-results.md`) to hand back. `?quick=1` makes it small enough to try anywhere; `?plan=moderate:5000` picks the sizes. `node bench/tester/run-local.js <firefox|chromium> [quick]` runs it in this machine's browsers.

## 20. 3D force: a stress start fixes the large sizes

**The problem.** In the tester ("3D arrangements") the 3D force arrangement was true at 1,000 items (hop error 0.101, lower is truer) but much worse at 3,000 (0.193), and worse again at 6,000 (0.225), while Sphere (0.178) and Stacked planes (0.164) were better there. Two causes: the old start was a Fibonacci sphere with items in input order (linked items start far apart, so springs and repulsion have to untangle everything), and the number of force steps shrank with size (260, 160, 90, 45) just where the tangle is largest. The picture also turned into a flat pancake or sausage (smallest to largest spread 0.38 at 3,000, 0.30 at 6,000).

**What was tried** (Node, 11 seeds of the generator, hop error as in the tester, time in this sandbox, which is about 2.3 times slower than the owner's laptop):

| way | moderate 3,000: error / time | moderate 6,000: error / time |
|---|---:|---:|
| old (sphere start, 90 / 45 force steps) | 0.193 / 1.6 s | 0.225 / 3.9 s |
| 3D stress alone (pivots, links and near neighbors, weights 1 / hops squared, 24 sweeps) | 0.130 / 0.46 s | 0.136 / 0.65 s |
| stress with 2.4 times the pairs | 0.119 / 0.85 s | 0.130 / 1.2 s |
| stress, then 20 cool force steps (start step 0.35 K) | 0.117 / 0.9 s | 0.128 / 1.6 s |
| stress, then 20 force steps starting hot (3 K) | **0.104 / 0.8 s** | **0.110 / 1.3 s** |

Three things stood out. (1) The stress start is what removes the size problem; its cost is small (about 0.1 s per 1,000 items) next to the force steps. (2) A force run that starts hot (step 3 K, the old run started at 2 K) after the stress start is both truer and more clustered than a gentle polish: groups stay distinct (mean distance inside a group over mean distance between groups: 0.30 at 3,000 against 0.37 before; stress alone 0.59, a gentle polish about 0.55). (3) Giving the stress more pairs or sweeps barely helps once the force steps follow, so the stress is kept cheap.

**What changed** (`src/engine.js`: `stress3d`, `stressStart3d`, the `force3d` branch of `globalNetwork`; settings in `NFMEngine.force3dTuning`). Each connected piece gets a 3D stress layout (same method as the flat Distances arrangement, carried to three dimensions; every pair below 700 items, otherwise 20 to 150 far-apart pivots, the links and up to 40 near neighbors per item), started from a spiral over a sphere in breadth-first order. Pieces are set on a shell around the biggest, then the force steps run: 20 up to 15,000 items, 12 up to 30,000, 5 above. `forceSim` got two optional arguments for its first and last step size. Seeded: same data, same picture. `force3dTuning.old = true` restores the old start and step counts for before/after runs.

**Before and after** (hop error in 3D, build time; spread is smallest over largest principal extent, groups is the group-distance ratio, lower is more distinct):

| network | items | error before | error after | time before | time after | spread before / after | groups before / after |
|---|---:|---:|---:|---:|---:|---:|---:|
| moderate | 600 | 0.102 | 0.084 | 517 ms | 259 ms | 0.61 / 0.82 | 0.26 / 0.27 |
| moderate | 1,000 | 0.101 | 0.095 | 701 ms | 303 ms | 0.72 / 0.77 | 0.27 / 0.27 |
| moderate | 3,000 | 0.193 | 0.104 | 1.6 s | 0.78 s | 0.38 / 0.95 | 0.37 / 0.30 |
| moderate | 6,000 | 0.225 | 0.110 | 3.9 s | 1.3 s | 0.30 / 0.98 | 0.44 / 0.40 |
| moderate | 10,000 | 0.150 | 0.119 | 2.9 s | 2.5 s | 0.71 / 0.97 | 0.63 / 0.52 |
| moderate | 20,000 | 0.144 | 0.129 | 6.4 s | 4.5 s | 0.80 / 0.98 | 0.68 / 0.73 |
| moderate | 40,000 | 0.137 | 0.127 | 13.3 s | 7.2 s | 0.86 / 0.98 | - / 0.81 |
| complex | 600 | 0.112 | 0.108 | 392 ms | 176 ms | 0.30 / 0.36 | 0.31 / 0.30 |
| complex | 1,000 | 0.121 | 0.115 | 728 ms | 298 ms | 0.31 / 0.40 | 0.34 / 0.34 |
| complex | 3,000 | 0.184 | 0.128 | 1.9 s | 0.66 s | 0.31 / 0.47 | 0.40 / 0.34 |
| complex | 6,000 | 0.218 | 0.133 | 4.2 s | 1.4 s | 0.32 / 0.60 | 0.46 / 0.48 |
| complex | 10,000 | 0.162 | 0.148 | 2.8 s | 3.0 s | 0.73 / 0.64 | 0.64 / 0.68 |

**Limits.** Hub-heavy (complex) networks stay about 0.13 to 0.15 above 3,000 items: the hubs' extra push in the force steps pulls them away from the stress picture, and a gentler start gives 0.12 but loses some group separation. Above 20,000 items only 5 force steps run, so groups blend more (distinctness 0.73 at 20,000 and 0.81 at 40,000; the old picture had 0.68 at 20,000); 40,000 items take about 3 s on the laptop's class of machine (7 s here). The tester's "3D arrangements" table shows the new numbers after a re-run; the old 3,000-item row (0.193) is the "before". Test: `node test/force3d.test.js` (hop error under 0.125 on moderate and under 0.15 on complex at 3,000 items, spread not collapsed, same data same picture, empty / one / two / loners / self-links / repeated links / several pieces / a 2,000-leaf hub / a 3,000-item chain).

## 21. WebAssembly for the Force arrangement, and two plain-JavaScript speed-ups (2026-10-17)

Browsers and engines, one at a time: Node 22.22.0, ungoogled-chromium 155.0.8059.39, Firefox 158.0, WebKitGTK 2.52.6 and GNOME Web 46.5 (software drawing in a cloud container, so read the numbers as "A against B", not as phone or laptop speed). Firefox's timer shows whole milliseconds. Every table is **milliseconds, lower is better**, except "times faster", where higher is better.

**Force arrangement rounds, JavaScript against WebAssembly** (`wasm/force.c`, 7,260 bytes; `node bench/force-wasm.js <engine>`; a random graph with about two links per item, median of 3 runs, saved in `bench/results/force-wasm-*.json`). The two give the same positions to the last digit in every row (largest position difference 0), including the rare case of two items on the very same spot, which draws from the page's own random generator.

| Engine | Items | Shape | Rounds | JavaScript ms | WebAssembly ms | Times faster | Largest position difference |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| Node 22.22.0 (V8) | 2,000 | 2D | 240 | 1,252 | 677 | 1.85 | 0 |
| Node 22.22.0 (V8) | 10,000 | 2D | 120 | 4,462 | 2,540 | 1.76 | 0 |
| Node 22.22.0 (V8) | 30,000 | 2D | 60 | 7,813 | 4,659 | 1.68 | 0 |
| Node 22.22.0 (V8) | 10,000 | 3D | 90 | 6,873 | 3,460 | 1.99 | 0 |
| ungoogled-chromium 155.0.8059.39 | 2,000 | 2D | 240 | 1,231 | 634 | 1.94 | 0 |
| ungoogled-chromium 155.0.8059.39 | 10,000 | 2D | 120 | 4,734 | 2,223 | 2.13 | 0 |
| ungoogled-chromium 155.0.8059.39 | 30,000 | 2D | 60 | 7,969 | 4,812 | 1.66 | 0 |
| ungoogled-chromium 155.0.8059.39 | 10,000 | 3D | 90 | 5,991 | 3,258 | 1.84 | 0 |
| Firefox 158.0 | 2,000 | 2D | 240 | 1,095 | 755 | 1.45 | 0 |
| Firefox 158.0 | 10,000 | 2D | 120 | 3,895 | 2,567 | 1.52 | 0 |
| Firefox 158.0 | 30,000 | 2D | 60 | 7,748 | 5,093 | 1.52 | 0 |
| Firefox 158.0 | 10,000 | 3D | 90 | 7,801 | 4,044 | 1.93 | 0 |
| WebKitGTK 2.52.6 | 2,000 | 2D | 240 | 1,150 | 641 | 1.79 | 0 |
| WebKitGTK 2.52.6 | 10,000 | 2D | 120 | 3,728 | 2,357 | 1.58 | 0 |
| WebKitGTK 2.52.6 | 30,000 | 2D | 60 | 7,719 | 5,162 | 1.50 | 0 |
| WebKitGTK 2.52.6 | 10,000 | 3D | 90 | 3,891 | 3,506 | 1.11 | 0 |
| GNOME Web 46.5 | 2,000 | 2D | 240 | 975 | 632 | 1.54 | 0 |
| GNOME Web 46.5 | 10,000 | 2D | 120 | 3,224 | 2,287 | 1.41 | 0 |
| GNOME Web 46.5 | 30,000 | 2D | 60 | 6,980 | 4,286 | 1.63 | 0 |
| GNOME Web 46.5 | 10,000 | 3D | 90 | 3,628 | 3,181 | 1.14 | 0 |

Smaller pictures (150 and 300 items, 150 rounds) were 1.5 to 2.1 times faster in all five engines, so the page uses WebAssembly from 150 items up and stays on JavaScript below that (a 100-item picture costs under 40 ms either way, and the first call in a fresh page includes JavaScript warm-up, which flatters WebAssembly). The kernel is a line-for-line port with the compiler told not to fuse multiplies and adds, so every rounding step is the one JavaScript makes. Cost to the page: +11,442 bytes (712,344 to 723,786; gzipped 253,567 to 259,227).

**Closeness arrangement, fixed-exponent `Math.pow` removed** (`bench/closeness-pow.js`; the exponents are always 1 and 0 in the app, so the power is the value itself and the pictures are identical in every row). Whole `build` call, best of 6 runs.

| Engine | Items | Structure | Before ms | After ms | Times faster | Identical pictures |
| --- | ---: | --- | ---: | ---: | ---: | --- |
| Node 22.22.0 (V8) | 3,000 | moderate | 1,322 | 1,220 | 1.08 | yes |
| Node 22.22.0 (V8) | 10,000 | moderate | 1,732 | 1,649 | 1.05 | yes |
| Node 22.22.0 (V8) | 10,000 | complex | 2,067 | 1,800 | 1.15 | yes |
| ungoogled-chromium 155.0.8059.39 | 3,000 | moderate | 2,174 | 1,762 | 1.23 | yes |
| ungoogled-chromium 155.0.8059.39 | 10,000 | moderate | 4,276 | 2,797 | 1.53 | yes |
| ungoogled-chromium 155.0.8059.39 | 10,000 | complex | 5,198 | 3,316 | 1.57 | yes |
| Firefox 158.0 | 3,000 | moderate | 1,727 | 1,827 | 0.95 | yes |
| Firefox 158.0 | 10,000 | moderate | 2,281 | 2,144 | 1.06 | yes |
| Firefox 158.0 | 10,000 | complex | 2,754 | 2,355 | 1.17 | yes |
| WebKitGTK 2.52.6 | 3,000 | moderate | 1,374 | 1,047 | 1.31 | yes |
| WebKitGTK 2.52.6 | 10,000 | moderate | 1,608 | 1,561 | 1.03 | yes |
| WebKitGTK 2.52.6 | 10,000 | complex | 2,261 | 1,790 | 1.26 | yes |
| GNOME Web 46.5 | 3,000 | moderate | 1,259 | 1,340 | 0.94 | yes |
| GNOME Web 46.5 | 10,000 | moderate | 1,876 | 1,880 | 1.00 | yes |
| GNOME Web 46.5 | 10,000 | complex | 2,916 | 2,344 | 1.24 | yes |

The gain is small and uneven (0.94 to 1.57 times; two rows are slightly slower, which is within the noise of one run). Chromium gains most.

**Simulator, 1,000 runs, bookkeeping kept only for the ends that were hit** (`bench/sim-sparse.js`). A 100,000-item simple tree has 66,667 ends and most ends are hit by no walker in a given run; the old code touched every end in every run (66 million visits for 1,000 runs) and kept 66 million numbers. Now only ends that were hit are visited and stored; the zeros are added back when the results are read, so every number, interval and percentile is exactly the old one (checked by `test/sim.test.js`, section 4, against the old bookkeeping kept behind `denseEnds`). The "moderate" row has no ends at all and is the control.

| Engine | Items | Structure | Before ms | After ms | Times faster | Identical results |
| --- | ---: | --- | ---: | ---: | ---: | --- |
| Node 22.22.0 (V8) | 100,000 | simple (66,667 ends) | 9,188 | 300 | 30.6 | yes |
| Node 22.22.0 (V8) | 100,000 | moderate (0 ends) | 93 | 103 | 0.9 | yes |
| ungoogled-chromium 155.0.8059.39 | 100,000 | simple (66,667 ends) | 9,022 | 201 | 44.9 | yes |
| ungoogled-chromium 155.0.8059.39 | 100,000 | moderate (0 ends) | 160 | 145 | 1.1 | yes |
| Firefox 158.0 | 100,000 | simple (66,667 ends) | 10,401 | 98 | 106.1 | yes |
| Firefox 158.0 | 100,000 | moderate (0 ends) | 128 | 101 | 1.3 | yes |
| WebKitGTK 2.52.6 | 100,000 | simple (66,667 ends) | 9,115 | 174 | 52.4 | yes |
| WebKitGTK 2.52.6 | 100,000 | moderate (0 ends) | 210 | 125 | 1.7 | yes |
| GNOME Web 46.5 | 100,000 | simple (66,667 ends) | 8,028 | 154 | 52.1 | yes |
| GNOME Web 46.5 | 100,000 | moderate (0 ends) | 164 | 122 | 1.3 | yes |

It applies up to 4,000 trials; above that the old method (a random sample of at most 4,000 trial counts per end) is still used. Not run: the 1,000,000-item case that ran out of memory in Firefox before; the memory for the 66 million numbers is gone, so it should no longer do that, but that is not measured.

Not measured: 100,000-item Force (it takes about a minute in JavaScript), and any phone.

## 22. WebAssembly for the Distances (stress) layout and the push-apart, and smaller pair lists (2026-10-17, build 2026.10.17.1424)

The Distances arrangement (and Closeness, which starts from it) builds a list of item pairs, shuffles it once, sweeps it, then pushes overlapping items apart. Two changes, one table below.

1. **Hop codes.** Each pair used to take 16 bytes (two item numbers, a Float32 distance, a Float32 weight). It now takes 10: two item numbers and one Uint16 code (the hop count, plus 512 for a pivot pair); distance and weight come from two 1,024-entry tables rounded to float32 exactly as before, so the picture does not change. A piece with a hop count over 511 keeps the old 16-byte lists. Pair memory, **lower is better**: 10,000 items 20.2 to 12.6 MB, 30,000 items 42.5 to 26.6 MB, 3,000 items (every pair) 68.6 to 42.9 MB: **37.5% less** in every row.
2. **WebAssembly pipeline** (`wasm/stress.c`, 5,616 bytes): pair building, the one-time shuffle, all sweeps and the grid push-apart run in WebAssembly from 150 items up; the JavaScript stays the fallback (no WebAssembly, blocked by the page, a hop count over 511, any error). The settle step after the push-apart stays in JavaScript.

Milliseconds for the whole `build()` of a Distances arrangement, **lower is better**; "times faster" is previous build divided by WebAssembly, **higher is better**. The largest difference in any position between the three variants was 0 in every row, so the pictures are identical. Each variant ran in a fresh page (a page that has run one variant has trained the compiler on it). The previous build is commit 64c2585.

**Node 22.22.0** (median of 3 runs, a fresh page for each of the three variants)

| items | previous build ms | new JavaScript ms | WebAssembly ms | WebAssembly vs previous (times faster, higher is better) | largest position difference |
|---|---|---|---|---|---|
| 3,000 moderate | 1,477 | 1,279 | 916 | 1.61 | 0 |
| 10,000 moderate | 1,170 | 1,101 | 928 | 1.26 | 0 |
| 30,000 moderate | 3,842 | 3,914 | 3,139 | 1.22 | 0 |
| 10,000 complex | 1,305 | 1,053 | 908 | 1.44 | 0 |

**ungoogled-chromium 155.0.8059.39** (median of 3 runs, a fresh page for each of the three variants)

| items | previous build ms | new JavaScript ms | WebAssembly ms | WebAssembly vs previous (times faster, higher is better) | largest position difference |
|---|---|---|---|---|---|
| 3,000 moderate | 1,752 | 1,324 | 798 | 2.20 | 0 |
| 10,000 moderate | 1,233 | 1,148 | 841 | 1.47 | 0 |
| 30,000 moderate | 3,754 | 3,809 | 2,696 | 1.39 | 0 |
| 10,000 complex | 1,202 | 1,106 | 854 | 1.41 | 0 |

**Firefox 158.0** (median of 3 runs, a fresh page for each of the three variants)

| items | previous build ms | new JavaScript ms | WebAssembly ms | WebAssembly vs previous (times faster, higher is better) | largest position difference |
|---|---|---|---|---|---|
| 3,000 moderate | 1,521 | 1,439 | 915 | 1.66 | 0 |
| 10,000 moderate | 1,290 | 1,423 | 844 | 1.53 | 0 |
| 30,000 moderate | 4,138 | 4,660 | 2,857 | 1.45 | 0 |
| 10,000 complex | 1,421 | 1,515 | 961 | 1.48 | 0 |

**WebKitGTK 2.52.6** (median of 3 runs, a fresh page for each of the three variants)

| items | previous build ms | new JavaScript ms | WebAssembly ms | WebAssembly vs previous (times faster, higher is better) | largest position difference |
|---|---|---|---|---|---|
| 3,000 moderate | 2,088 | 849 | 1,046 | 2.00 | 0 |
| 10,000 moderate | 1,029 | 957 | 1,003 | 1.03 | 0 |
| 30,000 moderate | 4,005 | 3,206 | 3,019 | 1.33 | 0 |
| 10,000 complex | 1,615 | 990 | 1,025 | 1.58 | 0 |

**GNOME Web 46.5** (median of 3 runs, a fresh page for each of the three variants)

| items | previous build ms | new JavaScript ms | WebAssembly ms | WebAssembly vs previous (times faster, higher is better) | largest position difference |
|---|---|---|---|---|---|
| 3,000 moderate | 1,871 | 1,452 | 983 | 1.90 | 0 |
| 10,000 moderate | 1,102 | 1,301 | 887 | 1.24 | 0 |
| 30,000 moderate | 4,420 | 3,134 | 3,180 | 1.39 | 0 |
| 10,000 complex | 1,494 | 1,121 | 999 | 1.50 | 0 |

Plain takeaway: 1.2 to 2.2 times faster in every engine except one WebKitGTK row (1.03 at 10,000 items); WebKitGTK was the engine whose timings varied most from run to run. Its new JavaScript alone is already faster than the previous build at 3,000 items (849 against 2,088 ms), because the pair lists are 37.5% smaller. Gains are limited because the work is memory-bound: before this change the profile was sweeps about 30%, push-apart 19 to 34%, pair building 12 to 18%; with WebAssembly about 770 of 819 ms at 10,000 items is spent inside the WebAssembly calls. Not measured: 100,000 items (minutes), phones.

**Other small changes in the same build.** The report page base64-encodes its GIF with `Uint8Array.toBase64()` where the browser has it (4 MB of bytes: 28.8, 28, 53 and 60 ms with the old `btoa` loop in Chromium 155, Firefox 158, WebKitGTK 2.52.6 and GNOME Web 46.5, and 2.5, 4, 3 and 1 ms with the new call; identical text; a 121 KB GIF saves under 1 ms). Embedded WebAssembly bytes are read with `Uint8Array.fromBase64()` when present. Headings use `text-wrap: balance` and paragraphs `text-wrap: pretty`: on 36 sample titles at 280, 360 and 480 px wide the lonely last words went from 11, 9 and 12 to 2 to 3, 0 and 0 with `balance` (Chromium 155, Firefox 158, WebKitGTK 2.52.6, GNOME Web 46.5; `pretty` is ignored by Firefox 158). The prototype measurements behind these are in the project's shared files at `tech-ideas/PROTOTYPE-RESULTS.md`. `ArrayBuffer.transfer()` was measured (200 MB: about 150 ms with a copy, 0 ms transferred) but this page already transfers its buffers, so there is no call site to change.

## 23. Distances 3D: the flat Distances method in three dimensions (2026-10-18)

**What.** A new arrangement, `stress3d` ("Distances 3D (stress)"), in the Network view's arrangement list. It uses the 3D stress code that already started 3D force (pivot items far apart, the links and a few near neighbors, weights 1/hops^2, gradient steps that cool), without the force steps afterwards, and adds the multilevel start of the flat Distances (shrink the piece by about half, lay the smaller copy out, grow it back, polish with 5 gentle sweeps). The multilevel start is used only by this arrangement; 3D force draws exactly the same picture as before. Plain JavaScript only (no WebAssembly yet).

**Truth** (hop error, lower is truer; 24 to 60 breadth-first sources in the largest piece; Node, one run each, moderate maps):

| Items | Flat Distances | 3D force | Distances 3D |
|---|---|---|---|
| 1,000 | 0.137 | 0.095 | 0.091 |
| 3,000 | 0.152 | 0.104 | 0.110 |
| 10,000 | 0.171 | 0.118 | 0.117 |
| 30,000 | 0.177 | 0.127 | 0.117 |

**Build time** (ms, lower is better; Node 22, one run each): 1,000 items 126 (3D force) to 72 (Distances 3D); 3,000 276 to 124; 10,000 905 to 171; 30,000 3,002 to 926.

**Plain reading.** A third axis makes the picture truer than the flat one at every size (0.091 against 0.137 at 1,000 items; 0.117 against 0.177 at 30,000). Against 3D force it is about as true (slightly worse at 3,000 items, 0.110 against 0.104, and on dense "complex" maps 3D force's polish steps still win at 10,000 items, 0.147 against 0.162) and builds 1.8 to 5.3 times faster. On a dense "complex" map of 3,000 items it is about the same as the flat one (0.136 against 0.138): a dense map gains little from a third axis.

**Knobs** (`force3dTuning`): `ml` (1 on, 0 off), `mlMin` 700, `mlCoarse` 700, `mlEta` 0.2, `mlIters` 5, `mlJitter` 0.3, `mlPiv` 6, `mlNear` 6. Chosen from a sweep at 1,000, 3,000 and 10,000 items on moderate and complex maps. Test: `node test/distances3d.test.js` (6 checks).

## 24. More WebAssembly: Distances 3D, the Closeness rounds and the hash-grid push-apart (2026-10-18)

**What.** Three more pieces of the engine run in WebAssembly (`wasm/stress.c`, now 8,013 bytes), each with the JavaScript kept as the first answer and the fallback: the 3D sweeps (`sweeps3`; used by Distances 3D at every level of its multilevel start, and so by the 3D force start), the Closeness rounds (`closeness`), and the push-apart on a hash grid (`separate_sparse`; Circle, Radial and the other arrangements at about 30,000 items and more, where the picture is too spread out for a plain grid). **Every picture is the same as the JavaScript one to the last digit** (largest position difference 0 in all 64 comparisons below; `node test/stress-wasm.test.js`; one more check in each browser's page test).

**Method.** One page per browser; JavaScript and WebAssembly alternate (JavaScript, WebAssembly, JavaScript, ...) so a slow stretch of the machine hits both alike; one untimed pair first; then 5 timed pairs; the cell shows the medians (JavaScript → WebAssembly, milliseconds, lower is better) and the middle ratio (JavaScript time ÷ WebAssembly time; above 1 means WebAssembly is faster). Moderate maps, `node bench/wasm-alt.js <browser>`. An earlier run with a fresh page per version (not alternating) varied by up to 2× for the same JavaScript on this machine, so it was thrown away; these tables are the ones to trust, and even these swing by about ±30% between runs at small sizes.

| arrangement | items | ungoogled-chromium 155 | Firefox 158 | WebKitGTK 2.52.6 | GNOME Web 46.5 |
|---|---|---|---|---|---|
| Distances 3D | 1,000 | 90 → 56 ms (1.69×) | 125 → 139 ms (1×) | 66 → 107 ms (0.55×) | 71 → 107 ms (0.66×) |
| Distances 3D | 3,000 | 102 → 96 ms (1.27×) | 167 → 142 ms (1.11×) | 193 → 128 ms (1.51×) | 108 → 122 ms (1.05×) |
| Distances 3D | 10,000 | 149 → 141 ms (1.22×) | 245 → 427 ms (0.7×) | 946 → 750 ms (1.41×) | 556 → 523 ms (1.09×) |
| Distances 3D | 30,000 | 1,012 → 823 ms (1.08×) | 1,538 → 859 ms (1.79×) | 851 → 833 ms (1.04×) | 4,738 → 2,431 ms (1.46×) |
| Closeness | 1,000 | 389 → 244 ms (1.43×) | 266 → 195 ms (1.34×) | 144 → 217 ms (0.66×) | 459 → 488 ms (0.91×) |
| Closeness | 3,000 | 2,686 → 1,675 ms (1.8×) | 1,802 → 1,473 ms (1.26×) | 1,283 → 1,270 ms (0.71×) | 1,466 → 1,397 ms (0.83×) |
| Closeness | 10,000 | 3,095 → 1,538 ms (1.78×) | 2,427 → 2,206 ms (1.34×) | 1,295 → 1,984 ms (0.78×) | 1,752 → 2,505 ms (0.92×) |
| Closeness | 30,000 | 2,732 → 2,386 ms (1.23×) | 4,084 → 3,278 ms (1.45×) | 6,908 → 5,552 ms (1.29×) | 4,584 → 5,709 ms (1.08×) |
| Radial (hash-grid push-apart) | 1,000 | 37 → 32 ms (1.09×) | 13 → 22 ms (0.56×) | 33 → 38 ms (0.7×) | 26 → 48 ms (0.73×) |
| Radial (hash-grid push-apart) | 3,000 | 188 → 162 ms (0.69×) | 58 → 139 ms (0.71×) | 328 → 378 ms (1.11×) | 242 → 180 ms (1.73×) |
| Radial (hash-grid push-apart) | 10,000 | 892 → 413 ms (2.48×) | 895 → 681 ms (2.18×) | 599 → 492 ms (1.1×) | 706 → 477 ms (1.25×) |
| Radial (hash-grid push-apart) | 30,000 | 2,294 → 2,038 ms (1.13×) | 7,139 → 6,114 ms (0.99×) | 10,283 → 7,959 ms (1.33×) | 5,073 → 1,387 ms (2.73×) |
| Circle (hash-grid push-apart) | 1,000 | 108 → 78 ms (1.48×) | 56 → 65 ms (0.85×) | 36 → 9 ms (3×) | 15 → 18 ms (1.12×) |
| Circle (hash-grid push-apart) | 3,000 | 797 → 364 ms (1.31×) | 314 → 99 ms (2.78×) | 41 → 32 ms (1.19×) | 104 → 128 ms (1.03×) |
| Circle (hash-grid push-apart) | 10,000 | 314 → 418 ms (0.83×) | 779 → 555 ms (1.15×) | 182 → 121 ms (1.41×) | 381 → 315 ms (1.06×) |
| Circle (hash-grid push-apart) | 30,000 | 1,661 → 1,337 ms (1.76×) | 2,655 → 720 ms (2.76×) | 1,999 → 1,173 ms (1.7×) | 8,590 → 3,911 ms (2.2×) |

**Plain reading.**
- **Circle at 30,000 items: faster in all four browsers** (1.7 to 2.8×). Radial at 30,000: 2.7× in GNOME Web, 1.3× in WebKitGTK, 1.1× in Chromium, level in Firefox (0.99×). The rows for Radial and Circle below 10,000 items use the older plain-grid code that these changes did not touch, so their swings (0.56 to 3×) show the noise of the machine, not a result.
- **Distances 3D: faster at 30,000 items in all four** (1.04 to 1.79×), at 3,000 items in all four (1.05 to 1.51×) and at 10,000 in three of four (Firefox 0.7×); at 1,000 items it is mixed (0.55 to 1.69×). So WebAssembly is used from 3,000 items up (`stressWasm.min3d`).
- **Closeness: faster in Chromium and Firefox at every size (1.23 to 1.8×); in WebKitGTK and GNOME Web it is slower from 1,000 to 10,000 items (0.66 to 0.92×) and faster at 30,000 (1.29× and 1.08×).** So WebAssembly is used from 20,000 items up (`stressWasm.minClose`). Closeness at 1,000 to 10,000 items stays on JavaScript everywhere; a faster WebAssembly version for WebKit is open work (the loop reads random places in memory, which WebKit's JavaScript does well).
- Pair memory is unchanged for Closeness, Radial and Circle (no pair lists); Distances 3D uses 10 bytes a pair instead of 16 (30,000 items: 6.9 to 4.3 MB).

## 25. Flat Force from the Distances picture for 5,000 to 20,000 items (2026-10-19)

**What.** Chosen by the owner (2026-10-19). Pieces of 5,000 up to 20,000 items in the flat Force arrangement now start from the Distances picture (its multilevel start and WebAssembly do the heavy part) and take 40 gentle force rounds (`force2dTuning`: `stressMin` 5000, `stressMax` 20000, `polish` 40, `polishHi` 3, `polishLo` 0.05), instead of the spiral start and 120 to 240 rounds. Smaller pieces and bigger ones are exactly as before. The 3D force arrangement has started this way since section 20.

**Method.** One page per browser; the old start and the new start alternate (old, new, old, new, ...); one untimed pair first; then 3 timed pairs; each cell is old → new, medians in milliseconds (lower is better) and the middle ratio old time / new time (above 1 means the new start is faster). `node bench/force2d-alt.js <browser>`. The 30,000 rows were run with the new start forced on (`stressMax` raised) to decide where to stop.

| map | items | ungoogled-chromium 155 | Firefox 158 | WebKitGTK 2.52.6 | GNOME Web 46.5 |
|---|---|---|---|---|---|
| moderate | 5,000 | 1,589 → 820 ms (1.9×) | 1,853 → 789 ms (2.37×) | 1,704 → 863 ms (1.94×) | 1,794 → 859 ms (2.13×) |
| moderate | 10,000 | 2,091 → 1,439 ms (1.46×) | 2,543 → 1,527 ms (1.66×) | 2,734 → 1,556 ms (1.7×) | 2,717 → 1,204 ms (1.63×) |
| moderate | 30,000 | 7,092 → 5,654 ms (1.26×) | 5,235 → 6,193 ms (1.04×) | 4,961 → 3,611 ms (1.37×) | 6,103 → 4,577 ms (1.27×) |
| complex | 5,000 | 1,810 → 1,054 ms (1.87×) | 2,105 → 921 ms (2.24×) | 2,084 → 867 ms (2.28×) | 2,030 → 910 ms (2.23×) |
| complex | 10,000 | 2,316 → 1,756 ms (1.74×) | 2,286 → 1,239 ms (1.81×) | 2,559 → 1,537 ms (1.54×) | 2,262 → 1,231 ms (1.77×) |
| complex | 30,000 | 5,260 → 5,453 ms (0.88×) | 5,430 → 4,843 ms (1.12×) | 4,730 → 5,839 ms (0.8×) | 3,945 → 7,025 ms (0.52×) |

Hop error (lower is truer), old → new, the same in all four browsers to within 0.01: moderate 5,000 items 0.165 → 0.16; moderate 10,000 items 0.265 → 0.168; moderate 30,000 items 0.226 → 0.176; complex 5,000 items 0.185 → 0.162; complex 10,000 items 0.199 → 0.172; complex 30,000 items 0.18 → 0.176.

**Plain reading.** At 5,000 and 10,000 items the new start is faster in all four browsers (1.5 to 2.4×) and as true or truer (moderate maps at 10,000 items 0.265 → 0.168, a lot truer; 5,000 items 0.165 → 0.160). At 30,000 items it is truer on moderate maps (0.226 → 0.175) but the speed is mixed: 1.0 to 1.4× on moderate maps and 0.52 to 1.12× on dense ones (slower in three of four browsers), so pieces of 20,000 items and more keep the old start. A start in between (20,000 to 30,000) was not measured; the limit of 20,000 is a cautious guess.

## 26. Two-pair SIMD sweeps for the Distances layouts (2026-10-19)

**What.** The Distances sweep (wasm/stress.c, `sweepsv`) now works on two pairs of items at a time, one pair per lane of a 128-bit WebAssembly register, whenever two neighbors in the shuffled order share no item (otherwise that pair runs alone, as before). Doing two untouching pairs side by side gives exactly what doing them one after the other gives, so the picture is the same to the last digit (largest position difference 0 in every run). It was first limited to 20,000 items; section 29 measured 30,000 and 60,000 items and found 2 to 10% gains with no cell worse, so the limit is gone. The wasm file grows from 8,013 to 9,199 bytes (page file +1.6 KB).

**Method.** One page per browser; one-pair and two-pair sweeps alternate (one pair, two pair, one pair, ...); one untimed pair first, then 7 timed pairs; cells are one-pair → two-pair medians in milliseconds (lower is better) and the middle ratio (one-pair time / two-pair time, higher is better).

**Distances (hop pivots)**

| items | ungoogled-chromium 155 | Firefox 158 | WebKitGTK 2.52.6 | GNOME Web 46.5 |
|---|---|---|---|---|
| 1,000 moderate | 87 → 78 ms (1.11×) | 90 → 79 ms (1.14×) | 116 → 84 ms (1.41×) | 121 → 83 ms (1.42×) |
| 5,000 moderate | 223 → 211 ms (1.06×) | 268 → 220 ms (1.13×) | 291 → 227 ms (1.29×) | 292 → 223 ms (1.32×) |
| 15,000 moderate | 346 → 336 ms (1.02×) | 424 → 406 ms (1×) | 404 → 357 ms (1.15×) | 419 → 363 ms (1.16×) |

**Distances, best quality (every pair)**

| items | ungoogled-chromium 155 | Firefox 158 | WebKitGTK 2.52.6 | GNOME Web 46.5 |
|---|---|---|---|---|
| 1,000 moderate | 88 → 77 ms (1.14×) | 89 → 77 ms (1.14×) | 117 → 82 ms (1.44×) | 117 → 83 ms (1.39×) |
| 5,000 moderate | 550 → 555 ms (1.01×) | 544 → 546 ms (1.01×) | 380 → 392 ms (0.97×) | 380 → 379 ms (0.99×) |
| 15,000 moderate | 3,742 → 3,760 ms (0.99×) | 3,699 → 3,733 ms (0.99×) | 2,521 → 2,488 ms (1.01×) | 2,602 → 2,572 ms (1×) |

**Plain reading.** The Distances arrangement is 1.0 to 1.14× faster in Chromium and Firefox and 1.15 to 1.42× faster in WebKitGTK and GNOME Web (the two WebKit browsers gain the most); the gain fades toward 15,000 items, where memory access, not arithmetic, sets the speed. "Best quality" (every pair) is 1.14 to 1.44× faster at 1,000 items and unchanged (0.97 to 1.01×) from 5,000 items on. Nothing got slower by more than 3%, which is within the noise of these runs. Small gain, no risk: the pictures are identical.

## 27. Saved layouts: a map laid out before is put back from the browser's storage (2026-10-19)

**What.** Chosen by the owner's rules of 2026-10-19 (remember between visits). A Network map of 1,500 items or more in the Distances, Force, Radial or Closeness arrangements is fingerprinted (106 bits over the data, the build options, the tuning numbers and the text of the layout code, so a changed map, option or method never reuses an old picture). The first time, it is laid out as usual and the finished positions are saved in the browser's own storage (IndexedDB, up to 24 pictures and 120 MB, oldest unused go first). The next time, the same map is put straight back. Nothing leaves the computer. A switch and a "Forget saved pictures" button are on the Advanced tab. Storage that is blocked or full just means "not saved".

**Method.** `bench/saved-alt.js`: a real engine worker, the browser's real storage, a page opened from a file. For each size three fresh runs: a plain build (no storage), a first open (lays out and saves) and a second open (from storage), the plain and first-open runs swapped every other round; median of 5 rounds, after one warm-up. Milliseconds, lower is better.

| items | browser | plain build | first open (lays out + saves) | second open (from storage) | second open vs plain (higher is better) | same picture |
|---|---|---|---|---|---|---|
| 3,000 moderate | ungoogled-chromium 155 | 734 ms | 772 ms (+5%) | 55 ms | 13.8× | yes |
| 3,000 moderate | Firefox 158 | 903 ms | 936 ms (+4%) | 60 ms | 14.9× | yes |
| 3,000 moderate | WebKitGTK 2.52.6 | 686 ms | 725 ms (+6%) | 72 ms | 9.5× | yes |
| 3,000 moderate | GNOME Web 46.5 | 672 ms | 681 ms (+1%) | 64 ms | 10.4× | yes |
| 10,000 moderate | ungoogled-chromium 155 | 524 ms | 524 ms (+0%) | 157 ms | 3.1× | yes |
| 10,000 moderate | Firefox 158 | 602 ms | 612 ms (+2%) | 170 ms | 3.6× | yes |
| 10,000 moderate | WebKitGTK 2.52.6 | 491 ms | 547 ms (+11%) | 166 ms | 3× | yes |
| 10,000 moderate | GNOME Web 46.5 | 500 ms | 511 ms (+2%) | 161 ms | 3.1× | yes |
| 30,000 moderate | ungoogled-chromium 155 | 1,286 ms | 1,325 ms (+3%) | 480 ms | 2.6× | yes |
| 30,000 moderate | Firefox 158 | 1,336 ms | 1,314 ms (-2%) | 547 ms | 2.4× | yes |
| 30,000 moderate | WebKitGTK 2.52.6 | 1,176 ms | 1,211 ms (+3%) | 431 ms | 2.6× | yes |
| 30,000 moderate | GNOME Web 46.5 | 1,138 ms | 1,280 ms (+12%) | 488 ms | 2.4× | yes |

**Plain reading.** Opening the same map again is 2.4 to 14.9× faster in all four browsers, and the picture is exactly the same: 55 to 72 ms instead of 670 to 900 ms at 3,000 items, 157 to 170 ms instead of 490 to 600 ms at 10,000, 430 to 550 ms instead of 1,140 to 1,340 ms at 30,000. What is left on a second open is the start of a build (reading the data, sizes, links), not the layout. The first open pays for the fingerprint (about 16 ms for 10,000 items, about 40 ms for 30,000) and the save: it measured from 2% faster to 12% slower, about 3% slower in the middle of the twelve cells. The speed guard's 5% limit is crossed in four cells (ungoogled-chromium and WebKitGTK at 3,000 items, WebKitGTK at 10,000 items, GNOME Web at 30,000 items); the owner decides whether that cost is acceptable.

## 28. A fast-opening copy: deflate instead of LZMA (2026-10-19)

**What.** Chosen with the owner's rules of 2026-10-19 (first screen first, compile early; size limits suspended). `node tools/build.mjs --pack` now also writes `index.fast.html`: the page deflated and wrapped in the small loader from JS-modules `tools/single-file-tools/pack.py`, which the browser's own unpacker (`DecompressionStream`) opens in a few milliseconds. The LZMA copy (`index.packed.html`) stays as the smallest file. Compiling the WebAssembly early was looked at and dropped: no wasm compiles at start-up (the layout wasm is used in the worker when a big map is laid out) and a compile takes under 1 ms in all four browsers (section 27); keeping the compiled module is refused by all four browsers.

**Method.** `bench/startup.js`: each copy opened from a file in one browser, the three copies rotating, one untimed open of each first, then 9 timed opens; "ready" is when the app exists and two frames have been drawn. Milliseconds, lower is better; medians.

| copy | ungoogled-chromium 155 | Firefox 158 | WebKitGTK 2.52.6 | GNOME Web 46.5 |
|---|---|---|---|---|
| plain page | 69 ms | 99 ms | 61 ms | 95 ms |
| fast copy (deflate, new) | 70 ms | 116 ms | 66 ms | 81 ms |
| LZMA copy (smallest file) | 152 ms | 187 ms | 145 ms | 158 ms |

| size | bytes |
|---|---|
| plain page | 974,757 |
| fast copy (zlib level 9, raw bytes) | 365,772 (38%) |
| LZMA copy | 321,824 (33%) |

**Plain reading.** The fast copy opens in about the same time as the plain page (within 17 ms; in GNOME Web it measured 14 ms faster, which is noise) and 1.6 to 2.2 times faster than the LZMA copy (ungoogled-chromium 155 152 to 70 ms, Firefox 158 187 to 116 ms, WebKitGTK 2.52.6 145 to 66 ms, GNOME Web 46.5 158 to 81 ms). The price is 43,948 bytes (13.7%) more than the LZMA copy; it is still 62% smaller than the plain page. The full browser test passes on the fast copy in ungoogled-chromium (176 checks), and all four browsers open it with the app running. The loader writes raw bytes, so the copy works when opened from the computer; a page served by a host that sends charset=utf-8 needs the base64 form from `pack.py`.

## 29. Two-pair SIMD above 20,000 items; Distances 3D with SIMD tried and not kept (2026-10-19)

**What.** (1) The two-pair Distances sweep (section 26) no longer stops at 20,000 items. (2) A two-pair version of the Distances 3D sweep (`sweepsv3`: three coordinates per item, same pairing rule, positions identical to the last digit in every run) was written and measured. It gave no gain in the four browsers (0.95 to 1.08 times, middle about 1.0), so it is not built into the app; the source is kept in `bench/experiments/sweepsv3.c` so nobody has to write it again.

**Method.** `bench/simd-alt.js`, one page per browser, one-pair and two-pair alternating, one untimed pair first. Medians in milliseconds (lower is better); ratio = one-pair time / two-pair time (higher is better, above 1 means SIMD is faster). Whole-build times, because that is what a person waits for. 5 pairs for 3D, 3 pairs for the big flat maps. Browsers: ungoogled-chromium 155.0.8059.39-1 / Firefox 158.0 / WebKitGTK 2.52.6 / GNOME Web 46.5.

| Flat Distances, moderate map | Chromium | Firefox | WebKitGTK | GNOME Web |
|---|---|---|---|---|
| 30,000 items: one-pair ms → two-pair ms (ratio) | 755 → 715 (1.07) | 867 → 838 (1.04) | 910 → 807 (1.10) | 826 → 780 (1.06) |
| 60,000 items | 1751 → 1681 (1.04) | 1970 → 1880 (1.06) | 1928 → 1853 (1.04) | 1889 → 1910 (1.02) |

| Distances 3D, moderate map (ratio, higher is better) | Chromium | Firefox | WebKitGTK | GNOME Web |
|---|---|---|---|---|
| 3,000 items | 1.00 | 0.97 | 0.95 | 1.00 |
| 10,000 items | 1.03 | 0.96 | 0.98 | 0.96 |
| 30,000 items | 0.98 | 1.08 | 1.00 | 1.04 |

**Reading it.** Flat Distances: a small gain (2 to 10%) in all eight cells, none worse, so the 20,000-item limit is removed. Distances 3D: the numbers scatter around 1.0 (four cells are 3 to 5% slower, three are 3 to 8% faster), which is no gain, so plain WebAssembly stays for 3D. Not measured: other map shapes.

## 30. Moving an item by hand changes only what moved (2026-10-19)

**What.** Dragging an item on a flat Network map of 600 links or more (no lens, no hulls, no group names, every link a plain straight line) used to rebuild the whole picture on every mouse move. Now `S.moveNodes` (src/scene.js) moves the item's dot, choke dot, icon, label box and its links in the scene, and the renderer (src/render.js `patch`) rewrites only those dots and links in the graphics buffers (WebGL 2 `bufferSubData`, WebGPU `writeBuffer`; up to 4,000 changes, else a full upload). The pick grid and the packed link store are left stale during the drag and rebuilt once when the item is let go. Smaller maps, 3D, lenses and curved or arrowed links take the old path.

**Method.** `bench/move-alt.js`: a 10,000-item, 31,026-link Network map in a fresh page, 30 moves each way, in place and rebuild taking turns, main-thread milliseconds only (scene build, upload, draw call), medians; lower is better. Ratio = rebuild / in place (higher is better). `bench/longtasks.js` lists the long stretches (over 50 ms) of a run step by step.

| Main-thread ms per move, WebGL | Chromium 155 | Firefox 158 | WebKitGTK 2.52.6 | GNOME Web 46.5 |
|---|---|---|---|---|
| in place (new) | 3.4 | 3.0 | 18.0 | 19.0 |
| rebuild everything (before) | 50.8 | 106.0 | 50.0 | 59.0 |
| ratio (higher is better) | 14.9 | 35.3 | 2.8 | 3.1 |
| worst of 30, in place / before | 8 / 84 | 10 / 208 | 25 / 139 | 31 / 147 |

| Main-thread ms per move, Canvas 2D fallback | Chromium 155 | Firefox 158 | WebKitGTK 2.52.6 | GNOME Web 46.5 |
|---|---|---|---|---|
| in place / before | 248 / 271 | 155 / 217 | 36 / 70 | 39 / 70 |

**Pictures.** The browser test moves 1,500 items, then rebuilds from scratch and compares the two pictures in Canvas 2D, WebGL 2 and WebGPU: 100% identical (mean difference 0.000/255) in all four browsers. A Node test (`test/move-nodes.test.js`) compares dots, curves, labels, icons and node boxes exactly against a fresh build after 4 rounds of moves.

**Plain reading.** Chromium and Firefox now fit a move under the 8 ms line (3.4 and 3.0 ms, worst of 30 at 8 and 10 ms). In the two WebKit browsers 18 to 19 ms remains, which is the drawing itself, the same as before; a real-device run will show the true number. The Canvas 2D fallback is limited by painting 31,000 links, which no scene change fixes. In a 30-step drag in Chromium: 29 full rebuilds and 477 MB sent to the graphics card became 1 rebuild (on letting go) and 24 MB.

## 31. netflow-sankey 2.3.0 (WebAssembly order search) in the app (2026-10-19)

**What.** Vendored netflow-sankey 2.2.1 replaced by 2.3.0 (JS-modules PR 93, main 6b261e9): the order search runs as WebAssembly with plain JavaScript as the backup, and the module starts compiling it as soon as its script loads. The app's page security rules already allow it (`'wasm-unsafe-eval'`).

**Method.** `bench/sankey-alt.js`: the app's own Sankey build in a FRESH page per measurement, 2.2.1 and 2.3.0 taking turns, 5 pairs, medians in milliseconds (lower is better; ratio = old / new, higher is better). "First" = the first Sankey right after the module loads (WebAssembly compiled on the spot); "after a moment" = a Sankey after the page has been open long enough for the early compile to finish (the usual case: the user picks Sankey after the page is open). The layout digest of 2.2.1 and 2.3.0 matched in every run in all four browsers.

| Story size, ms old → new (ratio) | Chromium 155 | Firefox 158 | WebKitGTK 2.52.6 | GNOME Web 46.5 |
|---|---|---|---|---|
| 1,000 nodes, first | 72 → 72 (1.01) | 89 → 94 (0.95) | 75 → 74 (1.01) | 75 → 78 (0.96) |
| 1,000 nodes, after a moment | 60 → 53 (1.12) | 100 → 95 (1.05) | 54 → 55 (0.98) | 52 → 54 (0.96) |
| 3,000 nodes, first | 391 → 379 (1.03) | 433 → 433 (1.00) | 381 → 387 (0.98) | 386 → 386 (1.00) |
| 3,000 nodes, after a moment | 368 → 352 (1.05) | 411 → 405 (1.01) | 376 → 371 (1.01) | 364 → 368 (0.99) |

**Plain reading.** No gain you can measure in Netflow Map at 60 to 3,000 nodes: ratios scatter between 0.93 and 1.12 (at 60 and 300 nodes the layout takes 3 to 28 ms, so a 1 ms wobble is 5 to 30%). The pictures are identical. The module's own benchmark shows its gains on denser charts than the app builds. Full per-size rows: `bench/results/sankey-alt-<browser>.json`.

## 32. The LZMA copy opens sooner with the decoder that compiles early (2026-10-19)

**What.** `tools/lzma-pack/pack.py` from JS-modules main 6b261e9 (decoders 1.3.0, compile early) packs `index.packed.html`: the small WebAssembly decoder is compiled on another thread while the page starts. The previous packer used a plain JavaScript decoder.

**Method.** `bench/startup.js` with a seventh argument: the same page packed by the previous packer (JS-modules 6be2ada) and by the new one, opened from a file in turn with the plain and fast copies, 9 timed opens after one untimed, medians in milliseconds (lower is better). "App object exists" is when the app can be used; "ready" adds two drawn frames.

| LZMA copy, ready (ms) | Chromium 155 | Firefox 158 | WebKitGTK 2.52.6 | GNOME Web 46.5 |
|---|---|---|---|---|
| previous packer | 140 | 183 | 144 | 151 |
| compile-early packer | 106 | 155 | 111 | 122 |
| ratio (higher is better) | 1.32 | 1.18 | 1.30 | 1.24 |
| app object exists, previous → new | 133 → 101 | 154 → 128 | 113 → 88 | 120 → 96 |

Size: 327,339 → 331,896 bytes (+4,557, 1.4% larger; higher is worse). The plain page is 997,825 bytes (was 974,757), the fast copy 376,020 (was 365,772) and the LZMA copy 331,896 (was 321,824); most of the growth is item moves (section 30) and the 2.3.0 Sankey module.

## 33. The first move of an item no longer unpacks the whole link list (2026-10-22)

**What.** On a big map the links are stored packed after the page has sat idle (30-second-class memory saving, `curveStore` in src/scene.js). The in-place item move of section 30 read every link as an object to find which links touch the moved item, so the first move woke the whole packed list (31,026 link objects on a 10,000-item map) and left garbage for the collector. Now the scene answers three questions from the packed arrays without making objects (`S.curveEnds`: which two items each link joins; `S.curvesStraight`: is every link a plain straight line; `S.curveHasBox`), writes a moved link's line straight into the packed arrays (`S.setCurveLine`) and hands the renderer one reused view per changed link (`S.curveView`, no garbage). The list stays packed through the whole drag. Positions are 32-bit floats in the packed list, which is what the graphics card gets anyway.

**Method.** `bench/first-move.js`: the page of the build before (2026.10.18.2342, `git show origin/main:index.html`) against the page with this change, in a FRESH page each time, taking turns, 9 pages per version (15 for WebKitGTK, repeated because its timer counts whole milliseconds); a 10,000-item, 31,026-link Network map, links packed with `packNow()`, WebGL drawing, main-thread milliseconds of the move plus the picture work of the next two frames (graphics-card waits not counted). Medians; lower is better; ratio = old / new (higher is better).

| Main-thread ms | Chromium 155 | Firefox 158 | WebKitGTK 2.52.6 | GNOME Web 46.5 |
|---|---|---|---|---|
| first move, old page | 18.9 | 20.0 | 30.0 | 28.0 |
| first move, new page | 8.4 | 6.0 | 23.0 | 24.0 |
| ratio (higher is better) | 2.2 | 3.3 | 1.3 | 1.2 |
| second move, old page | 3.1 | 2.0 | 19.0 | 18.0 |
| second move, new page | 2.5 | 2.0 | 19.0 | 18.0 |

**Pictures.** `test/browser.test.js` now packs the links before the in-place move and checks the list is still packed afterwards, then compares with a full rebuild in Canvas 2D, WebGL 2 and WebGPU: 0.000/255 difference. `test/move-nodes.test.js` compares a packed, moved scene with a new scene packed the same way, exactly.

**Plain reading.** The hitch at the start of a drag is 1.2 to 3.3 times shorter; Chromium and Firefox are at 8.4 and 6.0 ms (Chromium is at the 8 ms line). Later moves are unchanged within noise (an early 22 ms against 18 ms WebKitGTK reading was timer noise: 19 against 19 with 15 pages). In the two WebKit browsers the rest of the first move is the drawing itself, as in section 30.

## 34. Dropping a moved item no longer builds the whole picture again (2026-10-22)

**What.** After you let go of an item moved by hand (sections 30 and 33), the page used to build the whole picture again once (`scheduleScene`) only to refresh three things that the quick move leaves as they were: the picture's outer box, the click grid and the link hover index. Now `S.settleMoves` (src/scene.js) works those three out again from the lists already in place, with the same formulas building the picture uses (`PICTURE_PAD` is shared), and `settleDrop` (src/app/32-interact.js) tells the minimap and the moving-dots list to look again. Nothing is rebuilt, the packed link list stays packed, and the scene keeps its identity. Pictures with parts the quick way does not know (group blobs, a ruler, tag chips) still build the whole picture again.

**Method.** `bench/drop.js`: the build of section 33 (PR 36) against this one, a FRESH page each time, taking turns, 9 pages per version (15 for the two WebKit browsers); a 10,000-item, 31,026-link Network map, links packed, WebGL drawing; one item moved in place, then the drop, then two animation frames; main-thread milliseconds of the drop call plus every animation-frame callback in those two frames (building, buffer work, drawing calls; the wait for the graphics card is not counted). Medians; lower is better; ratio = old / new (higher is better).

| Main-thread ms | Chromium 155 | Firefox 158 | WebKitGTK 2.52.6 | GNOME Web 46.5 |
|---|---|---|---|---|
| first drop, old | 106.8 | 203.0 | 84.0 | 84.0 |
| first drop, new | 2.3 | 3.0 | 19.0 | 20.0 |
| ratio (higher is better) | 46.4 | 67.7 | 4.4 | 4.2 |
| second drop, old | 61.1 | 171.0 | 67.0 | 68.0 |
| second drop, new | 1.0 | 2.0 | 18.0 | 18.0 |
| ratio (higher is better) | 61.1 | 85.5 | 3.7 | 3.8 |

**Pictures and data.** `test/move-nodes.test.js` moves items, settles, and compares the outer box, the click grid and 400 link-hover probes (333 hits) with a new picture built from the final places: exactly equal, in the packed case too (list still packed). `test/browser.test.js` settles the drop in place, checks the scene is the same object and the outer box equals the rebuilt one, and compares the picture with a full rebuild in Canvas 2D, WebGL 2 and WebGPU: 0.000/255 difference.

**Plain reading.** Letting go of an item on a big map used to freeze the page for about a tenth to a fifth of a second (Chromium 107 ms, Firefox 203 ms); now it takes 2 to 3 ms there. In the two WebKit browsers the remaining 18 to 20 ms is the drawing of the next frames, as for the move itself.

## 35. netflow-layers 1.3.0 to 1.3.1: faster Flow, Down, Spine and Lanes layouts (2026-10-22)

**What.** `vendor/netflow-layers.js` is now an exact copy of JS-modules netflow-layers 1.3.1 (main 143e758, PR 110): the inner work of the layered engine runs on flat number lists instead of many small lists. Same drawing, same options.

**Same layout.** `bench/layers-same.js` runs the app's own engine with each version over 576 layouts (Flow, Down, Spine and Lanes; simple, moderate and complex random maps of 40, 220 and 900 pages, two seeds; story order, tags, bundled links, better untangling, wide spread, folded chapters) and compares a digest of each whole layout: 0 differ (16 are too big for both and refused alike). `bench/layers-alt.js` compares the same digest on every timed run below: all yes.

**Method.** `bench/layers-alt.js`: the app's engine with the old module against the new one, a Flow layout, a FRESH page each time, taking turns, 7 pages per version, medians; main-thread milliseconds (lower is better; ratio = old / new, higher is better). "First" is the first layout of the page, "after a moment" one made when the page has been open a moment. The app refuses a Flow layout of the generator's 5,000-page moderate maps (about 3 links per page; over 90,000 stops), so 3,000 pages is the largest of those; the 20,000-page row is a plain tree.

| First layout, old to new (ms) | Chromium 155 | Firefox 158 | WebKitGTK 2.52.6 | GNOME Web 46.5 |
|---|---|---|---|---|
| 300 pages | 17 to 16 (1.04) | 25 to 18 (1.39) | 14 to 13 (1.08) | 18 to 13 (1.38) |
| 1,000 pages | 82 to 53 (1.56) | 88 to 58 (1.52) | 69 to 40 (1.73) | 71 to 42 (1.69) |
| 2,000 pages | 170 to 122 (1.40) | 192 to 125 (1.54) | 174 to 103 (1.69) | 162 to 93 (1.74) |
| 3,000 pages | 447 to 248 (1.80) | 551 to 294 (1.87) | 469 to 211 (2.22) | 454 to 215 (2.11) |
| 20,000 pages (tree) | 176 to 160 (1.10) | 207 to 190 (1.09) | 166 to 136 (1.22) | 150 to 136 (1.10) |

| Layout after a moment, old to new (ms) | Chromium 155 | Firefox 158 | WebKitGTK 2.52.6 | GNOME Web 46.5 |
|---|---|---|---|---|
| 300 pages | 10 to 8 (1.21) | 10 to 8 (1.25) | 9 to 6 (1.50) | 9 to 6 (1.50) |
| 1,000 pages | 55 to 29 (1.88) | 68 to 33 (2.06) | 50 to 28 (1.79) | 51 to 28 (1.82) |
| 2,000 pages | 143 to 84 (1.70) | 166 to 95 (1.75) | 147 to 75 (1.96) | 139 to 71 (1.96) |
| 3,000 pages | 396 to 205 (1.93) | 525 to 265 (1.98) | 450 to 180 (2.50) | 457 to 188 (2.43) |
| 20,000 pages (tree) | 113 to 109 (1.03) | 129 to 126 (1.02) | 109 to 95 (1.15) | 104 to 95 (1.09) |

Cells below the 5% speed guard (second layout in the same page, which the files also hold): Chromium 300 pages 12 to 15 ms (0.79) and Firefox 20,000-page tree 143 to 150 ms (0.95); both are millisecond-sized noise-level cells and the first-layout and after-a-moment cells for the same sizes are faster or level.

**Plain reading.** Layered views of a few thousand pages take 1.4 to 2.5 times less time on the main thread; a plain 20,000-page tree gains only 2 to 22%. Pictures are unchanged. The page file grows 0.19% (999,600 to 1,001,498 bytes).

## 36. Flow, Down, Spine and Lanes: the "too many stops" limit raised from 90,000 to 250,000 (2026-10-22)

**What.** The layered engine (`src/engine.js`) used to stop at the netflow-layers default of 90,000 stops (pages plus the stand-in stops on long links), so a Flow map of about 5,000 pages with 3 links per page (about 158,000 stops) was refused with the "too big" message and never drew. `MAX_STOPS = 250000` is now passed as `maxVertices` to the Flow, Down, Spine and Lanes calls (Sankey, arc and matrix are untouched). Layouts below the old limit are unchanged: the limit only decides what is refused.

**Method.** `bench/stops-limit.js`: the app's engine from main against the new one, a first Flow layout (fold off) in a FRESH page, taking turns, 3 pages per version, medians; main-thread milliseconds, lower is better. Generator "moderate" maps, about 3 links per page. "Refused" is the old plain message. `test/stops-limit.test.js` (Node, pass/fail only) checks 5,000 pages build, Spine and Down take 4,000, and 8,000 pages (about 367,000 stops) are still refused in plain words.

| First Flow layout (ms) | Chromium 155 | Firefox 158 | WebKitGTK 2.52.6 | GNOME Web 46.5 |
|---|---|---|---|---|
| 3,000 pages (just under the old limit), old to new | 241 to 237 | 497 to 503 | 237 to 247 | 236 to 225 |
| 5,000 pages (about 158,000 stops), old to new | refused to 576 | refused to 837 | refused to 561 | refused to 513 |
| 6,500 pages (about 255,000 stops), old to new | refused to 922 | refused to 1,584 | refused to 897 | refused to 837 |
| 8,000 pages (about 367,000 stops), old to new | refused to refused | refused to refused | refused to refused | refused to refused |

Heap after the layout (Chromium only, MB, lower is better): 72 at 5,000 pages, 180 at 6,500 pages; 250,000 stops was chosen so a phone has room.

**Plain reading.** Maps of 5,000 to about 6,500 pages (with folding off) now draw in 0.5 to 1.6 s where they never drew; maps below the old limit take the same time (3,000 pages: 0.96 to 1.04 of before, noise). Bigger maps are still refused, in plain words. The page file grows by a few bytes.

## 37. Hidden speed and error buttons (field-report 1.0.1) and memory-compression 2.0.3 to 2.3.4 (2026-10-22)

**What.** `vendor/field-report.js` is an exact copy of JS-modules field-report 1.0.1 (main 528c7b9). Five quick taps in the top-left corner of the page open **Save speed report** and **Save error log**: one small Markdown file each, nothing leaves the device. It starts first (`src/field-report-start.js`) so start-up errors are caught. The report lists start-up steps (first paint, first-screen, engine-ready), every layout time (`layout N items`), every scene build, the browser's own long tasks in Chromium, and the device. The module's frame loop is OFF (`frames: false`): Chromium idle page, 10 s, busy time 0.8 ms without the loop and 126 to 150 ms with it (about 1.3% of the main thread, and it keeps the page awake), so the verdict line says "not enough frames". The built page drops the module's header comment (it quotes a script tag); the vendored file stays an exact copy. `vendor/memory-compression.js` is now an exact copy of JS-modules memory-compression 2.3.4 (was 2.0.3).

**Start-up.** `bench/startup.js` (plain page from main against the new plain page; medians; milliseconds, lower is better), "ready" (two frames after the app object exists), old to new. Chromium 155 83 to 83 (15 opens), Firefox 158 99 to 102 (41 opens; DOMContentLoaded 70 to 73), WebKitGTK 2.52.6 68 to 68, GNOME Web 46.5 103 to 97 (15 opens). All inside the 5% speed guard (Firefox +3%). Sizes: plain page 1,001,501 to 1,038,320 bytes (+36,819, +3.7%: field-report +12.9 KB, memory-compression +23.9 KB), fast copy 377,627 to 392,548, LZMA copy 328,472 to 340,887 (size ceilings suspended).

**memory-compression 2.3.4 in the idle layout park.** `bench/park-alt.js` runs the park (`src/layout-park.js`) with each module version in a FRESH page, taking turns, 59,999 links (three 25,000-row chunks, fast mode), medians (Chromium 15 pages, others 9), milliseconds, lower is better, 2.0.3 to 2.3.4:

| Step | Chromium 155 | Firefox 158 | WebKitGTK 2.52.6 | GNOME Web 46.5 |
|---|---|---|---|---|
| Pack the list (park) | 90.7 to 85.5 | 99 to 101 | 81 to 78 | 77 to 77 |
| First read of one link | 2.5 to 2.6 | 5 to 4 | 6 to 5 | 5 to 6 |
| Read the whole list back (wake) | 23.3 to 29.9 (varies run to run, see below) | 58 to 59 | 32 to 34 | 37 to 33 |
| Packed bytes | 85,285 to 85,285 | same | same | same |

**A first reading was wrong.** A first run with 2.3.2 showed reading the list back 46% slower in Chromium (21.2 to 31.0 ms) and I held the bump back. The module's owners could not reproduce it. Six more Chromium runs of 25 pages per version with 2.0.3 against 2.3.4, the order swapped between runs, gave (2.0.3 / 2.3.4, ms) 22.0 / 32.1, 29.6 / 32.3, 33.7 / 21.1, 31.7 / 30.7, 31.6 / 32.7, 21.2 / 31.2: the whole run lands near 21 ms or near 32 ms whichever version is in it, and the medians of the six runs are level (2.0.3 30.6, 2.3.4 31.9). Reading the list back in Chromium therefore varies by the state of the machine from run to run, not by module version; the 2.3.2 runs (2.3.2 = 30.0, 21.3, 29.4, 25.6 against 2.0.3 = 33.1, 33.4, 33.7, 22.3) show the same two levels. Pack, first read and size are level; the bump is adopted because the project rule is to adopt the newest module and nothing measured against it.

**Not used.** The pager (new in 2.2.0): the park already opens one 25,000-row chunk for a single link in 2.5 to 6 ms, under the 8 ms rule. image-decode: the app only shows 96 px icons. pcodec-js: the app stores no number columns.

## 38. Canvas 2D: panning and zooming a slow-to-draw map slides the last picture (2026-10-22)

**What.** The Canvas 2D drawer (`createCanvas2D` in `src/render.js`) used to draw every shape again on each frame of a pan or zoom. When the last full draw was slow (over 16 ms of drawing calls) or the frames come slowly (a gap over 40 ms during motion), it now keeps the picture from the last full draw, slides and scales it to the new camera while the camera moves (a few milliseconds per frame, labels and icons are still drawn each frame), and draws the real picture again 140 ms after the camera stops. Maps that draw fast are drawn in full as before. WebGL 2 and WebGPU drawing are untouched.

**Pictures.** At rest the picture is exactly the full draw: `test/browser.test.js` pans and zooms a 1,500-item Network map through the slid frames and the settle draw, then compares with a full draw at the same camera: 0.000/255 in all four browsers; the slid picture mid-motion stays close (under 12% of pixels far off after a 36 px pan); a map that draws fast is still drawn in full. The redraw is asked for after the last moving frame.

**Method.** `bench/pan-alt.js`: the older page (main before this change) against the newer one, Canvas 2D forced, a scripted camera for 2 s per frame step (zoom in and out, or a back-and-forth pan), a FRESH page each time, taking turns, median of 5 pages per version; FPS (higher is better) and the 95th-percentile gap between frames in ms (lower is better), 1,500 or 5,000 items (`bigNetwork(N, 6, 7)`).

| Pan FPS, old to new | Chromium 155 | Firefox 158 | WebKitGTK 2.52.6 | GNOME Web 46.5 |
|---|---|---|---|---|
| Sankey, 1,500 items | 13.8 to 60.0 | 23.3 to 60.5 | 1.7 to 28.5 | 1.7 to 22.2 |
| Flow, 1,500 items | 22.1 to 60.0 | 33.2 to 60.5 | 4.3 to 28.7 | 4.2 to 21.8 |
| Network, 5,000 items | 12.9 to 60.0 | 19.0 to 60.5 | 2.8 to 28.3 | 2.8 to 22.1 |

| Zoom FPS, old to new | Chromium 155 | Firefox 158 | WebKitGTK 2.52.6 | GNOME Web 46.5 |
|---|---|---|---|---|
| Sankey, 1,500 items | 13.4 to 60.0 | 23.0 to 60.5 | 1.8 to 20.5 | 1.8 to 15.8 |
| Flow, 1,500 items | 21.5 to 60.0 | 29.5 to 60.5 | 4.4 to 23.8 | 4.3 to 19.0 |
| Network, 5,000 items | 12.1 to 60.0 | 17.5 to 60.2 | 2.6 to 21.2 | 2.6 to 16.9 |

95th-percentile gap while panning, old to new (ms, lower is better): Chromium Sankey 83 to 17, Flow 50 to 17, Network 83 to 17; Firefox 51 to 17, 33 to 17, 67 to 17; WebKitGTK 613 to 43, 268 to 39, 443 to 40; GNOME Web 606 to 53, 296 to 51, 442 to 51.

**Plain reading.** On the Canvas 2D fallback, panning and zooming big maps goes from 2 to 33 FPS to 16 to 60 FPS (the 60 in Chromium and Firefox is the screen's limit). While the camera moves the shapes are the last picture slid or scaled (edges that were off screen show the background until the camera stops, and a zoom is briefly soft); 140 ms after it stops the picture is the exact full draw. In these test browsers the app picks Canvas 2D by design because their WebGL runs on the processor; on a real graphics chip WebGL 2 draws instead and is unchanged. The page grows by about 900 bytes.


## 39. netflow-layers 1.3.1 to 1.4.0, a selection fix and the fuzz-kit round (2026-10-22)

**What.** `vendor/netflow-layers.js` is now an exact copy of JS-modules netflow-layers 1.4.0 (placement and crossing counting read typed arrays; the `lane` option is called once per stop and must be pure, and the app's `Math.max(0, laneOfBox[n.id])` is). `bench/layers-same.js`: 576 layouts compared with 1.3.1, 0 different (12 too big for both and refused alike). `vendor/field-report.js` is 1.0.2 (the reported version number was the only change). `NFM.setSel` now ignores items that are no longer in the data. A click on the old picture while new data was still being laid out named such an item and the details panel threw "cannot read label" (and kept showing the error text); found by fuzz-kit, the same in all four browsers, older than this build.

**First Flow layout, milliseconds, lower is better (median of 11 fresh pages per version, taking turns; ratio = old / new, higher is better).**

| Map | Chromium | Firefox | WebKitGTK | GNOME Web |
|---|---|---|---|---|
| 1,000 pages, first layout | 49 to 47 (1.04) | 59 to 52 (1.13) | 40 to 37 (1.08) | 44 to 38 (1.16) |
| 3,000 pages, first layout | 237 to 216 (1.10) | 272 to 244 (1.11) | 218 to 188 (1.16) | 213 to 194 (1.10) |
| 3,000 pages, layout after a moment | 196 to 184 (1.06) | 245 to 208 (1.18) | 185 to 151 (1.23) | 190 to 153 (1.24) |

Nothing is over 5% slower: the one cell below 1 (WebKitGTK, 1,000 pages, after a moment, 26 to 27 ms) is one whole millisecond of the browser's timer. Raw runs: `bench/results/layers-alt-131-vs-140-*.json`.

**Fuzz-kit round (new standard check).** `tools/fuzz-kit/` is an exact copy of JS-modules fuzz-kit 1.3.3 (runner, engine, `webkit-driver` beside it); `test/fuzz-kit/netflow-adapter.js` drives the page's own handle with random pans, wheel zooms, zoom calls, view, arrangement, color, line-width, curve and label changes, tab changes, item moves and drops, selections, built-in examples, big generated networks, and good, damaged and junk files. Invariants: the camera numbers are real, a built map has a scene, no `NaN`/`undefined`/`[object ...]` text, no error. `sh tools/fuzz-kit/run-netflow.sh [chrome|firefox|webkitgtk|epiphany|all] [seeds] [ops]` (default 1-12 seeds of 250 operations). First round: the select bug above (and some findings from the adapter's own bad ids, fixed in the adapter). Final build: 12 seeds x 250 operations in each of the four browsers, 0 findings (wall time 117 s Chromium, 125 s Firefox, 383 s WebKitGTK, 407 s GNOME Web).

**Parked.** A version that builds the new picture in pieces (a few milliseconds at a time, old picture on screen) was measured and left out: on a 10,000-item Network map in Chromium with WebGL 2 the longest hold after a setting change went from 51 to 56 ms to 32 to 38 ms and the new picture showed about 45 ms later, because the swap (picture to the graphics card) is untouched. Patch, test and bench: `/mnt/project-files/netflow-map/slicing-2026.10.23/`. Next lever: build links straight into reusable typed arrays (80 MB allocated per rebuild).

## 40. Straight links on the card as 9 numbers (2026-10-23)

`src/render.js`, WebGL 2 only: a network of nothing but plain straight links (no arrows, ribbons or hulls) is sent as two end points, a half width and a color (9 numbers, 36 bytes) a link; `GL_INST_VS` builds the quad with `gl_VertexID` (an instanced `TRIANGLE_STRIP` of 4). Before it was six corner records of 10 numbers (240 bytes). Same fragment shader, same blending, same draw order. Patching a moved item rewrites its 36 bytes. `bench/inst-links.js` takes turns between the two ways in one page per browser (5 rounds, medians, main-thread milliseconds, lower is better); `bench/results/inst-links-*.json`.

Put a new picture of N straight links on the card (building the arrays and sending them):

| Links | Chromium 155 | Firefox 158 | WebKitGTK 2.52.6 | GNOME Web 46.5 |
| ---: | ---: | ---: | ---: | ---: |
| 10,000 | 3.1 to 2.2 | 3.0 to 2.0 | 2.0 to 1.0 | 2.0 to 1.0 |
| 100,000 | 23.8 to 7.9 | 26 to 8 | 12 to 3 | 11 to 3 |
| 300,000 | 66.1 to 20.2 | 86 to 31 | 37 to 12 | 35 to 10 |

Data sent (all browsers): 2.3 / 22.9 / 68.7 MB to 0.3 / 3.4 / 10.3 MB. Pictures: mean difference 0.000 of 255 and 0.000% of pixels off in every browser and size.

Redrawing, in software drawing (the test machine has no card the browsers use here), milliseconds at 100,000 links: Chromium 54 to 1,091, Firefox 5 to 12, WebKitGTK 4 to 11, GNOME Web 4 to 12; the per-link set-up of instanced drawing is paid in the processor there. So the app decides on the card it runs on: the first time a network of 2,000+ straight links comes, `probe()` draws 50,000 short links both ways far out of view (so only the vertex work and the per-link set-up count) and keeps the 9-number way only when it is no more than 5% and 1 ms slower. Probe results on this machine (9 numbers vs six corners, ms): Chromium 518 to 530 vs 11 to 12, Firefox 6 vs 2 to 3, WebKitGTK 5 to 6 vs 2, GNOME Web 5 vs 2: the old way was kept in all four, so the shipped page draws exactly as before here. On real cards the lab (`/mnt/project-files/webgpu-research/`) measured the 9-number way faster: midrange phone (Android 17, Chrome) repeat draw at 300,000 links 28.7 to 20.1 ms, upload and first draw 77.7 to 25.9; laptop with integrated graphics (Firefox 159) 34 to 25 and 162 to 43; picture 100.00%. The tester (`bench/netflow-map-tester.html`, step "Straight links on the card") repeats this on any card and records what the app chose.

Not measured: a real card inside this app (only the lab's synthetic links on those two devices); the change is draw-side only, no layout result changes. Checks: 185 / 173 / 173 / 173 (one new: both ways give the same picture, also after a move, the probe's pick matches its numbers, and a map with arrows or curves keeps the old way).

On real cards, inside the app's own check (the tester's step "Straight links on the card", 2026-10-23; 9 numbers against six corners; lower is better): 300,000 links put on the card, midrange phone (Android 17, Chrome) 109.8 to 28.3 ms, laptop with integrated graphics (Firefox 159) 139 to 58 ms; redraw 20.1 to 19.6 and 15 to 15 ms; picture difference 0; the app's own pick test chose the 9 numbers on both (1.9 against 2.0 ms and 1 against 1 ms). Checked by hand by the owner before merge (PR 43).

## 41. The Force arrangement on the graphics card (2026-10-23)

`src/gpustress.js` `forceRounds`, `src/engine-client.js` `buildForce`, `src/engine.js` `FORCE_EXT`: for the Force arrangement of a piece of 20,000+ items (the piece the engine would run 60 rounds of repulsion, springs and gravity on), the card runs the same rounds (all-pairs repulsion in 256-item tiles, then springs, gravity and the move per item, positions staying on the card, one read back) and the engine goes on with its own clean-up. A short timing decides per device: after two rounds the run is stopped unless the whole run would take under 80% of the engine's own time (about 5 microseconds an item a round, measured at 100,000 and 200,000 items on both devices). Any problem or a slower card: the engine does it as before. The picture is saved under no key (never mixed with the processor's saved pictures).

Lab results (`bench/netflow-map-force-card.html`, 2026-10-23; whole layout, engine against card, higher "faster" is better; truth lower is truer, all within 0.001 of each other):

| Items | Links | Engine (s) | Laptop with integrated graphics, card (s) | faster | Midrange phone, card (s) | faster |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 10,000 | 29,773 | 3.3 / 2.4 | 1.2 | 2.8x | 0.9 | 2.6x |
| 100,000 | 299,709 | 26.2 / 24.2 | 5.6 | 4.7x | 42.4 | 0.6x |
| 200,000 | 599,521 | 57.5 / 66.0 | 29.4 | 2.0x | stopped at a projected 190.7 s | none |

(Engine times are the laptop run / the phone run.) Truth: 0.256, 0.210, 0.199 on both; crossings per sampled link and touching pairs after the engine's push-apart equal within noise. The 10,000 row is below the app's 20,000 floor; the app uses the card above it, where the phone's own timing refuses.

End to end in the app's client (`bench/force-app.js`, Chromium 155, 3,000 items, software card so only the path is checked): the card path is taken, mean link length 535.5 against 535.7, and a card judged too slow falls back to the engine's identical picture. Hook test: `test/force-card-hook.test.js`.


## 42. Less garbage when the picture is rebuilt (2026-10-23, step A and B of the packed-links plan)

`bench/scene-garbage.js` (Chromium 155 only, 100,000 items, one full picture rebuild, sampled allocation; sizes are not timings). Where the garbage comes from (MB; lower is better): link objects 59 (WebGL 2 and Canvas 2D), waking the packed link list 101 (Canvas 2D only), dot and name records 26, per-link saved copies 13 (WebGL 2). The collector took 168 of an 834 ms rebuild on WebGL 2 (20%: 139 ms in 22 small collections, 29 ms in one big one).

Step A, `style()` in `src/scene.js`: a link nobody has lit yet is its own base, so no saved copy is made: about 4 MB less (137 to 133 on WebGL 2, inside the run-to-run noise of the profile). Step B, `S.eachCurveView` in `src/scene.js` and the Canvas 2D draw in `src/render.js`: Canvas 2D reads a packed list one reused view at a time instead of waking all links into objects: one rebuild allocates 171 to 64 MB, and the page heap once idle is 408 to 305 MB (the list stays packed); reading 93,232 links through the view takes 3.8 ms against 19 ms to unpack them. Pictures: byte for byte equal (new browser check, packed and drawn again; 186 / 174 / 174 / 174 checks).

Draw time, taking turns inside one page with a pixel read after each draw (`bench/canvas-draw-ab.js`, 93,232 links, 9 turns, median; lower is better): Chromium 155 older way 780 ms, newer way 780 (ratio 1.00); Firefox 158 490 vs 476 (0.97); WebKitGTK 2.52.6 7,167 vs 7,142 (1.00); GNOME Web 46.5 7,173 vs 7,142 (1.00). So the packed read costs no draw time. Step C (links built straight into the packed arrays) was built and measured (Chromium, Canvas 2D, 100,000 items: one rebuild allocates 146 to 64 MB) and then set aside on the owner's choice; the patch is kept in the shared folder.

## 43. Waking a parked link list without holding the page (2026-10-23, memory-compression 2.3.4 to 2.4.9)

`bench/park-wake.js`, 100,000 items (311,667 links, 13 pieces of 25,000), median of 5, page held while the parked list comes back (ms, lower is better). Reading `L.edges` wakes everything at once: Chromium 155 222 to 125, Firefox 158 273 to 101, WebKitGTK 2.52.6 207 to 101, GNOME Web 46.5 190 to 125 (the vendored module 2.3.4 to 2.4.9). New `L.wakeAsync()` opens each piece a column at a time (`unpackAsync`): the longest hold is 34 / 14 / 19 / 23 ms, and the list is ready after 140 / 171 / 117 / 125 ms. The page asks for it when a control or key is touched (not when the picture is panned or zoomed) and before a queued picture rebuild; a read in the meantime still wakes everything at once, as before. Cost: the page is 30 KB larger (1,028 to 1,058 KB). Checks 186 / 174 / 174 / 174. Not done (the brief says it does not pay): packing saved layouts. To re-time when module briefs 2.4.10 and 2.4.11 land.

## 44. Basic drawing: straight links drawn as lines (2026-10-24)

`bench/canvas-lines-ab.js`, 30,000 items = 93,232 links, older page against newer page in fresh pages taking turns, median of 3 draws each, a pixel read after every draw (software canvas in the test container; ms, lower is better). Chromium 155: 757 to 629 ms (0.83). Firefox 158: 462 to 385 (0.83). WebKitGTK 2.52.6: 7,258 to 934 (0.13). A straight link used to be drawn as a curve that happens to be straight; it is now a line (`src/render.js`). The new picture against the old one (share of red, green and blue values): exact 81.4 / 81.4 / 75.6%, within 2 levels of 255 99.13 / 98.92 / 96.62%, within 5 levels 99.988 / 99.979 / 99.842% (largest difference 20 / 20 / 66 of 255; only antialiased edge pixels differ). The owner counts 5 levels as a match, so the 99.5% rule holds in all three. Also in this change: the pen (color, alpha, width) is set only when it changes; that part draws the exact same picture and its time ties (1.01 / 1.00 / 1.00).

Not found worth doing: grouping same-style links into shared strokes (36 to 239% slower in the software canvas and it changes the picture). A real graphics-card canvas was not timed. Checks 186 / 174 / 174.

## Reproduce

```
cd bench && npm install && node build-libs.mjs      # bundles the libraries into bench/dist/libs.js
node run.js chromium csv                             # or: firefox
node run.js chromium stress
node run.js chromium typed
node run.js chromium compare
node run.js chromium forceOurs                       # or: firefox; our Force arrangement alone (section 18)
node run.js chromium cold                       # or: firefox; first run against later runs (section 19)
node force-wasm.js chromium                           # or: firefox, webkit, epiphany, node; Force rounds in JavaScript against WebAssembly (section 21)
node stress-wasm.js chromium                          # or: firefox, webkit, epiphany, node; Distances layout: previous build, new JavaScript, WebAssembly (section 22; NFM_OLD_REV names the previous commit)
node wasm-alt.js chromium                             # or: firefox, webkit, epiphany; Distances 3D, Closeness, Circle and Radial, JavaScript against WebAssembly alternating (section 24)
node force2d-alt.js chromium                          # or: firefox, webkit, epiphany; flat Force, old start against the Distances start, alternating (section 25)
node simd-alt.js chromium                             # or: firefox, webkit, epiphany; one-pair against two-pair SIMD sweeps, alternating (section 26)
node saved-alt.js chromium                            # or: firefox, webkit, epiphany; plain build, first open and second open of saved layouts (section 27)
node storage-probe.js chromium                        # or: firefox, webkit, epiphany; does the browser's storage work from a file page, and compiled WebAssembly cannot be stored (section 27)
node startup.js chromium                              # or: firefox, webkit, epiphany; how long the plain, fast and LZMA copies take to open; add a seventh argument (an older packer's LZMA copy) to take turns with it (sections 28 and 32)
node move-alt.js chromium                             # or: firefox, webkit, epiphany; moving items in place against rebuilding (section 30)
node longtasks.js chromium                            # or: firefox, webkit, epiphany; the long stretches of a run, step by step (NFM_METHOD=webgl2, NFM_STEP)
node drop.js chromium                                 # or: firefox, webkit, epiphany; the drop after moving an item with the links packed, the build before against this one (section 34)
node layers-alt.js chromium                           # or: firefox, webkit, epiphany; the Flow layout with the older netflow-layers against the newer (section 35); layers-same.js is the all-views same-layout gate (Node)
node stops-limit.js chromium                           # or: firefox, webkit, epiphany; the stops limit raised, old engine from main against the new (section 36)
node park-alt.js chromium                              # or: firefox, webkit, epiphany; the idle layout park with the older memory-compression against the newer (section 37)
node pan-alt.js chromium                               # or: firefox, webkit, epiphany; panning and zooming with Canvas 2D, older page against newer (section 38)
node first-move.js chromium                           # or: firefox, webkit, epiphany; the first move of an item with the links packed, the build before against this one (section 33)
node sankey-alt.js chromium                           # or: firefox, webkit, epiphany; netflow-sankey 2.2.1 against 2.3.0 in the app's own build (section 31)
node closeness-pow.js chromium; node sim-sparse.js chromium   # the two plain-JavaScript speed-ups, against the previous commit (section 21)
node ../test/force3d.test.js                      # 3D force: hop error at 3,000 items, not flat, robust cases (section 20)
node ../test/distances3d.test.js                  # Distances 3D: truth, same every run, multilevel switch, odd inputs (section 23)
TESTER_ONLY=3d TESTER_PLAN3D=1000,3000 node tester/run-local.js chromium   # the tester's 3D step alone (section 20)
node tools/build-tester.mjs                       # the laptop tester page (section 19)
node run.js chromium drawsRun; node run.js chromium drawsVar; node run.js chromium csvVar; node run.js chromium csvCold   # or: firefox; normal draws and CSV looked at again (section 18)
node run.js chromium closeness                      # or: firefox; the closeness arrangement in the browser (section 17)
node run.js chromium stressBest                    # or: firefox; the best-quality arrangement next to the normal one (section 16)
NFM_CHROME_ARGS='--enable-unsafe-webgpu --enable-features=Vulkan --use-vulkan=swiftshader --use-gl=angle --use-angle=swiftshader --ignore-gpu-blocklist' node run.js chromium gpumaj   # does a WebGPU majorization agree with the CPU one? (section 16)
node run.js chromium stressOurs                      # or: firefox; only our Stress, quick re-run after a change
node run.js chromium refresh                         # or: firefox; the parts of the compare suite that changed (draws, GIF)
node run.js chromium pack                            # or: firefox; sending a layout from the worker, packed or not
node merge.js /tmp/new.jsonl results/chromium-stress.jsonl   # fold a partial re-run (new, then old) into the results file
ARR=closeness ONLY=ours node overlap.js moderate 5000   # also ARR=stressBest; the neighborhood score and truth of one of our arrangements
node overlap.js moderate 1000 3000 5000 10000        # Node only: items left touching and neighborhood preservation, ours against d3-force and ForceAtlas2 (ARR=force for our Force arrangement)
sh gif-profile.sh firefox /tmp/out.jsonl             # GIF phase timings (instruments src/gif.js for the run, then restores it; section 14)
node ../test/archive.test.js && node --expose-gc ../test/fuzz.test.js 70   # zips, Excel, graph files; random and hostile input
node ../test/fuzz.browser.js chromium 30            # or: firefox
node wasm/exp.js                                    # WebAssembly experiment (sweep.c is built with clang, see its header)
node inst-links.js chromium                          # straight links as 9 numbers against six corners (also firefox, webkit, epiphany; section 40)
node run.js chromium limits                          # about 15 minutes per browser
node report.js                                       # all tables, from bench/results/*.jsonl
node stress-tune.js moderate 10000 before '{}'       # Node-only side by side of stress settings
```

Set `NFM_CHROME` and `NFM_FIREFOX` to the browser programs, and `NFM_PLAYWRIGHT` / `NFM_PUPPETEER` to the driver libraries when they are not in the default places (see `bench/driver.js`).

## 45. Parking and waking links with memory-compression 2.6.2 (2026-10-24)

`node bench/park-wake.js chromium|firefox|webkit 100000|30000 page.html 5`, the page built with 2.4.9 against the page built with 2.6.2 (only `vendor/memory-compression.js` differs), alternating, two loads each. Pack = `L.parkNow()`. Lower is better. The all-at-once wake of the same page swings between about 75 and 125 ms from run to run in Chromium (both versions), so the 40-round checks at 30,000 items (Chromium and Firefox) are the verdict for it.

| Browser, items | Pack 2.4.9 (ms) | Pack 2.6.2 (ms) | Wake all at once 2.4.9 / 2.6.2 (ms) |
|---|---|---|---|
| Chromium 155, 100,000 | 200-210 | 147-152 | 125-127 / 70-121 (no direction) |
| Firefox 158, 100,000 | 286-306 | 257-275 | 99-103 / 101-103 |
| WebKitGTK 2.52.6, 100,000 | 203-214 | 178-193 | 83-136 / 105-112 (no direction) |
| Chromium, 30,000 (40 rounds) | 56-57 | 43 | 32-34 / 32-33; sliced wall 33-35 / 34-35 |
| Firefox, 30,000 (40 rounds) | 67-70 | 58-60 | 36-38 / 35 |
| WebKitGTK, 30,000 | 57-62 | 54-58 | 21-25 / 22-27 |

Packing is 5 to 28% faster; waking ties. Earlier 2.5.1 and 2.6.0 runs seemed to show a slower all-at-once wake in Chromium; JS-modules could not reproduce it and the alternating runs above scatter both ways. The page is 17.7 KB larger (1,083,834 to 1,101,574 bytes).

## 46. Layered layouts with netflow-layers 1.5.0 (2026-10-24, was 1.4.0)

**What.** `vendor/netflow-layers.js` is now an exact copy of JS-modules netflow-layers 1.5.0 (row-order search and row placement in WebAssembly for maps of 100 stops or more; the page rule already has `'wasm-unsafe-eval'`, nothing is fetched). `node bench/layers-same.js /tmp/nl-140.js vendor/netflow-layers.js`: 576 layouts compared, 0 different. `node bench/layers-alt.js <browser> 5 old new 300,2000,5000 flow moderate`: fresh page each time, versions taking turns.

**First Flow layout, milliseconds, lower is better (median of 5; ratio = old / new, higher is better).**

| Map | Chromium 155 | Firefox 158 | WebKitGTK 2.52.6 |
|---|---|---|---|
| 300 nodes | 13 to 8 (1.65) | 20 to 18 (1.11) | 10 to 10 (1.00) |
| 1,999 nodes | 91 to 63 (1.45) | 123 to 88 (1.40) | 78 to 63 (1.24) |
| 4,999 nodes | 510 to 297 (1.72) | 567 to 328 (1.73) | 390 to 275 (1.42) |

A second layout in the same page and a layout after a moment gain 1.1 to 1.9 times in every cell; nothing is slower. Results are in `bench/results/layers-alt-moderate-*.json`.

## 47. Link looks kept between pictures of a flat map (2026.10.24.1303)

**What.** `networkScene` keeps each link's look in `o.lookPlan` (owned by `src/app/30-map.js`) when the rebuild only follows an item move, a drop or a label-size change. Every other kind of rebuild drops the plan. A plan for another map, theme, palette, color mode or link count starts over. `node test/look-plan.test.js` checks the links equal a fresh build, the second picture does no look work and each of those cases starts over.

**Picture rebuild, 30,000 items, milliseconds (median of 5 to 11 fresh pages per version, lower is better; ratio = old / new).**

| Browser | Rebuild | Longest hold |
|---|---|---|
| Chromium 155 | 111 to 90 (1.23) | 122 to 123 (0.99) |
| Firefox 158 | 127 to 105 (1.21) | 204 to 209 (0.98) |
| WebKitGTK 2.52.6 | 146 to 132 (1.11) | 360 to 285 (1.26) |

Page tests 186 / 174 / 174 (same as before), fuzz 12 seeds, 3000 ops, no findings, in all three browsers. `bench/rebuild-ab.js` calls the rebuild a drop makes; a plain rebuild with no flag does not use the cache.

## 48. Links built straight into flat lists (2026.10.24.1412)

**What.** A flat map of 2,000 or more straight, arrowless links without link rules is built into typed lists (`flatWriter` in `src/scene.js`, taken over by `curveStore` as the packed store) instead of one object per link. Styling, the link hover index and the graphics-card picture lists read the lists directly; anything that reads `S.curves` still gets the objects (the list is unpacked then). `node test/flat-links.test.js` checks the links equal the object build and that styling leaves the lists packed. `bench/picture-same.js` compares the drawn pictures.

**Picture rebuild after an item move, 30,000 items, milliseconds (median of 7 fresh pages per version, lower is better; ratio = old / new).**

| Browser | Rebuild | Longest hold |
|---|---|---|
| Chromium 155 | 113 to 91 (1.24) | 152 to 120 (1.27) |
| Firefox 158 | 330 to 234 (1.41) | 387 to 306 (1.26) |
| WebKitGTK 2.52.6 | 192 to 161 (1.19) | 416 to 342 (1.22) |

Pictures: 100.000% of pixels the same in all three browsers (3,000 items). Page tests 186 / 174 / 174, fuzz 12 seeds, 3000 ops, no findings, in all three. A first WebKitGTK run was 30% slower because the graphics-card path still unpacked the links; fixed before merging.


## 49. A 100,000-item first layout: where the time goes, and two same-picture cuts (2026.10.30)

**Where the time went** (lab, Chromium, moderate network of 100,000 items, Stress, engine on the page, about 7.2 s): the push-apart 2.9 s (37%; the first call of 30 passes is 1.5 s), the Stress layout 2.0 s, the rest (prepare, mapGraph, sizes, importance, fitScale, packing) about 2.5 s. Inside the Stress layout, the smallest copy the multilevel start makes (1,816 items with about 186 links each after six halvings) used every pair and spent 1.0 s on 1,816 breadth-first walks, more than the other six levels together.

**What changed** (pictures identical to the last digit: the positions of all 100,000 items hash the same before and after, in every run and browser):
1. `wasm/stress.c` `bfs`: once a level holds more than a twentieth of the items, each item not yet reached looks for one link into that level and stops at the first (bottom-up, Beamer, Asanovic and Patterson 2012). The hop counts are the same, so the pairs are the same. The 1,816-item step: 1.0 s to 0.25 s.
2. `src/engine.js` `networkLayout`: each item's size is worked out once into a list; the push-apart and the packing asked for it about a million times through a text-keyed lookup (about 0.3 s).
3. `wasm/stress.c` `separate`: pairs clearly apart skip the square root (the exact test still decides every close call). No measurable gain, kept because it is free.

**Before and after** (ms, shorter is better; each run in a fresh page, old and new taken in turn):

| Browser | Items | Before | After | Change |
|---|---:|---:|---:|---:|
| Chromium (Playwright build) | 100,000 | 7,232 (7,040 to 7,384) | 5,535 (5,328 to 5,701) | 23% faster |
| Chromium (Playwright build) | 30,000 | 1,551 | 1,287 | 17% faster |
| Chromium (Playwright build) | 10,000 | 752 | 653 | 13% faster |
| Firefox 158 | 100,000 | 10,519 / 10,072 | 9,024 / 9,168 | 13% faster |
| Firefox 158 | 10,000 | 906 | 858 | 5% faster |
| WebKitGTK 2.52.6 | 30,000 | 1,895 / 1,731 | 1,280 / 1,240 | 32% faster |

**Left:** the push-apart is now the largest step (about half the time at 100,000 items). Faster versions of it change the picture slightly (fewer passes, or a different order of pushes), so they need a look first.

## 50. Fewer push-apart passes above 50,000 items (2026.10.30, chosen by Jawad)

Over 50,000 items the first push-apart call now runs 10 passes instead of 30 (`STRESS.sepPassesBig`, `STRESS.sepBigMin`); the grow rounds and the settle step that guarantees no two items touch are unchanged. Moderate network, lab Chromium, two runs each:

| Items | 30 passes | 10 passes | Truth (lower is truer) | Page area | Touching |
|---:|---:|---:|---:|---:|---:|
| 100,000 | 5,322 / 5,554 ms | 3,900 / 4,202 ms | 0.1785 / 0.1784 | same | 0 / 0 |

Below 50,000 items the fewer passes sometimes left a page about 20% larger (10,000 items: 92 to 111 million square units) for about 5% less time, so smaller maps keep 30 passes and their pictures are unchanged. Pictures compared side by side before the choice: /mnt/project-files/netflow-map/push-apart-2026.10.30/push-apart-compare.html.

## 51. Stretch first above 80,000 items (2026.10.30, chosen by Jawad)

When a piece has 80,000 or more items and starts with more than 2 touching pairs per item, the one stretch that used to come after the first 10 push-apart passes now comes before them (`STRESS.jumpFirstMin`). Moderate network, seed 11, 100,000 items, lab, three runs each in rotating order (lower is better):

| Browser | Before | Stretch first | All four ideas stacked |
|---|---:|---:|---:|
| Chromium 155 | 6,056 / 5,116 / 4,495 ms | 4,822 / 5,012 / 5,147 ms | 5,124 / 5,662 / 4,703 ms |
| Firefox 158 | 5,145 / 4,581 / 4,440 ms | 4,162 / 3,860 / 4,058 ms | 3,713 / 4,109 / 4,230 ms |
| WebKitGTK 2.52.6 | 3,818 / 4,333 / 4,170 ms | 3,699 / 4,448 / 3,826 ms | 3,508 / 3,507 / 3,491 ms |

Same page size (48,069 x 48,813), nothing touching. Middle half of the map: average gap to the nearest item 56.6 to 46.3 units, gap spread 0.41 to 0.30 (more even). Push-apart alone in Node: about 1.0 s to 0.70 s. "All four stacked" adds number keys in `mapGraph`, link objects with every field up front, and a grid-order walk in the wasm `separate`; it is not shipped, and the grid-order walk changes the picture. At 60,000 items the full stretch grew the page about 9%, so smaller maps keep the old order. Comparison pages: /mnt/project-files/netflow-map/stretch-first-2026.10.31/.

## 52. Three small ideas, alone and stacked (2026.10.30, chosen by Jawad)

On top of stretch first: number keys when merging links (`mapGraph`), link objects made with every field up front, and a grid-order walk in the push-apart (`separate`, wasm and JavaScript). Moderate network, seed 11, 100,000 items, lab, rotating order, medians (lower is better):

| Browser | Stretch first | + same-picture pair | + pair and grid order (shipped) |
|---|---:|---:|---:|
| Chromium 155 (5 runs) | 3,769 ms | 3,970 ms | 3,788 ms |
| Firefox 158 (5 runs) | 3,714 ms | 3,632 ms | 3,485 ms |
| WebKitGTK 2.52.6 (6 runs) | 3,720 ms | 3,650 ms | 3,553 ms |

In Node each idea alone was inside a 20 to 40% run-to-run swing. The pair gives the same positions to the last digit; the grid-order walk moves items a few pixels on every flat map. Pictures compared side by side before the choice: /mnt/project-files/netflow-map/stack-2026.10.31/stack-compare.html.

## 53. Map file places as whole numbers (2026.10.30, chosen by Jawad)

A 30,000-item test map with its finished picture, LFC-pack as vendored. Lab, one page per browser, an untimed first round, then the median of 5 (save = pack; open = unpack plus turning the places back into numbers):

| Version | File | Chromium save / open | Firefox save / open | WebKitGTK save / open |
|---|---:|---:|---:|---:|
| Before (base64 of 8-byte numbers) | 1,172,668 B | 253 / 54 ms | 243 / 58 ms | 180 / 32 ms |
| Plain numbers | 1,146,930 B (-2%) | 317 / 54 | 329 / 47 | 248 / 33 |
| base64 of 4-byte numbers | 929,296 B (-21%) | 311 / 47 | 264 / 48 | 177 / 29 |
| x and y lists of whole numbers (shipped) | 810,965 B (-31%) | 245 / 57 | 258 / 40 | 188 / 29 |
| No picture at all (floor) | 696,882 B | 254 / 45 | 248 / 34 | 182 / 24 |

The picture's part of the file goes from 476 KB to 114 KB (-76%). Full notes: /mnt/project-files/netflow-map/retest-2026.10.31/RETEST-DROPPED-IDEAS.md.

## 54. Hidden costs around the build: look-only changes, the picture key, the hand-off, garbage (2026.10.31)

Costs nobody was timing, because the build's own clock does not see them. Map: `bench/gen.js` moderate, 100,000 items, 299,795 links, Network view, Distances. Page timing goes through the app's own engine client (helper thread, picture key, browser store emptied first, packing, hand-off to the page), lab, 4 rounds alternating old and new pages, medians. Every row gives exactly the same picture as before in each browser (hash of every item's center).

| 100,000 items, page | Chromium 155 | Firefox 158 | WebKitGTK 2.52.6 |
|---|---:|---:|---:|
| First layout, before / after | 7.2 / 7.1 s | 6.6 / 6.6 s | 5.6 / 5.7 s |
| Item color changed | 7.5 / 4.2 s | 8.5 / 5.4 s | 7.7 / 4.2 s |
| Link color changed | 6.3 / 2.5 s | 7.2 / 2.8 s | 6.9 / 2.2 s |
| Link width changed | 6.1 / 2.6 s | 7.0 / 3.0 s | 7.4 / 2.3 s |

Shorter time is better. Item color here is "groups found", which also works out the groups.

What was found and fixed:

- **Look-only changes laid the whole map out again.** The picture key counted every option, so a new color made a new key: no saved picture matched, the layout ran again from scratch and a second copy of the same places was saved. The key now leaves out options that never move an item in the Network view (colors, link widths, labels, the other views' settings; how numbers combine only counts when item size is set). A test builds 12 sets of such options and checks the key and every place stay the same. The last finished picture is also kept in memory for the open map, so this works with the browser store switched off.
- **The key re-read all the data on every build.** Hashing the whole graph as text took 330 ms at 100,000 items (Node), for every build. The data's part of the hash is now kept on the helper's copy of the graph, which never changes, so later keys hash only the options.
- **Packing the result for the page read every item once per field.** One pass over the items now fills every column: 2.6x faster where code may be built from text, about 1.8x in the app (the helper runs under the page's policy, which refuses building code from text in all three browsers, so the shipped version does not). Same bytes as before.
- **Garbage.** Sampled allocation during one build (Node 22, 100,000 items): 941 MB before, 742 MB after (-21%), from five same-picture changes tested alone, then together:

| Change | Garbage made |
|---|---:|
| Before | 941 MB |
| Map items made with every field up front, one shape | 805 MB (-14%) |
| Link details without a function, list and copy per link | 881 MB (-6%) |
| Two-number hypot written out (V8's own steps; used only where it matches this browser's Math.hypot exactly) | 900 MB (-4%) |
| Links made with every later field up front | 914 MB (-3%) |
| Pieces walked with typed arrays instead of a Map and Set per piece | 918 MB (-2%) |
| All five | 742 MB (-21%) |

Each alone and stacked keeps the exact picture. Full collections and their pauses vary run to run by more than these changes move them (4 to 6 per build), and first-layout time stays within noise in all three browsers. WebAssembly memory was checked too: the engine makes a new instance for each step, so its memory goes back after the step; the only one kept is the layered drawing module's (6.8 MB after a 50,000-item map).

## 55. Separate pieces on helper threads (2026.10.31)

Maps made of separate pieces, each piece `bench/gen.js` moderate with its own seed, Network view, Distances. Page timing through the app's own engine client (browser store emptied first), lab, 4 cores, 3 rounds alternating the page before (2026.10.31.0846) and after, medians. Every case gives exactly the same picture in both pages (hash of every item's center).

| Map | Chromium 155 | Firefox 158 | WebKitGTK 2.52.6 |
|---|---:|---:|---:|
| 10 pieces of 3,000 items | 12.2 / 5.6 s | 11.7 / 6.0 s | 12.2 / 6.3 s |
| 30 pieces of 1,000 | 5.0 / 2.5 s | 5.4 / 2.7 s | 5.2 / 3.1 s |
| 100 pieces of 300 | 2.9 / 1.6 s | 2.9 / 2.1 s | 4.1 / 2.9 s |
| 3 pieces of 3,000 | 3.3 / 1.4 s | 3.8 / 1.5 s | 4.0 / 1.7 s |
| 4 pieces of 1,000 | 0.62 / 0.31 s | 0.62 / 0.27 s | 0.72 / 0.37 s |
| 3 pieces of 800 | 0.32 / 0.18 s | 0.39 / 0.20 s | 0.31 / 0.20 s |
| 20 pieces of 300 | 0.49 / 0.33 s | 0.59 / 0.34 s | 0.66 / 0.46 s |
| 2 pieces of 600 (stays in the worker) | 0.16 / 0.16 s | 0.16 / 0.14 s | 0.20 / 0.23 s (noise, see below) |
| 1 piece of 30,000 (stays in the worker) | 1.9 / 1.7 s | 2.1 / 1.9 s | 1.8 / 1.8 s |

Before / after; shorter time is better.

Tiny maps in WebKitGTK. Five maps with no helpers (2 pieces of 601 to 604 items, 3 of 500), 6 rounds each: median 199 ms before, 225 ms after (+13%). The same run with two copies of the same page gave 222 and 199 ms (10% apart), and with the new page's helpers switched off 222 ms, so this is within what this harness can tell apart at 0.2 s. In Node the plain build of these maps is the same before and after (25 runs each).

When helpers start. A piece qualifies when Distances lays it out in one go (150 to 4,000 items, one random draw), and the map qualifies when at least 2 pieces do and the sum of their item counts squared is at least 1,000,000. Tested with the same maps from 1 million and 6 million (lab, 3 rounds, medians, before / after):

| Map | Chromium | Firefox |
|---|---:|---:|
| 4 pieces of 1,000 (4 million) | 0.79 / 0.59 s | 0.67 / 0.50 s |
| 6 pieces of 600 (2.2 million) | 0.54 / 0.34 s | 0.48 / 0.32 s |
| 3 pieces of 800 (1.9 million) | 0.30 / 0.21 s | 0.32 / 0.18 s |
| 2 pieces of 1,000 (2 million) | 0.39 / 0.28 s | 0.30 / 0.21 s |
| 20 pieces of 300 (1.8 million) | 0.49 / 0.52 s | 0.48 / 0.48 s |

Nothing was slower beyond noise, so helpers start at 1 million. Below it (2 pieces of 600 items is 0.7 million) starting a helper costs about what it saves.

Why the page makes the helpers. The first version had the engine worker start them from its own text. In WebKitGTK a worker started inside a worker reports an error with no message and never runs, with or without the page policy (tested on a bare page), so every piece fell back to the worker and 10 pieces of 3,000 items took 10.6 to 11.8 s there. A worker started by the page and joined to the engine worker with a message port runs in all three browsers.

## 56. Page memory with big data: undo steps, the opened table, repeated text (2026.10.31)

Chromium 155, the real app in an 800 by 600 window, data opened through the app's own reader (`NFM.ingest`), main-page heap after three full garbage collections, 2 rounds (the numbers repeat to 0.3 MB). Changes are made the way the app makes them: rename one item, set a group on 2,000 items, set an ending on 300 scattered items, remove a link, remove an item, change the start. Undo is then pressed 25 times and every graph checked: 25 of 25 match in every run.

| Main-page heap after | Simple table, 16 MB (188,000 items, 565,000 links) | Rich table, 16 MB (30,000 items) |
|---|---:|---:|
| Opening it | 149.5 / 102.3 MB | 70.8 / 39.6 MB |
| 12 changes | 184.5 / 102.0 MB | 79.0 / 40.8 MB |
| A second table of the same size | 252.3 / 165.4 MB | 107.4 / 56.8 MB |
| 12 more changes | 287.2 / 165.6 MB (-42%) | 115.5 / 57.7 MB (-50%) |

Before / after; lower is better. Opening took 5.6 / 5.6 s (simple) and 2.3 / 2.1 s (rich), 12 changes 24 / 23 s and 12.5 / 10 s, the slowest undo 2.6 / 2.7 s and 1.4 / 1.3 s (medians of 2; each change and undo is mostly the app working out the map's columns again, the same before and after).

Node, 100,000 items, policies alone and stacked (retained heap, every undo checked): a second file 200 MB today, 151 MB without the kept cells, 78 MB when the old graph is also packed; 25 one-item renames 201 to 128 MB with difference steps alone, 79 MB stacked with lean cells and the merge-only base. Packing whole-map steps and a 16 MB cap on Undo change what Undo does, so they wait for a decision.

## 57. Packed undo of a whole map, and crash-safe saves (2026.10.31)

Same run as section 56 (Chromium 155, the real app, 800 by 600 window, main-page heap after three full garbage collections). The map from before a second file is packed with LFC-pack on a worker while the page is idle, and Undo is held to 16 MB.

| Main-page heap after | Simple table, 16 MB (188,000 items) | Rich table, 16 MB (30,000 items) |
|---|---:|---:|
| Opening it | 102.2 / 102.5 MB | 39.6 / 39.7 MB |
| 12 changes | 101.9 / 102.2 MB | 40.8 / 40.8 MB |
| A second table of the same size | 165.2 / 108.3 MB | 56.8 / 43.4 MB |
| 12 more changes | 165.0 / 108.0 MB (-35%) | 57.7 / 44.4 MB (-23%) |

Before (section 56) / after; lower is better. Against the start of section 56: 287 to 108 MB (-62%) and 116 to 44 MB (-62%). 25 of 25 undos matched. The undo of the packed step took 2.8 s (simple) and 1.2 s (rich), including the map work after it; the slowest plain undo was 1.9 to 2.2 s and 0.95 to 1.0 s.

Crash-safe saves, the whole browser killed (SIGKILL) and opened again with the same profile:

| Killed after a change | Before | After |
|---|---|---|
| Chromium 155, 2 s | lost | kept 2 of 2 |
| Chromium 155, 10 s | lost | (not rerun) |
| Chromium 155, 30 s | lost | kept 2 of 2 |
| Firefox 158, 2 s | lost | kept 2 of 2 |

Cost of one save of a 2,000-item map (557 KB), median of 13: the page's own time 2.0 / 1.8 ms (Chromium) and 2.0 / 3.0 ms (Firefox); kept in IndexedDB 14 ms (Chromium) and 11 ms (Firefox) after the call, while the page goes on. WebKitGTK was not kill-tested (its test sessions can't keep a profile).

## 58. Changes on a big map: the hand-off to the layout worker, the autosave text, one parse (2026.10.31)

16 MB moderate table (188,000 items, 563,563 links), the real app in an 800 by 600 window, the layout worker awake. Lower is better.

| One change (rename one item) | Chromium 155 | Firefox 158 | WebKitGTK 2.52.6 |
|---|---:|---:|---:|
| Hand-off to the layout worker, page time | 1,792 / 20 ms | 1,148 / 4 ms | 2,532 / 29 ms |
| ... until the worker has it | 3,082 / 24 ms | 2,532 / 12 ms | 3,348 / 48 ms |
| Autosave text (61 MB, too big to keep) | 392 / 7 ms | 373 / 14 ms | 430 / 11 ms |
| Whole app change, longest freeze | 1,520 / 942 ms | 1,844 / 961 ms | 2,631 / 1,479 ms |
| Whole app change, page held in 3 s | 3,449 / 1,931 ms | 4,061 / 1,908 ms | 5,613 / 2,945 ms |

Before / after; medians of 5 or 6. Early-stop A/B rule (after / before, 90% interval): opening netflow-test-map-30000.json, page held time: Chromium 0.86 (0.84 to 0.92), Firefox 0.91 (0.69 to 0.98), WebKitGTK 0.86 (0.73 to 0.95). Autosave of a 2,000-item map (fits; the same single write as before): Chromium 0.97 (0.82 to 1.02), Firefox 1.00 (0.88 to 1.00), WebKitGTK 1.00 (0.89 to 1.18, noisy; A/A on the same page 1.03, 1.00 to 1.09).

Restart of a parked worker (not in this build, waiting for a decision): with its graph packed off the page, the page is held 9 to 22 ms instead of 0.8 to 1.1 s (Chromium), 9 to 13 ms instead of 1.0 s (Firefox), 12 to 184 ms instead of 1.8 to 2.1 s (WebKitGTK); the restart takes 2.1 to 3.0 s instead of 1.9 to 2.4 s, 2.9 to 3.6 instead of 1.8 to 2.2 s, 4.0 to 4.2 instead of 2.3 to 3.0 s.

## 59. Changes on a big map: the item index and the number reader (2026.10.31)

16 MB moderate table (188,000 items, 563,563 links), the real app in an 800 by 600 window, the layout worker awake, one item renamed. Median of 5; all runs in one session. Lower is better.

| Longest freeze / page held in 3 s | Chromium 155 | Firefox 158 | WebKitGTK 2.52.6 |
|---|---:|---:|---:|
| 2026.10.31.1410 (before) | 854 / 1,699 ms | 834 / 1,657 ms | 1,129 / 2,249 ms |
| Index for changed items only | 547 / 1,081 ms | 466 / 918 ms | 582 / 1,145 ms |
| Number reader quick reject only | 755 / 1,502 ms | 870 / 1,723 ms | 851 / 1,687 ms |
| Both (2026.10.31.1440) | 268 / 526 ms | 387 / 756 ms | 462 / 913 ms |

Early-stop A/B rule, small map (1,500 rows, 6,003 items), 20 changes a round, after / before with the 90% interval: Chromium ok 0.88 (0.78 to 1.04, 4 rounds, noisy), Firefox faster 0.70 (0.50 to 0.74, 4 rounds), WebKitGTK faster 0.30 (0.22 to 0.75, 6 rounds, noisy).

## 60. Restarting the resting layout worker from its packed map (2026.10.31)

16 MB moderate table (751,563 items and links), the real app in an 800 by 600 window. The worker is parked (ended to free memory) and restarted 3 times. Before = 2026.10.31.1440, after = 2026.10.31.1603 (the keeper on). Lower is better.

| | Chromium 155 | Firefox 158 | WebKitGTK 2.52.6 |
|---|---:|---:|---:|
| Page held at restart, before | 642 to 762 ms | 833 to 1,177 ms | 1,569 to 1,813 ms |
| Page held at restart, after | 9 to 20 ms | 8 to 18 ms | 12 to 32 ms |
| Restart until the worker has the map, before | 1.66 to 1.77 s | 1.34 to 2.01 s | 2.11 to 2.60 s |
| Restart until the worker has the map, after | 1.80 to 2.03 s | 2.21 to 2.32 s | 2.72 to 3.20 s |
| Page held at park, after | 12 to 14 ms | 8 to 15 ms | 10 to 125 ms |

Packing on the keeper's thread: 3.2 to 4.2 s after the park, off the page. Final build (with the Firefox fix); the first timing, before the fix, gave 10 to 20 / 9 to 19 / 9 to 140 ms held at restart.

## 62. Pixel ratio cap at 2 for the map (2026.10.31)

Chromium 155, 412 by 860 window (phone size), 1,600-item map. Before = 2.5 cap (2026.10.31.1603), after = 2 cap (2026.10.31.1645).

| | Ratio 1 | Ratio 2 | Ratio 3 |
|---|---:|---:|---:|
| Canvas pixels, before | 0.66 M | 2.52 M | 3.92 M |
| Canvas pixels, after | 0.66 M | 2.52 M | 2.52 M |

At ratio 3, busy time on all browser threads while panning and zooming: 0.86 of before (early-stop A/B rule, 0.84 to 1.00). Screens at ratio 2 and below draw the same picture as before.

## 63. The column profile updated for changed items only (2026.10.31)

Lab, 800 by 600 window, Data tab shown, early-stop A/B rule. Before = 2026.10.31.1645, after = 2026.10.31.1730. Page held in the 2.5 s after one rename (heartbeat gaps over 50 ms plus the change itself), median.

| | Chromium 155 | Firefox 158 | WebKitGTK 2.52.6 |
|---|---:|---:|---:|
| 16 MB table (188,000 rows, 751,563 items and links) | 262 / 138 ms (0.53) | 292 / 91 ms (0.29) | 432 / 146 ms (0.37) |
| 1,500 rows | 7 / 7 ms | 8 / 7 ms | 9 / 9 ms |
| 1,500 rows, page time of 20 renames (synchronous) | faster 0.84 (0.75 to 0.93) | faster 0.53 (0.44 to 0.61) | faster 0.63 (0.56 to 0.79) |

