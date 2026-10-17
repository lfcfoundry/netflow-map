# Netflow Map against D3: results

Browser as printed by the test program: **firefox/158.0**.

Version 2026.10.17.1531. Run 2026-10-17T19:33:35.486Z in Mozilla/5.0 (X11; Linux x86_64; rv:158.0) Gecko/20100101 Firefox/158.0. Took 0:27. A bold cell is the best in its row.

## Network layout: who draws a truer map, and how fast?

Netflow Map's faster arrangement was faster than D3 in 3 of 3 sizes (middle 7.2×, higher is better) and as true or truer in 3 of 3 (truth: lower is truer).

**Time to lay out the network (lower is better) and truth score (lower is truer)**

| Items | Netflow Stress: time | truth | Netflow Force: time | truth | D3 force: time | truth | Netflow Map faster by (higher is better) |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1,000 | **211 ms** | **0.136** | 277 ms | 0.163 | 1.52 s | 0.198 | 7.2× |
| 3,000 | 908 ms | **0.151** | **898 ms** | 0.168 | 4.24 s | 0.194 | 4.7× |
| 10,000 | **887 ms** | **0.178** | 2.08 s | 0.252 | 16.0 s | 0.19 | 18.1× |

- Same network for all three (about 3 links per item, planted groups, seed 11). D3 settings: link distance 30, charge -30, centered, run until the simulation cools (about 300 steps). Netflow Map times are whole builds (analysis, arrangement, clean-up so no two items touch); D3 times are the layout only, with nothing removed from overlap. Truth uses the largest connected piece. A bold cell is the best in its row.

