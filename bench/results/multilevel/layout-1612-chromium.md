# Netflow Map against D3: results

Browser as printed by the test program: **chromium 155.0.8059.39**.

Version 2026.10.17.1612. Run 2026-10-17T20:09:11.542Z in Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/155.0.0.0 Safari/537.36. Took 0:21. A bold cell is the best in its row.

## Network layout: who draws a truer map, and how fast?

Netflow Map's faster arrangement was faster than D3 in 3 of 3 sizes (middle 5.5×, higher is better) and as true or truer in 3 of 3 (truth: lower is truer).

**Time to lay out the network (lower is better) and truth score (lower is truer)**

| Items | Netflow Stress: time | truth | Netflow Force: time | truth | D3 force: time | truth | Netflow Map faster by (higher is better) |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1,000 | **140 ms** | **0.137** | 228 ms | 0.162 | 769 ms | 0.198 | 5.5× |
| 3,000 | **705 ms** | **0.151** | 790 ms | 0.168 | 2.87 s | 0.194 | 4.1× |
| 10,000 | **397 ms** | **0.173** | 1.93 s | 0.252 | 13.6 s | 0.19 | 34.2× |

- Same network for all three (about 3 links per item, planted groups, seed 11). D3 settings: link distance 30, charge -30, centered, run until the simulation cools (about 300 steps). Netflow Map times are whole builds (analysis, arrangement, clean-up so no two items touch); D3 times are the layout only, with nothing removed from overlap. Truth uses the largest connected piece. A bold cell is the best in its row.

