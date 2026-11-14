# Credits: the ideas Netflow Map is built on

Copyright (c) 2026 LFC Foundry. MIT License.

Netflow Map's code is our own, written for this app. The methods below come from other people's work. Each row names the idea, who first published or built it, where it is used here, and links to the paper, project or page. Nothing here was copied from the projects listed as "measured against"; those are only timed or compared. Link check: `node tools/credits-check/check.mjs` (see the end of this page for what it can and cannot confirm).

## Layered drawing (Flow, Top-down, Spine, Lanes, Arc, Matrix views)

| Idea | Original work and authors | Where it is used | Link |
|---|---|---|---|
| Layered ("Sugiyama-style") drawing: rows by distance from the start, an order inside each row, then places | K. Sugiyama, S. Tagawa and M. Toda, "Methods for Visual Understanding of Hierarchical System Structures", IEEE Trans. Systems, Man, and Cybernetics, 1981 | netflow-layers (vendored from JS-modules): every layered view | [doi:10.1109/TSMC.1981.4308636](https://doi.org/10.1109/TSMC.1981.4308636) |
| The dot way of drawing directed graphs: rows, crossing reduction by sweeps, placement | E. Gansner, E. Koutsofios, S. North and K.-P. Vo, "A Technique for Drawing Directed Graphs", IEEE Trans. Software Engineering, 1993 (the paper behind Graphviz dot) | the same layered views; Graphviz is also one of the rivals we measure against | [doi:10.1109/32.221135](https://doi.org/10.1109/32.221135), [Graphviz](https://graphviz.org/) |
| Median ordering of rows | P. Eades and N. Wormald, "Edge Crossings in Drawings of Bipartite Graphs", Algorithmica, 1994 | netflow-layers (the median rounds of the order search) | [doi:10.1007/BF01187020](https://doi.org/10.1007/BF01187020) |
| Sifting: slide each item to its best place in its row, `sift` option (Crossing search: Sift) | C. Matuszewski, R. Schönfeld and P. Molitor, "Using Sifting for k-Layer Straightline Crossing Minimization", Graph Drawing 1999 | netflow-layers 1.13.0 `sift`; setting Crossing search: Sift | [doi:10.1007/3-540-46648-7_22](https://doi.org/10.1007/3-540-46648-7_22) |
| Place boxes by aligned blocks (horizontal coordinate assignment) | U. Brandes and B. Köpf, "Fast and Simple Horizontal Coordinate Assignment", Graph Drawing 2001; used by ELK and dagre | measured against only (ELK, dagre use it; we place rows our own way) | [doi:10.1007/3-540-45848-4_3](https://doi.org/10.1007/3-540-45848-4_3) |
| Break cycles by turning the lightest backward links around | P. Eades, X. Lin and W. F. Smyth, "A Fast and Effective Heuristic for the Feedback Arc Set Problem", Information Processing Letters, 1993 | netflow-sankey (layers of the Sankey) | [doi:10.1016/0020-0190(93)90079-O](https://doi.org/10.1016/0020-0190%2893%2990079-O) |
| Choke points (every route passes them) as a dominator tree | K. D. Cooper, T. J. Harvey and K. Kennedy, "A Simple, Fast Dominance Algorithm", Rice University TR-06-33870 (2001); the older method is T. Lengauer and R. E. Tarjan, "A Fast Algorithm for Finding Dominators in a Flowgraph", ACM TOPLAS, 1979 | `src/engine.js`: choke points, the Top-down and Flow views | [Lengauer and Tarjan, doi:10.1145/357062.357071](https://doi.org/10.1145/357062.357071); [Cooper, Harvey, Kennedy (Internet Archive copy)](https://web.archive.org/web/2020/https://www.cs.rice.edu/~keith/EMBED/dom.pdf) |
| Strongly connected pieces without recursion | R. E. Tarjan, "Depth-First Search and Linear Graph Algorithms", SIAM J. Computing, 1972 | `src/engine.js` (loop and piece finding) | [doi:10.1137/0201010](https://doi.org/10.1137/0201010) |

## Flow diagrams (Sankey)

| Idea | Original work and authors | Where it is used | Link |
|---|---|---|---|
| Sankey diagram: band width is the amount | Captain Matthew Henry Phineas Riall Sankey, steam-engine energy diagram, 1898 | the Sankey view, netflow-sankey | [Sankey diagram (Wikipedia)](https://en.wikipedia.org/wiki/Sankey_diagram) |
| Sankey layout with bars in layers and bands between them | d3-sankey by Mike Bostock (BSD-3-Clause) | measured against in the rival race; netflow-sankey is our own code with different order search and routing | [d3-sankey on GitHub](https://github.com/d3/d3-sankey) |
| A Sankey chart drawn on a canvas | Apache ECharts (Apache-2.0) | measured against only | [ECharts](https://echarts.apache.org/) |

## Placement of networks (Network, Force, Distances views)

| Idea | Original work and authors | Where it is used | Link |
|---|---|---|---|
| Distances as stress minimized by stochastic gradient descent, with pivot items for big maps | J. X. Zheng, S. Pawar and D. F. M. Goodman, "Graph Drawing by Stochastic Gradient Descent", IEEE TVCG, 2019 | `src/engine.js`: Distances arrangement | [arXiv:1710.04626](https://arxiv.org/abs/1710.04626), [doi:10.1109/TVCG.2018.2859997](https://doi.org/10.1109/TVCG.2018.2859997) |
| Stress majorization (the "best quality" Distances on the graphics card) | E. Gansner, Y. Koren and S. North, "Graph Drawing by Stress Majorization", Graph Drawing 2004 | `src/gpustress.js` | [doi:10.1007/978-3-540-31843-9_25](https://doi.org/10.1007/978-3-540-31843-9_25) |
| Forces: items repel, links pull like springs | T. Fruchterman and E. Reingold, "Graph Drawing by Force-Directed Placement", Software: Practice and Experience, 1991; also T. Kamada and S. Kawai, 1989 | `src/engine.js`: Force arrangement | [doi:10.1002/spe.4380211102](https://doi.org/10.1002/spe.4380211102), [Kamada and Kawai, doi:10.1016/0020-0190(89)90102-6](https://doi.org/10.1016/0020-0190%2889%2990102-6) |
| Barnes-Hut repulsion (quadtree in 2D, octree in 3D) | J. Barnes and P. Hut, "A hierarchical O(N log N) force-calculation algorithm", Nature, 1986 | `src/engine.js`: Force arrangement | [doi:10.1038/324446a0](https://doi.org/10.1038/324446a0) |
| ForceAtlas2 and d3-force | M. Jacomy, T. Venturini, S. Heymann and M. Bastian, ForceAtlas2, PLOS ONE, 2014; M. Bostock, d3-force | measured against only | [doi:10.1371/journal.pone.0098679](https://doi.org/10.1371/journal.pone.0098679), [d3-force](https://github.com/d3/d3-force) |
| Quick groups by label propagation | U. N. Raghavan, R. Albert and S. Kumara, "Near linear time algorithm to detect community structures in large-scale networks", Physical Review E, 2007 | `src/engine.js`: groups for data with no group column | [doi:10.1103/PhysRevE.76.036106](https://doi.org/10.1103/PhysRevE.76.036106) |
| Louvain communities | V. Blondel, J.-L. Guillaume, R. Lambiotte and E. Lefebvre, "Fast unfolding of communities in large networks", J. Stat. Mech., 2008 | measured against only | [doi:10.1088/1742-5468/2008/10/P10008](https://doi.org/10.1088/1742-5468/2008/10/P10008) |

## Trees, circles and charts

| Idea | Original work and authors | Where it is used | Link |
|---|---|---|---|
| Squarified treemap | M. Bruls, K. Huizing and J. van Wijk, "Squarified Treemaps", 2000 | netflow-hierarchy (Treemap) | [doi:10.1007/978-3-7091-6783-0_4](https://doi.org/10.1007/978-3-7091-6783-0_4), [paper (TU Eindhoven)](https://www.win.tue.nl/~vanwijk/stm.pdf) |
| Tidy tree in linear time | E. Reingold and J. Tilford, "Tidier Drawings of Trees", IEEE TSE, 1981; C. Buchheim, M. Jünger and S. Leipert, "Improving Walker's Algorithm to Run in Linear Time", Graph Drawing 2002 | netflow-hierarchy (Tree) | [doi:10.1109/TSE.1981.234519](https://doi.org/10.1109/TSE.1981.234519), [doi:10.1007/3-540-36151-0_32](https://doi.org/10.1007/3-540-36151-0_32) |
| Hierarchical edge bundling | D. Holten, "Hierarchical Edge Bundles", IEEE TVCG, 2006 | netflow-circular (Bundles) | [doi:10.1109/TVCG.2006.147](https://doi.org/10.1109/TVCG.2006.147) |

## Where the credits are in the code
Each module's file header names its method and authors where it applies (netflow-layers, netflow-sankey, netflow-hierarchy and netflow-circular are vendored from [JS-modules](https://github.com/lfcfoundry/JS-modules), where their own READMEs carry the same credits). `src/engine.js` and `src/gpustress.js` name theirs next to each method. The wider reading behind the layouts is in `docs/RESEARCH-layout-papers.md`, `docs/RESEARCH-r-packages.md` and `docs/RESEARCH-open-source-comparison.md`.

## Measured against, not used
Graphviz, ELK.js, dagre, d3-sankey, ECharts, Plotly, d3-force, ForceAtlas2, Louvain, Cytoscape, Papa Parse and the other tools named under Benchmarks are timed and compared; none of their code is in `index.html`. Thank you to their authors: [ELK](https://eclipse.dev/elk/) (Eclipse Layout Kernel, Kiel University), [dagre](https://github.com/dagrejs/dagre) (Chris Pettitt and contributors), [Graphviz](https://graphviz.org/) (AT&T Research and contributors).

## Link check
`node tools/credits-check/check.mjs` reads every link on this page and reports each one that does not answer. It asks each DOI through Crossref (title and first author must match the row), and every other link directly. Some publishers and GitHub answer automated checks with 403, 429 or 202; those are listed as "could not confirm" instead of passing, so a person or the GitHub Action can check them with a normal browser.
