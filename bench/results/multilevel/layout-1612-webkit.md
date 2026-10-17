# Netflow Map against D3: results

Browser as printed by the test program: **MiniBrowser 2.52.6**.

Version 2026.10.17.1612. Run 2026-10-17T20:10:16.291Z in Mozilla/5.0 (X11; Ubuntu; Linux x86_64) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/60.5 Safari/605.1.15. Took 0:19. A bold cell is the best in its row.

## Network layout: who draws a truer map, and how fast?

Netflow Map's faster arrangement was faster than D3 in 3 of 3 sizes (middle 3.5×, higher is better) and as true or truer in 3 of 3 (truth: lower is truer).

**Time to lay out the network (lower is better) and truth score (lower is truer)**

| Items | Netflow Stress: time | truth | Netflow Force: time | truth | D3 force: time | truth | Netflow Map faster by (higher is better) |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1,000 | **217 ms** | **0.137** | 237 ms | 0.162 | 749 ms | 0.198 | 3.5× |
| 3,000 | 975 ms | **0.152** | **876 ms** | 0.168 | 2.64 s | 0.194 | 3× |
| 10,000 | **558 ms** | **0.172** | 1.98 s | 0.252 | 11.1 s | 0.19 | 19.8× |

- Same network for all three (about 3 links per item, planted groups, seed 11). D3 settings: link distance 30, charge -30, centered, run until the simulation cools (about 300 steps). Netflow Map times are whole builds (analysis, arrangement, clean-up so no two items touch); D3 times are the layout only, with nothing removed from overlap. Truth uses the largest connected piece. A bold cell is the best in its row.

