# Netflow Map against D3: results

Browser as printed by the test program: **MiniBrowser 2.52.6**.

Version 2026.10.17.1531. Run 2026-10-17T19:32:44.644Z in Mozilla/5.0 (X11; Ubuntu; Linux x86_64) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/60.5 Safari/605.1.15. Took 0:21. A bold cell is the best in its row.

## Network layout: who draws a truer map, and how fast?

Netflow Map's faster arrangement was faster than D3 in 3 of 3 sizes (middle 4.5×, higher is better) and as true or truer in 3 of 3 (truth: lower is truer).

**Time to lay out the network (lower is better) and truth score (lower is truer)**

| Items | Netflow Stress: time | truth | Netflow Force: time | truth | D3 force: time | truth | Netflow Map faster by (higher is better) |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1,000 | **211 ms** | **0.137** | 268 ms | 0.162 | 959 ms | 0.198 | 4.5× |
| 3,000 | 1.02 s | **0.152** | **878 ms** | 0.168 | 2.77 s | 0.194 | 3.1× |
| 10,000 | **979 ms** | **0.176** | 1.89 s | 0.252 | 11.2 s | 0.19 | 11.4× |

- Same network for all three (about 3 links per item, planted groups, seed 11). D3 settings: link distance 30, charge -30, centered, run until the simulation cools (about 300 steps). Netflow Map times are whole builds (analysis, arrangement, clean-up so no two items touch); D3 times are the layout only, with nothing removed from overlap. Truth uses the largest connected piece. A bold cell is the best in its row.

