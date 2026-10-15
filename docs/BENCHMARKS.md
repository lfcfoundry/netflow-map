# Benchmarks

Measured in two desktop browsers, because real data work happens there: **ungoogled-chromium 154** and **Firefox 158**, headless, on a 2-core, 7 GB Linux machine. Every table below is generated from the raw files in `bench/results/*.jsonl` by `node bench/report.js`, so the numbers here are the numbers in the files.

Libraries we compare against (all current npm releases, bundled into the benchmark page): Papa Parse, d3-dsv, d3-force, graphology-layout-forceatlas2, dagre, ELK, graphology Louvain, d3-random, jStat, expr-eval, gifenc, graphology and Cytoscape.

## How the measurements were made

- Every job runs in a fresh page. Times are the median of up to three runs (seven interleaved runs for the CSV grid); anything slower than 600 ms is run once.
- A job that passes its time limit (5 minutes in the scale runs) or loses its page is recorded as a failure, and the browser is restarted. A bigger size of the same job is skipped when the smaller one failed, or when even a straight-line projection from it passes the limit.
- Firefox rounds its timer to 1 ms, so differences under about 3 ms are not meaningful there. Firefox does not report JS heap; its memory is whole-process memory, which is noisy at the MB scale.
- "Layout score" is the sampled stress of the picture: how far page distances are from hop counts after the best single scale factor (lower is truer). d3-force and ForceAtlas2 place points with no size, while ours keeps sized items from overlapping, so the score slightly favors them.
- Three kinds of structure at every scale: **simple** is a plain tree (two columns); **moderate** has communities, about 3 links per item, weights, groups and labels; **complex** adds hubs, cycles, self-links, repeated links, 12 columns, quoted text with commas, doubled quotes and line breaks, four state columns, and about 4 links per item.
- The earlier Node-only numbers in `RESEARCH-open-source-comparison.md` used a different Chromium (Playwright's 141) for its browser checks; everything here is ungoogled-chromium 154 and Firefox 158.

## Summary: are the wins consistent across both browsers?

| Area | Chromium 154 | Firefox 158 | Verdict |
|---|---|---|---|
| CSV reading vs Papa Parse (21 table shapes) | faster in 20, median 0.70× the time, worst 1.13× | faster in 18, median 0.82×, worst 1.32× | Consistent win on quoted, long-field and wide data; parity on small unquoted data |
| CSV reading, whole files of each structure (9 files) | at or under Papa in 3, up to 1.5× slower in the rest | at or under Papa in 2, up to 1.4× slower (one 6 ms parse read 2× against Firefox's 1 ms timer) | Parity, within about ±40%, noise-limited |
| Stress layout vs d3-force (20 cases, 200 to 10,000 items) | faster in 20 of 20 | faster in 20 of 20 | Consistent win: 2 to 8× faster up to 3,000 items, 20 to 58× at 10,000 |
| Stress layout truth vs d3-force | as true or truer in 16 of 20 | 16 of 20 | Win up to 3,000 items; 7 to 28% less true at 10,000 |
| Force layout vs d3-force | faster in 20 of 20 | faster in 20 of 20 | Consistent win |
| Layered drawing vs dagre / ELK | 7 to 13× faster than dagre, but 7 to 117% more crossings | same | Speed win, quality loss (unchanged) |
| Formulas vs expr-eval | 3.8× faster | 5.0× faster | Consistent win |
| Poisson / binomial draws vs d3-random | 2.2 / 2.6× faster | 2.6 / 1.8× faster | Consistent win |
| Normal / lognormal draws vs d3-random, jStat | 1.3 to 1.5× slower | equal to 1.3× slower | **Loss or tie** |
| GIF export vs gifenc (shared palette) | 2.1× slower, same file size | 1.7 to 2.7× slower, same file size | **Loss in both browsers**; the 20×-faster Node result does not carry over |
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
- All pairs are now used up to 3,000 items (was 700), with fewer passes as the count grows, because the sweep is now cheap enough. This is the largest single gain in layout truth: at 1,000 items the score went from 0.18 to 0.12.
- Bigger pieces use pivots plus each item's nearest 16 neighbors (the short-range pairs carry most of the score), and the pair count is capped by memory (about 12 million pairs).
- Overlap removal uses a plain grid with a counting sort, a cell sized to the largest items, and a first stretch of crowded pictures so little is left to push apart. Stress at 20,000 items went from 6.2 s to about 1.4 s (Node measurement).

**Chromium 154** (time / layout score, lower score = truer)

| structure | items | Stress (now) | Stress (before) | Force | d3-force | ForceAtlas2 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| simple | 200 | 24 ms / 0.106 | 48 ms / 0.107 | 100 ms / 0.140 | 189 ms / 0.177 | 94 ms / 0.180 |
| simple | 600 | 136 ms / 0.121 | 538 ms / 0.120 | 313 ms / 0.151 | 625 ms / 0.204 | 767 ms / 0.195 |
| simple | 1,000 | 225 ms / 0.121 | 369 ms / 0.184 | 608 ms / 0.171 | 1.3 s / 0.208 | 1.2 s / 0.189 |
| simple | 3,000 | 1.4 s / 0.130 | 1.2 s / 0.222 | 2.3 s / 0.191 | 4.9 s / 0.217 | 4.8 s / 0.203 |
| simple | 10,000 | 641 ms / 0.231 | 2.1 s / 0.245 | 5.0 s / 0.260 | 26 s / 0.210 | 23 s / 0.201 |
| moderate | 200 | 35 ms / 0.087 | 65 ms / 0.087 | 195 ms / 0.116 | 236 ms / 0.176 | 99 ms / 0.164 |
| moderate | 600 | 123 ms / 0.124 | 573 ms / 0.127 | 395 ms / 0.163 | 745 ms / 0.189 | 714 ms / 0.184 |
| moderate | 1,000 | 224 ms / 0.137 | 343 ms / 0.224 | 670 ms / 0.162 | 1.2 s / 0.198 | 1.2 s / 0.174 |
| moderate | 3,000 | 1.9 s / 0.151 | 1.3 s / 0.234 | 2.5 s / 0.168 | 4.7 s / 0.194 | 5.1 s / 0.176 |
| moderate | 10,000 | 853 ms / 0.213 | 3.5 s / 0.233 | 6.1 s / 0.254 | 22 s / 0.190 | 24 s / 0.180 |
| complex | 200 | 22 ms / 0.119 | 54 ms / 0.124 | 129 ms / 0.130 | 238 ms / 0.150 | 111 ms / 0.140 |
| complex | 600 | 168 ms / 0.119 | 799 ms / 0.155 | 443 ms / 0.130 | 848 ms / 0.144 | 874 ms / 0.141 |
| complex | 1,000 | 275 ms / 0.124 | 359 ms / 0.238 | 782 ms / 0.140 | 1.6 s / 0.187 | 1.5 s / 0.147 |
| complex | 3,000 | 2.3 s / 0.138 | 1.4 s / 0.243 | 3.4 s / 0.157 | 4.8 s / 0.172 | 5.7 s / 0.185 |
| complex | 10,000 | 928 ms / 0.233 | 4.3 s / 0.246 | 5.9 s / 0.208 | 24 s / 0.195 | 27 s / 0.179 |
| planted | 200 | 51 ms / 0.077 | 56 ms / 0.077 | 157 ms / 0.122 | 217 ms / 0.185 | 122 ms / 0.118 |
| planted | 600 | 135 ms / 0.109 | 666 ms / 0.115 | 431 ms / 0.137 | 765 ms / 0.184 | 710 ms / 0.162 |
| planted | 1,000 | 310 ms / 0.129 | 480 ms / 0.195 | 808 ms / 0.153 | 1.4 s / 0.192 | 1.3 s / 0.170 |
| planted | 3,000 | 1.8 s / 0.146 | 1.5 s / 0.215 | 3.3 s / 0.172 | 5.4 s / 0.195 | 5.6 s / 0.180 |
| planted | 10,000 | 1.1 s / 0.240 | 5.0 s / 0.233 | 6.6 s / 0.276 | 23 s / 0.188 | 24 s / 0.190 |

**Firefox 158** (time / layout score, lower score = truer)

| structure | items | Stress (now) | Stress (before) | Force | d3-force | ForceAtlas2 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| simple | 200 | 33 ms / 0.107 | 78 ms / 0.107 | 159 ms / 0.139 | 257 ms / 0.177 | 115 ms / 0.170 |
| simple | 600 | 102 ms / 0.121 | 1.4 s / 0.120 | 403 ms / 0.151 | 869 ms / 0.204 | 587 ms / 0.195 |
| simple | 1,000 | 239 ms / 0.122 | 746 ms / 0.187 | 926 ms / 0.172 | 1.6 s / 0.208 | 1.1 s / 0.203 |
| simple | 3,000 | 1.5 s / 0.130 | 2.6 s / 0.215 | 4.1 s / 0.191 | 8.0 s / 0.217 | 4.5 s / 0.208 |
| simple | 10,000 | 548 ms / 0.225 | 3.5 s / 0.253 | 7.7 s / 0.260 | 32 s / 0.210 | 20 s / 0.198 |
| moderate | 200 | 24 ms / 0.087 | 70 ms / 0.087 | 140 ms / 0.117 | 238 ms / 0.176 | 138 ms / 0.151 |
| moderate | 600 | 134 ms / 0.124 | 1.5 s / 0.127 | 482 ms / 0.163 | 943 ms / 0.189 | 486 ms / 0.178 |
| moderate | 1,000 | 249 ms / 0.136 | 827 ms / 0.212 | 951 ms / 0.163 | 1.7 s / 0.198 | 1.2 s / 0.179 |
| moderate | 3,000 | 2.5 s / 0.151 | 2.7 s / 0.237 | 4.2 s / 0.168 | 6.9 s / 0.194 | 4.0 s / 0.184 |
| moderate | 10,000 | 818 ms / 0.215 | 6.7 s / 0.229 | 10 s / 0.254 | 30 s / 0.190 | 21 s / 0.175 |
| complex | 200 | 31 ms / 0.119 | 86 ms / 0.123 | 156 ms / 0.130 | 230 ms / 0.150 | 107 ms / 0.151 |
| complex | 600 | 167 ms / 0.119 | 1.7 s / 0.151 | 564 ms / 0.130 | 998 ms / 0.144 | 559 ms / 0.140 |
| complex | 1,000 | 297 ms / 0.124 | 941 ms / 0.247 | 1.2 s / 0.140 | 1.8 s / 0.187 | 1.0 s / 0.146 |
| complex | 3,000 | 2.2 s / 0.138 | 3.5 s / 0.248 | 4.4 s / 0.158 | 9.6 s / 0.172 | 4.9 s / 0.169 |
| complex | 10,000 | 1.1 s / 0.228 | 7.7 s / 0.247 | 9.6 s / 0.207 | 34 s / 0.195 | 23 s / 0.179 |
| planted | 200 | 28 ms / 0.078 | 101 ms / 0.077 | 196 ms / 0.122 | 300 ms / 0.185 | 99 ms / 0.148 |
| planted | 600 | 137 ms / 0.109 | 1.5 s / 0.115 | 505 ms / 0.137 | 965 ms / 0.184 | 750 ms / 0.152 |
| planted | 1,000 | 278 ms / 0.129 | 901 ms / 0.200 | 1.2 s / 0.153 | 2.3 s / 0.192 | 1.0 s / 0.172 |
| planted | 3,000 | 2.2 s / 0.145 | 3.3 s / 0.216 | 4.0 s / 0.172 | 7.7 s / 0.195 | 4.1 s / 0.189 |
| planted | 10,000 | 905 ms / 0.238 | 6.5 s / 0.243 | 11 s / 0.277 | 34 s / 0.188 | 21 s / 0.187 |

Reading it: **time** is lower for Stress in all 40 cases (20 per browser); at 10,000 items it is 20 to 58 times faster than d3-force. **Truth** is better than d3-force's up to 3,000 items; at 10,000 items it is 7 to 28% worse (0.21 to 0.24 against 0.19 to 0.21). The gap is the pivot method, which only sees far-apart items plus near neighbors. More pivots, more rounds and more near neighbors did not close it (the results moved by less than the noise), so the next step is a multilevel layout (lay out a coarse graph first, then refine), not tuning. The "before" column is the engine as committed before this work, loaded in the same page.

Memory trade: at 3,000 items the all-pairs method holds 4.5 million pairs (about 72 MB at peak), roughly 3× the old method's footprint at that one size, and then returns it. Above 3,000 items it uses less memory than before.

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
| normal | 68 | 54 | 46 |
| lognormal | 138 | 102 | – |
| poisson | 129 | 283 | 85 |
| binomial | 230 | 596 | – |
| exponential | 41 | 44 | – |

Formulas, 300,000 rows: ours 70 ms, expr-eval 265 ms (3.80× faster)

GIF export

| frames | size | ours | file | gifenc | file |
| --- | ---: | ---: | ---: | ---: | ---: |
| 4 | 960×540 | 148 ms | 68 KB | 71 ms | 0.1 MB |
| 31 | 960×540 | 646 ms | 520 KB | 305 ms | 0.5 MB |

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
| normal | 51 | 51 | 39 |
| lognormal | 90 | 84 | – |
| poisson | 117 | 309 | 53 |
| binomial | 333 | 600 | – |
| exponential | 47 | 45 | – |

Formulas, 300,000 rows: ours 52 ms, expr-eval 258 ms (4.96× faster)

GIF export

| frames | size | ours | file | gifenc | file |
| --- | ---: | ---: | ---: | ---: | ---: |
| 4 | 960×540 | 148 ms | 67 KB | 55 ms | 0.1 MB |
| 31 | 960×540 | 625 ms | 515 KB | 364 ms | 0.5 MB |

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

Notes: GIF compares our encoder with gifenc using one shared palette on four synthetic frames and then 31; ours is slower in both browsers while the files are the same size, so this is a loss to fix, not a win. The Node result in the earlier research report (ours 0.4 s against 7.6 to 10.7 s) was gifenc with a palette per frame. The draws are 1,000,000 samples each.

## 6. Left for the next round

1. A multilevel Stress layout to close the 7 to 28% truth gap at 10,000 items and above.
2. Layout results as typed arrays (70 to 100 times cheaper to send at 1,000,000 items).
3. GIF encoder speed (1.7 to 2.7× slower than gifenc in both browsers) and the normal / lognormal draws (up to 1.5× slower than d3-random and jStat in Chromium).
4. Reading text over 512 million characters in Chromium needs a chunked reader; the import cap of 200,000 items / 800,000 links is still the app default.
5. A faster Force layout above 100,000 items; at that size it takes over a minute.

## 7. Scorecard: one geometric mean for all the head-to-head results

How it is counted (you chose: each head-to-head counts once, with speed, memory and layout truth in the same mean):

- One comparison is one of our modules against one competitor on one data set in one browser. A ratio is the competitor's result divided by ours, so above 1 means we are better: 2.0× is twice as fast, uses half the memory, or draws a picture twice as true to the real link distances. Speed ratios are time ÷ time, memory ratios are bytes ÷ bytes, layout truth is the competitor's score ÷ ours (lower score is truer), crossings and group match are done the same way, and GIF file size counts as memory.
- A win is a ratio over 1.03, a tie is within 3%, a loss is under 0.97. Nothing is weighted: a 60× win and a 1.1× win each count once, and the geometric mean (the n-th root of the product) is the right average because 2× faster and 2× slower cancel exactly.
- Speed comparisons where both times are under 3 ms were dropped (Firefox's timer steps in whole milliseconds); 4 comparisons.
- "First place" means our module beats every competitor in that row (for example Stress against both d3-force and ForceAtlas2 at 3,000 complex items in Firefox).

**Overall** (a ratio above 1 means our module is better; a win is a ratio over 1.03, a tie is within 3%)

| | comparisons | wins / ties / losses | geometric mean (other ÷ ours) |
| --- | ---: | ---: | ---: |
| Speed only, both browsers | 314 | 249 / 8 / 57 | 2.23× |
| Speed only, Chromium 154 | 157 | 127 / 2 / 28 | 2.30× |
| Speed only, Firefox 158 | 157 | 122 / 6 / 29 | 2.15× |
| Speed + memory + layout truth, both browsers | 498 | 378 / 12 / 108 | 1.74× |
| Speed + memory + layout truth, Chromium 154 | 250 | 192 / 4 / 54 | 1.78× |
| Speed + memory + layout truth, Firefox 158 | 248 | 186 / 8 / 54 | 1.70× |

**First places on speed:** one benchmark row is one data set in one browser (for example Stress at 3,000 complex items in Firefox, against d3-force and ForceAtlas2 together). We come first, ahead of every competitor in the row, in 108 of 160 rows (Chromium 56 of 80, Firefox 52 of 80).

**By area** (both browsers, all metrics in the area)

| | comparisons | wins / ties / losses | geometric mean (other ÷ ours) |
| --- | ---: | ---: | ---: |
| CSV parsing | 116 | 77 / 4 / 35 | 1.17× |
| Stress layout | 80 | 80 / 0 / 0 | 6.64× |
| Stress layout truth | 80 | 64 / 0 / 16 | 1.32× |
| Force layout | 80 | 67 / 3 / 10 | 1.73× |
| Force layout truth | 80 | 63 / 0 / 17 | 1.09× |
| Layered drawing | 12 | 12 / 0 / 0 | 14.8× |
| Layered drawing truth | 12 | 0 / 0 / 12 | 0.60× |
| Found groups | 6 | 6 / 0 / 0 | 2.23× |
| Found groups truth | 6 | 0 / 4 / 2 | 0.96× |
| Random draws | 14 | 5 / 1 / 8 | 1.06× |
| Formulas | 2 | 2 / 0 / 0 | 4.34× |
| GIF export | 8 | 0 / 0 / 8 | 0.66× |
| Network memory | 2 | 2 / 0 / 0 | 4.26× |

**By competitor** (all areas and metrics)

| | comparisons | wins / ties / losses | geometric mean (other ÷ ours) |
| --- | ---: | ---: | ---: |
| Papa Parse | 58 | 39 / 2 / 17 | 1.18× |
| d3-dsv | 58 | 38 / 2 / 18 | 1.16× |
| d3-force | 160 | 144 / 0 / 16 | 2.24× |
| ForceAtlas2 | 160 | 130 / 3 / 27 | 1.81× |
| dagre | 6 | 6 / 0 / 0 | 8.85× |
| dagre (crossings) | 6 | 0 / 0 / 6 | 0.66× |
| ELK | 6 | 6 / 0 / 0 | 24.8× |
| ELK (crossings) | 6 | 0 / 0 / 6 | 0.55× |
| Louvain | 6 | 6 / 0 / 0 | 2.23× |
| Louvain (match) | 6 | 0 / 4 / 2 | 0.96× |
| d3-random | 10 | 5 / 1 / 4 | 1.31× |
| jStat | 4 | 0 / 0 / 4 | 0.63× |
| expr-eval | 2 | 2 / 0 / 0 | 4.34× |
| gifenc | 8 | 0 / 0 / 8 | 0.66× |
| graphology | 1 | 1 / 0 / 0 | 1.88× |
| Cytoscape | 1 | 1 / 0 / 0 | 9.63× |

**Each area counted once:** the geometric mean of the 13 area means is 1.92×. Left out as below timer resolution: 4 comparisons.

Reading it plainly: counting every comparison once, we are **1.74× better on average** (378 wins, 12 ties, 108 losses out of 498; 1.78× in Chromium, 1.70× in Firefox), and **2.23× faster on speed alone**. We come first in 108 of the 160 speed rows. The mean is pulled up by Stress (6.6× faster than the two force layouts, with all 80 comparisons won), layered drawing (14.8× faster than dagre and ELK) and formulas (4.3×); it is pulled down by the places that are honestly behind: layered-drawing crossings (0.60×, we draw more crossings), GIF export (0.66×, slower than gifenc), jStat's normal draws (0.63×) and CSV parsing, which is only 1.17× ahead on average with 35 losses out of 116 (mostly small unquoted files and whole-file parses that Papa Parse reads about as fast). Weighting each of the 13 areas equally instead of each comparison gives 1.92×.

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

**How is "truest layout" defined and measured?** Truest means: distances on the page match how far apart the items really are in the network. For a layout, take the shortest path (number of links, in either direction) between pairs of items as the real distance `d`, and the distance between the items' centers on the page as `e`. Because a picture can be zoomed freely, find the single best zoom `s = Σ(e/d) / Σ(e²/d²)` and score the layout as the mean of `(d − s·e)² / d²`. Zero is a picture where every pair is exactly proportional; lower is truer. Dividing by `d²` makes neighbors matter most: getting two linked items placed far apart costs much more than misplacing two items that are 12 hops apart. To keep the check cheap, 60 evenly spaced source items are used, and each is compared with every other item (every 7th item above 3,000 items). It is the same number for every competitor, measured on their finished positions (`bench/suites.js`, `bench/stress-tune.js`). Two cautions: it is the quantity Stress minimizes, so Stress is naturally good at it; and it ignores item size, so d3-force and ForceAtlas2, which place points and never make room for boxes, are not penalized for overlaps, while ours remove overlaps (which costs a little truth). Layered-drawing quality is measured separately, as the number of crossing lines, and found groups as how well they match the planted groups.

**Are item counts only nodes? Do they limit how many links an item can have?** The counts are items (nodes) only. Links are limited separately, and one item can have as many links as the file has: a single hub with 150,000 links read whole, and 1,000 items with 330,000 links laid out in about 3 seconds. The app's default import caps are 200,000 items and 800,000 links, whichever comes first, with a plain-words note when reached (the benchmarks lift them to measure 1,000,000 items). The scale tables use about 1 link per item (simple), 3 (moderate) and 4.2 (complex, so the 1,000,000-item complex file holds 4.2 million links). More links per item makes everything cost more (reading is linear in links; the Stress layout's work grows with items times pivots plus links, and its pair memory is capped near 12 million pairs), but the cost is smooth and nothing stops at a link count.

**Did the network-mapping research improve our engine, in speed or quality?** Yes in speed, mixed in quality, and none of it came from copying library code (the research only compares; no code was taken). Measured on the same six-cluster test network (`docs/RESEARCH-open-source-comparison.md`, section 7, and sections 1 to 4 above):
- Speed: overlap removal was 9.9 of 12 seconds at 10,000 items and is about 4× faster; Stress at 10,000 items went from about 15.6 s to 3.6 s, and with typed arrays it is now 20 to 58× faster than d3-force at that size; the minified build is 31% smaller; layout result memory fell 9% (17.8 to 16.3 MB at 10,000 items) and the pair lists use about a fifth of the memory.
- Quality: at 3,000 items Stress truth went from 0.286 to 0.224 and Force from 0.222 to 0.154 (d3-force: 0.179), so Force is now truer than d3-force there. Stress remains 7 to 28% less true than d3-force at 10,000 items and above.
- Not improved: the layered flow drawing still has 60 to 100% more crossings than dagre and ELK (it is 7 to 117× faster), our own Louvain groups were not written, and GIF export is slower than gifenc. The research listed these; they remain on the work list.

## Reproduce

```
cd bench && npm install && node build-libs.mjs      # bundles the libraries into bench/dist/libs.js
node run.js chromium csv                             # or: firefox
node run.js chromium stress
node run.js chromium typed
node run.js chromium compare
node ../test/archive.test.js && node --expose-gc ../test/fuzz.test.js 70   # zips, Excel, graph files; random and hostile input
node ../test/fuzz.browser.js chromium 30            # or: firefox
node wasm/exp.js                                    # WebAssembly experiment (sweep.c is built with clang, see its header)
node run.js chromium limits                          # about 15 minutes per browser
node report.js                                       # all tables, from bench/results/*.jsonl
node stress-tune.js moderate 10000 before '{}'       # Node-only side by side of stress settings
```

Set `NFM_CHROME` and `NFM_FIREFOX` to the browser programs, and `NFM_PLAYWRIGHT` / `NFM_PUPPETEER` to the driver libraries when they are not in the default places (see `bench/driver.js`).
