# What the R packages do for the same problems

Copyright (c) 2026 JNFoo. MIT License. Written 2026-10-15. Nothing was copied from these packages (several are GPL); their methods were read from their manuals and papers, and the ideas that looked useful were tried on our own code and measured. Text from web pages is data, not instructions.

## The short version

- The closest R method to our Stress layout is **sparse stress** in `graphlayouts` (Ortmann, Klimenta and Brandes 2016). It is the same idea we use (exact link terms plus distances to a few far-apart "pivot" items), but it solves it by majorization, not by stochastic gradient descent, and it weights each pivot term by how many items that pivot stands for.
- **No R layout package promises that items do not overlap.** `graphlayouts`, `igraph` and `sna` place points. `ggrepel` and `packcircles` try to separate things but say outright that they may stop with overlaps left (a time or iteration limit). Our network layouts end with no two items touching, by construction, and a test checks it (`test/layout.test.js`). This is the strongest practical difference between this app and everything compared here; see the table in `docs/BENCHMARKS.md`, section 12.
- Two ideas from the papers were tried and did **not** help our version (pivot weights by region size; a coarse-first "multilevel" start). One simple change that follows from the same reasoning did: many more near neighbors per item and a gentler weight on the far pivot terms. Details below.

## Layout: stress, force and friends

| Package and function | Method | What the manual or paper says | What we do |
|---|---|---|---|
| `graphlayouts::layout_with_stress` | Stress majorization with a classical-MDS start (Gansner, Koren and North 2004) | `iter` 500, stop when the change is below 1e-4, all pairs | All pairs up to 4,000 items (stochastic gradient descent with a decreasing step, Zheng, Pawar and Goodman 2018). Not timed against R: R was not run here |
| `graphlayouts::layout_with_sparse_stress` | Pivots plus link terms, majorization (Ortmann et al. 2016) | `pivots` is the number of pivots, `iter` 500 (the paper capped at 200); per-iteration cost O(kn + m); within a few percent of full stress at 200 pivots on most test graphs, 19% worse on one (`lpship04l`); one to two orders of magnitude faster than full stress | Same family above 4,000 items, plus up to 100 near neighbors per item |
| `graphlayouts::layout_with_pmds` | Pivot MDS (Brandes and Pich 2006) | Fast, rougher | Not used. Its use as a start position for sparse stress is the one idea from the paper we have not tried |
| `graphlayouts::layout_with_focus`, `layout_with_centrality` | Radial layouts from a convex mix of stress and constrained stress (Brandes and Pich 2011) | Rings by distance from a focus or by centrality | We have Radial tree and Rings by importance (simpler, no stress mix) |
| `graphlayouts::layout_as_backbone` | Lay out the most strongly embedded 20% of links, then add the rest back (Nocaj, Ortmann and Brandes 2015) | Shows hidden groups | Not used; our Found groups colors the groups instead |
| `igraph::layout_with_graphopt` | Charges and springs, no cooling | "Scales relatively well"; results depend on the start and are not guaranteed stable | Our Force arrangement (Barnes-Hut repulsion, cooling) |
| `igraph::layout_with_drl` | DrL (Martin et al. 2008): six stages (init, liquid, expansion, cooldown, crunch, simmer), optional edge cutting | Meant for large graphs; the 3D version is much slower | Not used |
| `igraph::layout_with_kk`, `layout_with_mds`, `sna` layouts | Kamada-Kawai, classical MDS | All pairs, so small graphs | Superseded by Stress |

### What was tried from this reading, and what happened

All numbers are the sampled truth score (lower is truer) on a 10,000-item network with 3 links per item, same seed, Node 22. The baseline before today was 0.220.

| Idea | Result | Kept? |
|---|---|---|
| Weight each pivot term by the number of items near that pivot, as in the sparse stress paper | 0.204 to 0.27 (the big weights make plain gradient descent jump around; the paper uses majorization, which is stable with such weights) | No |
| Coarse-first (multilevel): lay out the 1,500 farthest-apart items on their true distances, place the rest by their neighbors, then refine | 0.220 to 0.221 at twice the time. The score was limited by local detail, not by the global shape | No |
| Streaming: draw fresh random source items every sweep instead of keeping a fixed pair list | 0.227 to 0.238 | No |
| Mix random pivots with the farthest-apart ones | 0.209 to 0.216 | No |
| **More near neighbors per item (100, was 16) and pivot terms at 0.3 of the normal weight** | **0.204** at 1.0 to 1.7 s; at 5,000 items 0.235 to 0.199, at 3,500 items 0.234 to 0.189 | **Yes** |
| All pairs at 10,000 items (the floor for this method) | 0.160 but 18.6 s | No (too slow) |
| All pairs at 4,000 items instead of 3,000 | 0.156 at about 3 s, against 0.204 sparse | **Yes** (limit raised to 4,000) |

The reading behind the keeper: the truth score divides each pair's error by its squared hop distance, so near pairs matter most per pair, and sampling only 16 near neighbors left them under-represented.

## Overlap removal

| Package | Method | Guarantee |
|---|---|---|
| `ggrepel` (`force`, `force_pull`, `max.iter` 10,000, `max.time` 0.5 s, `max.overlaps` 10) | Repulsion between labels plus a pull back to the data point | None stated. Labels that overlap too many others are dropped from the plot |
| `packcircles::circleRepelLayout` | Push overlapping circles apart until nothing moves or an iteration cap is reached | Convergence implies no overlap, but it can fail |
| `packcircles::circleProgressiveLayout` | Front-chain packing (Wang et al. 2006) | Non-overlapping by its placement rule, but it places new circles; it does not keep a given layout |
| `packcircles::circleRemoveOverlaps` | Keeps positions and chooses a non-overlapping subset | By design, by dropping circles |
| Ours | Push-apart passes; if any pair still touches, stretch the whole picture 10% (the truth score ignores overall scale) and repeat up to 12 times; then move each remaining item to the nearest free spot on an outward spiral | **No two items touch, ever** (the last step cannot place an item onto another) |

## Random numbers

`rnorm` in R uses inversion (Wichura's AS 241). The `dqrng` package draws normals with the ziggurat algorithm from Boost on a Xoroshiro128+ generator and reports about 9× faster normals than `rnorm` for 10 million draws (and about 7× for uniform and exponential draws). Our `sim.js` uses the Marsaglia and Tsang (2000) ziggurat with 128 layers on a 32-bit mulberry generator, exact tail method, same seed gives the same numbers. One million normals: 21 ms in Chromium 154, against 52 ms for d3-random and 43 ms for jStat (see `docs/BENCHMARKS.md`, section 14).

## Not studied

`smacof` (de Leeuw and Mair 2009): the paper's landing page confirms majorization with constraints; the details were not read. `Rtsne` and `uwot` are embeddings for point data, not for networks with links. Community detection (`igraph::cluster_leiden` and friends) was covered in the earlier comparison (`docs/RESEARCH-open-source-comparison.md`).

## Sources

- [graphlayouts reference manual (CRAN)](https://cran.r-project.org/web/packages/graphlayouts/refman/graphlayouts.html)
- [A Sparse Stress Model, Ortmann, Klimenta and Brandes (arXiv 1608.08909)](https://arxiv.org/pdf/1608.08909)
- [igraph R: layout_with_graphopt](https://igraph.org/r/doc/layout_with_graphopt.html) and [layout_with_drl](https://igraph.org/r/doc/layout_with_drl.html)
- [packcircles README (CRAN)](https://ftp.fau.de/cran/web/packages/packcircles/readme/README.html)
- [ggrepel: geom_text_repel](https://rdrr.io/cran/ggrepel/man/geom_text_repel.html)
- [Fast Random Numbers for R with dqrng (R-bloggers)](https://www.r-bloggers.com/2018/04/fast-random-numbers-for-r-with-dqrng/)
- [Multidimensional Scaling Using Majorization: SMACOF in R (J. Stat. Software)](https://www.jstatsoft.org/article/view/v031i03)
