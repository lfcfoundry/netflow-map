# Netflow Map: first release vs current

Copyright (c) 2026 LFC Foundry. MIT License.

First release = build 2026.10.14.2136 (commit 48df84a). Current = build 2026.10.17.2238 and later (page built 2026.10.17.2327). Measured 2026-10-18 in Firefox 158.0, ungoogled-chromium 155.0.8059.39-1, WebKitGTK 2.52.6 and GNOME Web (Epiphany) 46.5, one browser at a time, the two versions taking turns in fresh pages or fresh workers. No Node timings.

Tester for your laptop: `bench/netflow-map-then-and-now.html` (one file, one button, plain verdict, Copy results). Run by hand: `node bench/then-and-now/run.js chromium|firefox|webkit|epiphany [quick] [nobig] [huge]`; whole app: `node bench/then-and-now/app-probe.js <browser> 10000[,30000] [turns]` with `NFM_OLD` pointing at `git show 48df84a:index.html`.

## Layout time (lower is better; times faster, higher is better)

Small-map rows in Chromium and Firefox are the typical of 3 runs; all other cells are one run, so differences under about 15% are noise.

| Map | Chromium 155 | Firefox 158 | WebKitGTK 2.52.6 | GNOME Web 46.5 |
|---|---|---|---|---|
| Network, 30,000 items | 33.9 s to 1.55 s (22x) | at least 60 s to 1.47 s (41x or more) | at least 60 s to 1.44 s (42x or more) | at least 60 s to 1.24 s (49x or more) |
| Network, 10,000 items | 4.10 s to 798 ms (5.1x) | 10.7 s to 795 ms (13x) | 6.99 s to 558 ms (13x) | 6.90 s to 628 ms (11x) |
| Network, 3,000 items | 924 to 942 ms (1.0x) | 1.55 s to 947 ms (1.6x) | 1.25 s to 1.04 s (1.2x) | 1.22 s to 999 ms (1.2x) |
| Network, 1,000 items | 255 to 139 ms (1.8x) | 448 to 139 ms (3.2x) | 420 to 174 ms (2.4x) | 386 to 201 ms (1.9x) |
| Flow, 1,000-page story | 24 to 26 ms (0.9x) | 26 to 27 ms (1.0x) | 34 to 36 ms (0.9x) | 39 to 42 ms (0.9x) |
| Top-down, 5,000-page story | 151 to 159 ms (0.9x) | 139 to 164 ms (0.8x) | 201 to 172 ms (1.2x) | 276 to 231 ms (1.2x) |

"At least" means the first release hit the page's 60 second cap and had not finished.

## Whole app, 10,000 items, one run each

| Browser | Finished map (lower is better) | Panning FPS (higher is better) |
|---|---|---|
| Chromium 155 | 5.2 s to 1.28 s (4.1x faster) | 3.6 to 3.9 (about the same) |
| Firefox 158 | 12.6 s to 0.96 s (13x faster) | 8.9 to 16.3 (1.8x higher) |
| WebKitGTK 2.52.6 | 7.95 s to 1.04 s (7.6x faster) | 8.5 to 12.6 (1.5x higher) |
| GNOME Web 46.5 | 8.6 s to 1.7 s (5.0x faster) | 9.1 to 12.1 (1.3x higher) |

At 30,000 items in Chromium 155: finished map 40.1 s to 2.83 s (14x faster), panning 1.2 to 1.6 FPS. Absolute FPS depends on the machine; only the ratio carries over.

## Memory (Chromium 155 exact page heap after a forced cleanup, MB, lower is better; worker not included)

| Map | Just built | 6 s idle |
|---|---|---|
| Network, 10,000 items | 30 to 42 | 43 to 45 |
| Network, 30,000 items | 89 to 121 | 128 to 131 |

Plain takeaway: no memory gain at these sizes (slightly more, because the app now keeps chapters, a mini-map and a link look-up). Savings come on very big maps: at 100,000 items packing idle links saves 67 MB (402 to 335 MB) against the build just before that step. The first release was not run at 100,000 items (it needs minutes), so there is no first-release figure there. Firefox, WebKitGTK and GNOME Web give no exact heap numbers, so memory is Chromium only.

## With the compressor (memory-compression 2.0.1), added 2026-10-18

Chromium 155 exact page heap, flat Force map left alone 9 s, build before the compressor against the build with it (MB, lower is better):

| Map | Without | With | Change | Cost to wake the links |
|---|---|---|---|---|
| 30,000 items | 101.8 | 93.1 | -8.7 (-8.5%) | 192 ms |
| 100,000 items | 331.5 | 295.7 | -35.8 (-10.8%) | 490 ms |

The module costs the page about 8 MB of its own, so the 30,000-item saving is smaller than the 17.5 MB the packed links alone free. Page file 754 to 926 KB. Not packed because it frees nothing or costs more than it saves: layout items (+3.9 MB, the picture points at them), graph links with look-up tables (-14 MB at 30,000 items, but every click rebuilds them), undo steps (under 1 MB each).

Tester part "Idle memory of the layout links" (made-up maps, very regular, so they pack to 99% smaller; real data will be less dramatic), one run each, lower is better in size and time:

| Browser | Map | Links | As objects (est.) | Packed | Pack time | Wake time | Exact |
|---|---|---|---|---|---|---|---|
| Chromium 155 | 10,000 | 30,951 | 7.8 MB | 0.1 MB | 43 ms | 25 ms | yes |
| Chromium 155 | 30,000 | 93,185 | 24 MB | 0.3 MB | 99 ms | 67 ms | yes |
| Firefox 158 | 10,000 | 30,951 | 7.8 MB | 0.1 MB | 48 ms | 33 ms | yes |
| Firefox 158 | 30,000 | 93,185 | 24 MB | 0.3 MB | 100 ms | 85 ms | yes |
| WebKitGTK 2.52.6 | 10,000 | 30,951 | 7.8 MB | 0.1 MB | 46 ms | 31 ms | yes |
| WebKitGTK 2.52.6 | 30,000 | 93,185 | 24 MB | 0.3 MB | 72 ms | 90 ms | yes |
| GNOME Web 46.5 | 10,000 | 30,951 | 7.8 MB | 0.1 MB | 48 ms | 23 ms | yes |
| GNOME Web 46.5 | 30,000 | 93,185 | 24 MB | 0.3 MB | 108 ms | 99 ms | yes |

Checks: Chromium 170, Firefox, WebKitGTK and GNOME Web 159 each (4 new), picture identical byte for byte after park and wake in all four.

## New since the first release

Link hover (first hover on 30,000 items, lower is better: Chromium 155 316 ms, Firefox 158 279 ms, WebKitGTK 2.52.6 77 ms, GNOME Web 46.5 134 ms), early rough picture for big maps, multilevel layout for huge networks, look-only layout reuse (100,000 items 6.2 s to 2.6 s), Top-down options (story order, chapters, mini-map, bundled and tapered links), idle layout worker rest after 4 s on 20,000+ items.

## Plain verdict

Big networks are the story: 10,000 items 5x to 13x faster to lay out, 30,000 items 22x to 49x or more, and the drawing is 1.3x to 1.8x higher FPS in three of four browsers (about the same in Chromium). Small maps, Flow and Top-down are about the same, with Top-down on 5,000 pages about 25 ms slower in Firefox. Memory is about the same at 10,000 and 30,000 items.
