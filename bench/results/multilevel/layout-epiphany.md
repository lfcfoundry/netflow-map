# Netflow Map against D3: results

Browser as printed by the test program: **Epiphany 46.5**.

Version 2026.10.17.1531. Run 2026-10-17T19:34:06.318Z in Mozilla/5.0 (X11; Ubuntu; Linux x86_64) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/60.5 Safari/605.1.15. Took 0:20. A bold cell is the best in its row.

## Network layout: who draws a truer map, and how fast?

Netflow Map's faster arrangement was faster than D3 in 3 of 3 sizes (middle 3.6×, higher is better) and as true or truer in 3 of 3 (truth: lower is truer).

**Time to lay out the network (lower is better) and truth score (lower is truer)**

| Items | Netflow Stress: time | truth | Netflow Force: time | truth | D3 force: time | truth | Netflow Map faster by (higher is better) |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1,000 | **235 ms** | **0.137** | 242 ms | 0.162 | 758 ms | 0.198 | 3.2× |
| 3,000 | 952 ms | **0.152** | **839 ms** | 0.168 | 3.01 s | 0.194 | 3.6× |
| 10,000 | **1.20 s** | **0.176** | 2.02 s | 0.252 | 10.6 s | 0.19 | 8.9× |

- Same network for all three (about 3 links per item, planted groups, seed 11). D3 settings: link distance 30, charge -30, centered, run until the simulation cools (about 300 steps). Netflow Map times are whole builds (analysis, arrangement, clean-up so no two items touch); D3 times are the layout only, with nothing removed from overlap. Truth uses the largest connected piece. A bold cell is the best in its row.

