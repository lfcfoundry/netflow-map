# Netflow Map against D3: results

Browser as printed by the test program: **firefox/158.0**.

Version 2026.10.17.1612. Run 2026-10-17T20:09:49.078Z in Mozilla/5.0 (X11; Linux x86_64; rv:158.0) Gecko/20100101 Firefox/158.0. Took 0:29. A bold cell is the best in its row.

## Network layout: who draws a truer map, and how fast?

Netflow Map's faster arrangement was faster than D3 in 3 of 3 sizes (middle 6.6×, higher is better) and as true or truer in 3 of 3 (truth: lower is truer).

**Time to lay out the network (lower is better) and truth score (lower is truer)**

| Items | Netflow Stress: time | truth | Netflow Force: time | truth | D3 force: time | truth | Netflow Map faster by (higher is better) |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1,000 | **186 ms** | **0.136** | 243 ms | 0.163 | 1.23 s | 0.198 | 6.6× |
| 3,000 | **867 ms** | **0.151** | 912 ms | 0.168 | 4.66 s | 0.194 | 5.4× |
| 10,000 | **527 ms** | **0.173** | 2.04 s | 0.252 | 18.1 s | 0.19 | 34.4× |

- Same network for all three (about 3 links per item, planted groups, seed 11). D3 settings: link distance 30, charge -30, centered, run until the simulation cools (about 300 steps). Netflow Map times are whole builds (analysis, arrangement, clean-up so no two items touch); D3 times are the layout only, with nothing removed from overlap. Truth uses the largest connected piece. A bold cell is the best in its row.

