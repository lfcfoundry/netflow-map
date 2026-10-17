# Netflow Map against D3: results

Browser as printed by the test program: **Epiphany 46.5**.

Version 2026.10.17.1612. Run 2026-10-17T20:23:13.654Z in Mozilla/5.0 (X11; Ubuntu; Linux x86_64) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/60.5 Safari/605.1.15. Took 0:21. A bold cell is the best in its row.

## Network layout: who draws a truer map, and how fast?

Netflow Map's faster arrangement was faster than D3 in 3 of 3 sizes (middle 3.5×, higher is better) and as true or truer in 3 of 3 (truth: lower is truer).

**Time to lay out the network (lower is better) and truth score (lower is truer)**

| Items | Netflow Stress: time | truth | Netflow Force: time | truth | D3 force: time | truth | Netflow Map faster by (higher is better) |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1,000 | 260 ms | **0.137** | **252 ms** | 0.162 | 872 ms | 0.198 | 3.5× |
| 3,000 | 1.05 s | **0.152** | **849 ms** | 0.168 | 2.64 s | 0.194 | 3.1× |
| 10,000 | **670 ms** | **0.172** | 2.01 s | 0.252 | 11.7 s | 0.19 | 17.5× |

- Same network for all three (about 3 links per item, planted groups, seed 11). D3 settings: link distance 30, charge -30, centered, run until the simulation cools (about 300 steps). Netflow Map times are whole builds (analysis, arrangement, clean-up so no two items touch); D3 times are the layout only, with nothing removed from overlap. Truth uses the largest connected piece. A bold cell is the best in its row.

