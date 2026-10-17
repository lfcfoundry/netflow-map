# Memory at 100,000 items: what was measured and what was ruled out

Copyright (c) 2026 LFC Foundry. MIT License.

Handoff for anyone building a memory compressor or a leaner scene for Netflow Map. Everything here was measured in Node 22 with `--expose-gc` on 2026-10-17 unless it says otherwise. Code lives in `src/scene.js` (`make`, `networkScene`, `makeRig`), `src/render.js` (`tessellate`, the renderers' `setScene`) and `src/app/30-map.js` (`makeScene`, `scheduleScene`, `warmCardSoon`).

## What holds the memory (one 3D network of 100,000 items, about 300,000 links)

| Part | Size | What it is |
|---|---:|---|
| One finished 3D picture (the "scene") | about 150 MB | JS objects: about 300,000 link objects (`S.curves`) and about 100,000 each of item, label and dot objects |
| The layout (`L`) | about 320 MB | nodes and edges as objects, positions, groups |
| The kept looks (`o.plan`) | about 64 MB | what each item and link looks like between camera angles |
| All the number data as typed arrays | a few MB | positions, colors, paint order |
| Twelve pictures built in a row | about 1.4 GB of garbage | the collector frees it, but the peak is what a laptop feels |

Plain reading: the numbers are small, the OBJECTS are big. Each object costs a header plus pointers; a link object holds mostly numbers that would fit in a few typed-array slots.

## What was tried or checked, and the result

- **Squeezing the numbers (for example 16-bit positions) or reusing buffers:** gains almost nothing, because typed arrays are already only a few MB.
- **"Free the old picture first" (`releaseOldScene`):** built, then REVERTED after a review. It freed nothing and could leave the map dead. The renderers keep references to the old scene (`rigState.sid`, `sid2`, `sidT`, the WebGPU `rs.sid` and a stale `T`), and `S.keyMap.sc` holds it too. A throw while making the new one left `S.scene` null.
- **Lazy link objects (make `S.curves` on demand):** abandoned. The renderers tessellate `S.curves` in `setScene`; `style()`, `rigStyle`, picking (`edgeIndex`), SVG export and the Canvas 2D fallback all read the link list, so the first hover would rebuild all 300,000 objects. It would also change how the first picture is drawn.
- **Already in place:** a big plain 3D network turns on the graphics card (`makeRig`, `attachTurn`, `S.turnTo`, `drawRig`): the picture is uploaded once and each frame only sends camera numbers. On the owner's laptop (Firefox 159, (graphics)) that holds 60 FPS at 100,000 items while dragging, zooming and turning, and the upload takes about 60 ms.

## What would actually help (my reading, not yet tried)

1. Keep links and items as flat typed arrays (struct of arrays: `from[]`, `to[]`, `weight[]`, `color[]`) and give readers an index instead of an object. The expensive part is every reader of the link list listed above, so the change has to cover them together.
2. Not holding two full pictures at once: the old one must be released by everything that references it (the list above), not just by `S.scene`.
3. A general compressor for the objects would have to decode in microseconds per access, because picking and hover read single links. Compressing the typed arrays buys nothing; compressing the object graph is the only place with something to gain.

## Constraints for anything added

- One self-contained `index.html` that works offline; the engine source is also embedded as text for the Web Worker.
- Only MIT, BSD, ISC or Apache 2.0 code. Never GPL, AGPL, LGPL or MPL.
- Must run in Firefox 158, ungoogled-chromium 155 and WebKitGTK 2.52.6.
- Speed must not cost looks (the three drawing backends stay visually identical; `test/browser.test.js` checks it).
- Run `node test/all.js --changed` while working; the browser test in one browser when a change is done; the full set only when the design is final.
