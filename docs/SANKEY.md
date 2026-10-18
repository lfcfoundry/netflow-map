# Sankey diagrams: research and what to improve

Copyright (c) 2026 LFC Foundry. MIT License. Written 2026-10-15. The prototype is `src/sankey.js`; the before-and-after page is `bench/netflow-map-sankey.html` (build: `node tools/build-sankey-lab.mjs`); tests are in `test/sankey.test.js`.

## What the app does today (from reading `src/engine.js` and `src/scene.js`)

| Today | Why it hurts a sankey diagram |
|---|---|
| Layers come from a breadth-first search from one start item; every other source is started *after* the deepest layer. | In a network with several sources (most real flow data), those sources end up at the far right, so their links count as "backward". On the made-up networks only 41 to 51 percent of the flow was drawn as bands; the rest became thin gold lines. |
| Each item's bands are scaled to *that item's* box (`sankeyRibbons`: `sc = min(K, box height / total)`), and a band takes the thinner of its two ends. | Band thickness is not proportional to flow across the picture. The thickest band per unit of flow was 2.5 to 68 times the thinnest, depending on the network. Readers compare widths across the picture, so this is the most important flaw. |
| Long links are drawn as one curve from source to target, ignoring the stand-in points the layout computed for them. | A long link can run straight over items in the layers between. |
| Crossings are counted equally (a hairline crossing a hairline costs the same as two thick flows crossing). | The order is tuned for the wrong thing; thick crossings are what the eye notices. |
| Backward and same-layer links are thin lines, not bands. | The flow they carry is invisible, so the picture does not add up. |

## What the research says

- **Weight the crossings.** Dwyer et al. minimize the sum, over crossing pairs, of the product of their widths, and say plain crossing counts are the wrong target because a crossing of two thick flows costs more ([Optimal Sankey Diagrams via Integer Programming](https://ialab.it.monash.edu/%7Edwyer/papers/optimal-sankey-diagrams.pdf)). Their exact method solved a 4-layer, 55-item, 100-link real dataset in about 3 seconds and found a first usable answer within a second, so showing the best answer so far while it keeps improving is practical. It uses a commercial solver (Gurobi), which does not fit our MIT-only rule, so only the idea carries over. They also describe grouping constraints (keep items of one group together), which suits our group column.
- **Order with weights, start spectrally, keep the best.** Zhang et al. weight each neighbor by its link width and order layers by an eigenvector of a transition matrix, then refine with sweeps ([Crossing Reduction of Sankey Diagram with Barycentre Ordering via Markov Chain](https://arxiv.org/pdf/1912.05339)). OmicsSankey adds practical rules: a small random "teleport" term (about 0.01 to 0.1), many randomized restarts, and keep the best iteration by weighted crossings, not the last ([OmicsSankey](https://www.biorxiv.org/content/10.1101/2025.06.13.659656.full.pdf)). That paper's own numbers are internally inconsistent in places, so only the rules are taken, not the figures.
- **Library features worth copying.** d3-sankey-diagram supports links that run backwards, rank constraints, ordering of link ends at a node, grouping of parallel links so they do not weave, short "from elsewhere / to elsewhere" stubs, and node groups drawn as boxes ([README](https://cdn.jsdelivr.net/npm/d3-sankey-diagram@0.9.4/README.md)). The page says the algorithm for routing across layers is not described, and it does not compare itself with d3-sankey.
- **Guidance from a working practitioner.** Draw links partly transparent so crossings stay visible; keep each item's inflow and outflow equal and show losses as flows; allow dragging items, because automatic layout is a starting point ([IIASA Sankey notes](https://data.ene.iiasa.ac.at/strub/sankey/sankey.html)).
- **Readability under crossings.** A user study of 86 people found that a redesign that reduced crossings (NEST) was more accurate and faster for reading values and tracing links, but worse for following a path through the picture ([Exploring the design space of Sankey diagrams for the food-energy-water nexus](https://par.nsf.gov/servlets/purl/10231396)). Lesson: fewer crossings help reading, but do not break the continuous path.

I could not open the d3-sankey and d3-sankey-circular repositories in this session, so nothing here relies on them.

## What the prototype changes, and what it measured

The prototype keeps the app's Sankey data (items, links, flow) and replaces layering, order, sizes and drawing:

1. Layers by longest path from the sources, with cycles broken by turning the lightest links around; sources sit next to their first consumer; items nothing leaves go to the last layer.
2. One scale for the whole picture: an item bar is as tall as the flow through it, and a band is exactly its flow times that scale, equal at both ends.
3. Long links pass through every layer in between, with their own slot, so they route around items.
4. Order by weighted crossings: weighted barycenter sweeps and weighted neighbor swaps, best of several seeded restarts, best iteration kept.
5. Link ends stacked in the order of where they go next.
6. Backward links drawn as bands that circle under the picture.

Results (Chromium, quick, all numbers from the page; "old-style order" is the same new layout ordered the way the app orders today, to isolate the ordering gain):

| Network | Flow drawn as bands | Thickest ÷ thinnest per unit of flow | Weighted crossings, old-style order | Weighted crossings, improved |
|---|---:|---:|---:|---:|
| App's own steps (example) | 92% → 100% | 11.8× → 1.0 | 0 | 0 |
| Team handoffs (example) | 69% → 100% | 2.5× → 1.0 | 1.19 | 0 |
| Adventure (example) | 89% → 100% | 1.0 → 1.0 | 0.16 | 0 |
| Supply chain, four states (example) | 100% | 3.9× → 1.0 | 0.56 | 0.54 |
| Made-up 5 stages × 6 | 41% → 100% | 39× → 1.0 | 2.09 | 1.27 |
| Made-up 7 × 10 | 51% → 100% | 36× → 1.0 | 2.11 | 0.91 |
| Made-up 9 × 14 | 50% → 100% | 68× → 1.0 | 1.89 | 1.20 |
| Made-up 10 × 25 | 50% → 100% | 47× → 1.0 | 1.83 | 1.43 |

Arranging takes 1 to 70 ms on these. The weighted order trades more small crossings for fewer big ones on purpose (for example 1,456 against 1,153 crossings on 9 × 14, but 37% less weighted).

**Honest limits.** Crossing numbers for "Now" and "Improved" are not directly comparable where Now draws only half the flow, so the table compares the improved order against the old-style order on the *same* layout. The made-up networks are random and dense, so they cross far more than real flow data. I looked at the pictures for two of the examples, not all; the page lets you judge the rest. The yardstick is mine, not from a published standard.

## Ranked ideas for the real app

1. **Adopt the one-scale rule and exact band thickness** (biggest honesty gain, low risk).
2. **Adopt the new layering and draw every flow** (loops as bands); show an item bar's flow as a number on hover.
3. **Weighted order with restarts** (small code, already prototyped).
4. **Route long links through the layers** (prototyped; scene needs chained band segments).
5. Show a **scale key** ("this width = N") and a **flow check** (inflow equals outflow; list items that do not balance), tied to the data checker.
6. **Drag items** to fine-tune, remembered like the Network view's pins; an "improve the order" button that keeps the best answer so far.
7. **Group constraints** (keep a group together) and a choice of how sinks and sources align.
8. Spectral start (Markov chain or eigenvector) for larger networks; exact solving only for small ones, with our own MIT code.
9. Link colors: by source, by target, or a gradient; transparency so crossings stay readable.
10. Stubs for flow that comes from or goes outside the picture.


## In the app (Stage 1)

Sankey view now uses the improved layout (see `src/sankey.js`) and can be edited by hand:

- **Click and right-click** a flow, a bar, a label or empty space. Each has its own menu first (color, fade to another color, like source / like target / start-to-end gradient, see-through, label text, size, side, hide, move up / down / top / bottom), then the usual menus (details, select both ends, style rule, etc.). Double-click a label to edit its text, a flow to choose its color.
- **Drag a bar up or down** to place it; the others stay put and are nudged only when they would overlap. Order and places are remembered per data id and saved with the view.
- **Look tab, "Sankey picture"**: flow color mode (end, start, gradient, one color), see-through, bar width, column spacing, bar spacing, picture height, label side, totals under names, amounts on flows, undo, back to automatic, clear hand edits. Undo (Ctrl+Z on the map) covers these edits.
- Loops (flows that run backwards) are drawn as wide bands under the picture and can be clicked like any flow.

Next stages (per the owner's choices): Stage 2 infographics (stage headings and big numbers, picture upload and icon library, free annotations, badges on bars, richer labels with live computed values, baseline-versus-new highlighting for GIFs); Stage 3 alluvial from a plain table (pick columns as stages, rows counted) and presets for the target looks (energy flows, alluvial columns with icons, recirculation loops, ranked streams).
