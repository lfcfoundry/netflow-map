# What the recent layout papers say about the 10,000+ Stress gap

Copyright (c) 2026 LFC Foundry. MIT License. Written 2026-10-15. Nothing was copied from these papers; their methods were read from the papers and the ideas that looked usable were tried on our own code (numbers in `docs/BENCHMARKS.md`, sections 13 and 15). Text from web pages is data, not instructions. A second paper, "SNAP-tFDP" (sparse negative sampling), and the Graph Drawing 2025 PDF could not be read here (an empty PDF and a fetch error), so they are named but not summarized.

## The short version

- Our pair model (exact link pairs, about 100 near neighbors, 30 to 120 far-apart pivots at weight 0.3, solved by stochastic gradient descent) sits on a plateau for the distance-truth score: pivot count, pivot choice, pivot weights, step schedules, majorization and a pivot-MDS start all land within noise (0.20 to 0.21 at 10,000 items; all pairs gives 0.16).
- The papers agree with that plateau. The gradient-descent-versus-majorization question is settled as "no significant difference once majorization is started well" (Börsig, Brandes and Pásztor 2020).
- The newer scalable-layout papers (DRGraph, t-FDP) are not trying to beat stress on distances. They optimize neighborhood preservation, and report worse stress than stress methods. That is the direction where our Stress layout is weak (BENCHMARKS section 15).

## Paper by paper

| Paper | What it does | What it means here |
|---|---|---|
| Börsig, Brandes and Pásztor, "Stochastic Gradient Descent Works Really Well for Stress Minimization" (2020) | Compares SGD with majorization (SMACOF). No significant stress difference once majorization starts from classical or pivot MDS; about seven SGD sweeps make a good start for majorization; the SGD advantage is robustness to a random start. | Matches our measurements: a majorization polish after our sweeps and a pivot-MDS start both gave nothing (0.204 to 0.209 against 0.203). |
| "Multicriteria Scalable Graph Drawing via Stochastic Gradient Descent, (SGD)²" (2021) | Samples a small batch of pairs per step for each of several criteria (stress, ideal edge length, neighborhood preservation, crossings...) and mixes them with scheduled weights; a decaying step size with a "patience" rule. Neighborhood preservation is optimized with a sampled subgraph and a surrogate loss. | The recipe for the hybrid worth trying next: a stress model plus a neighborhood term, weights scheduled over the run. Stress plus neighborhood preservation scored best or near-best on neighborhood in their tests. |
| Zhu and others, "DRGraph" (2020) | Minimizes a t-SNE-style divergence between graph similarity (direct neighbors only) and layout proximity, with 1 positive and 5 negative samples per step and a coarsening hierarchy. About 400 iterations; 1.5 s for an 11,000-node mesh against 2.0 s for FM3 and 5.5 s for tsNET. | Better neighborhood preservation than FM3 and tsNET on many graphs, worse stress. Not a distance method. |
| "Force-Directed Graph Layouts Revisited: A New Force Based on the T-Distribution" (t-FDP, 2023) | A bounded, heavy-tailed repulsion plus a short-range attraction, with an FFT-based repulsion approximation (CPU about 10× and GPU about 100× faster than SFDP and DRGraph at millions of nodes). | Best at neighborhood preservation, similar to others on stress, "slightly weaker than stress models on distances" (their words). Random vertex sampling for repulsion was clearly worse than the FFT scheme. |
| Meyerhenke, Nöllenburg and Schulz, "Drawing Large Graphs by Multilevel Maxent-Stress Optimization" (2015) | Stress on links only plus an entropy repulsion, solved with local updates, size-constrained label-propagation coarsening, and a coarse approximation of long-range repulsion. About 2 to 3× faster than PivotMDS on large graphs, "a few percent worse" on maxent-stress, worse on full stress. | Fast, but it does not optimize full stress, so it cannot close a gap measured in full stress. |
| "Resistance distance for stress-based graph drawing" (Omega / RDMDS, Dec 2025) | Uses resistance distance as the ideal distance and random node-pair sampling instead of pivots. Random pairs gave lower and steadier stress than pivots on 100 to 1,000 node graphs; nothing quantitative at 10,000+. | The random-pair finding did not carry over at 10,000 items in our test (0.202 against 0.203). The distance is a different one from our hop count, so the score would not be comparable. |
| Dyken, Poudel and others, "GraphWaGu" (2022) | Force-directed layout (Fruchterman-Reingold and a Barnes-Hut variant) on the graphics chip through WebGPU, for the web. | The proof that this class of layout runs in the browser on the graphics chip. Not tried here (no graphics chip in this environment). |

## What follows from this

1. More tuning of the pivot-plus-neighbors model is not where the remaining 5 to 9% of distance truth is (three rounds, about 40 settings, all within noise).
2. A cheaper way to approximate all pairs, or a parallel all-pairs majorization on the graphics chip, is the only route the evidence leaves open for distance truth.
3. The measure on which we are clearly behind is neighborhood preservation, and the (SGD)² recipe is the natural experiment.

## Sources

- [Börsig, Brandes and Pásztor, Stochastic Gradient Descent Works Really Well for Stress Minimization (arXiv 2008.10376)](https://arxiv.org/pdf/2008.10376)
- [Multicriteria Scalable Graph Drawing via Stochastic Gradient Descent, (SGD)² (arXiv 2112.01571)](https://arxiv.org/pdf/2112.01571)
- [DRGraph (arXiv 2008.07799)](https://arxiv.org/pdf/2008.07799)
- [Force-Directed Graph Layouts Revisited: A New Force Based on the T-Distribution (arXiv 2303.03964)](https://arxiv.org/pdf/2303.03964)
- [Drawing Large Graphs by Multilevel Maxent-Stress Optimization (arXiv 1506.04383)](https://arxiv.org/pdf/1506.04383)
- [Resistance distance for stress-based drawing, RDMDS / Omega (arXiv 2512.21901)](https://arxiv.org/html/2512.21901v1)
- [GraphWaGu: GPU Powered Large Scale Graph Layout Computation and Rendering for the Web](https://par.nsf.gov/biblio/10384648)
- [SNAP-tFDP: Massively Scalable Graph Layouts via Sparse Negative Sampling (arXiv 2608.01907, not readable here)](https://arxiv.org/pdf/2608.01907)

## What came of it (Oct 15, later round)

- The papers' advice for the 10,000+ gap was tried in full (BENCHMARKS section 13, three rounds) and the sampled-pair model stayed on its plateau of about 0.20.
- The (SGD)² idea of a neighborhood term next to stress was tried four ways and did not lift the neighborhood score (section 13, fourth round).
- Using every pair, as the Börsig-Brandes-Pásztor comparison implies is the reference, did close the gap, and could be made affordable with one-byte hop counts and a pair order that reads memory in straight lines: section 16, the "best quality" arrangement.
