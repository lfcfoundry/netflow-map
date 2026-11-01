# Netflow Map against D3: results

Version 2026.10.17.1507. Run 2026-10-17T19:16:41.854Z in Firefox 159. Took 1:24. A bold cell is the best in its row.

## Network layout: who draws a truer map, and how fast?

Netflow Map's faster arrangement was faster than D3 in 3 of 3 sizes (middle 5.5×, higher is better) and as true or truer in 2 of 3 (truth: lower is truer).

**Time to lay out the network (lower is better) and truth score (lower is truer)**

| Items | Netflow Stress: time | truth | Netflow Force: time | truth | D3 force: time | truth | Netflow Map faster by (higher is better) |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1,000 | **291 ms** | **0.137** | 381 ms | 0.162 | 1.49 s | 0.198 | 5.1× |
| 3,000 | **1.01 s** | **0.151** | 1.49 s | 0.168 | 5.60 s | 0.194 | 5.5× |
| 10,000 | **1.00 s** | 0.199 | 3.44 s | 0.253 | 22.4 s | **0.19** | 22.4× |

- Same network for all three (about 3 links per item, planted groups, seed 11). D3 settings: link distance 30, charge -30, centered, run until the simulation cools (about 300 steps). Netflow Map times are whole builds (analysis, arrangement, clean-up so no two items touch); D3 times are the layout only, with nothing removed from overlap. Truth uses the largest connected piece. A bold cell is the best in its row.

## Flow layout (Sankey-style): speed and crossings

Netflow Map was faster than d3-sankey in 1 of 3 sizes (middle 0.6×, higher is better) and drew fewer or equal crossings in 3 of 3 (lower is better).

**Time (lower is better) and link crossings (lower is better)**

| Items | Links | Netflow Flow: time | crossings | d3-sankey: time | crossings | Netflow Map faster by (higher is better) |
|---|---:|---:|---:|---:|---:|---:|
| 100 | 150 | 12 ms | **173** | 5 ms | 468 | 0.4× |
| 400 | 616 | 17 ms | **1,039** | 10 ms | 5,415 | 0.6× |
| 1,500 | 2,283 | **25 ms** | **3,761** | 51 ms | 107,409 | 2× |

- Random layered data with no loops (d3-sankey cannot take loops; Netflow Map can). Crossings are counted the same way for both: straight lines between item centers. Netflow Map's time includes extra work D3 does not do (choke points, scores, loop handling), and the engine drops items with no links. Older measurements (docs/RESEARCH-open-source-comparison.md) found more crossings than dagre and ELK at 400 items; this table is the first against d3-sankey.

## Drawing: pan and zoom, frame by frame

Netflow Map (WebGL 2) came within 5% of the faster D3 drawing or beat it in 3 of 3 sizes (FPS, higher is better). Its basic canvas did so in 0 of 3.

**FPS while panning and zooming (higher is better; your screen's refresh rate is the ceiling)**

| Items | D3 SVG | D3 canvas | Netflow Map (WebGL 2) | Netflow Map (basic canvas) |
|---|---:|---:|---:|---:|
| 1,000 | 60 | **60.4** | 60.4 | 8.7 |
| 3,000 | 43.6 | 55.7 | **60.4** | 3.6 |
| 10,000 | 23.9 | 18.4 | **60.4** | 1.1 |

**Slowest 1 in 20 pictures, in milliseconds (lower is better)**

| Items | D3 SVG | D3 canvas | Netflow Map (WebGL 2) | Netflow Map (basic canvas) |
|---|---:|---:|---:|---:|
| 1,000 | 17 | 17 | 17 | 150 |
| 3,000 | 50 | 33 | 17 | 350 |
| 10,000 | 50 | 67 | 17 | 1250 |

**Time until the first picture is on screen, in milliseconds (lower is better)**

| Items | D3 SVG | D3 canvas | Netflow Map (WebGL 2) | Netflow Map (basic canvas) |
|---|---:|---:|---:|---:|
| 1,000 | 68 | 33 | 98 | 45 |
| 3,000 | 218 | 22 | 110 | 47 |
| 10,000 | 641 | 30 | 187 | 149 |

- Same item positions (Netflow Map's Stress layout) in all four. D3 here draws only plain dots and thin lines; Netflow Map's picture also carries curved links, arrowheads, shapes and labels, so it does MORE work per picture, which favors D3. The D3 canvas draws all lines in one path and the dots grouped by color, the quick way a D3 canvas is usually written. The motion is a slow zoom-in-and-out with a small sway, 2.5 seconds per test.

