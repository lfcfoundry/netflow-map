# Netflow Map against D3: results

Browser as printed by the test program: **chromium 155.0.8059.39**.

Version 2026.10.17.1531. Run 2026-10-17T19:32:15.654Z in Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/155.0.0.0 Safari/537.36. Took 0:22. A bold cell is the best in its row.

## Network layout: who draws a truer map, and how fast?

Netflow Map's faster arrangement was faster than D3 in 3 of 3 sizes (middle 7.3×, higher is better) and as true or truer in 3 of 3 (truth: lower is truer).

**Time to lay out the network (lower is better) and truth score (lower is truer)**

| Items | Netflow Stress: time | truth | Netflow Force: time | truth | D3 force: time | truth | Netflow Map faster by (higher is better) |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1,000 | **159 ms** | **0.137** | 230 ms | 0.162 | 1.16 s | 0.198 | 7.3× |
| 3,000 | **849 ms** | **0.151** | 858 ms | 0.168 | 3.02 s | 0.194 | 3.6× |
| 10,000 | **743 ms** | **0.175** | 1.83 s | 0.252 | 12.6 s | 0.19 | 16.9× |

- Same network for all three (about 3 links per item, planted groups, seed 11). D3 settings: link distance 30, charge -30, centered, run until the simulation cools (about 300 steps). Netflow Map times are whole builds (analysis, arrangement, clean-up so no two items touch); D3 times are the layout only, with nothing removed from overlap. Truth uses the largest connected piece. A bold cell is the best in its row.

