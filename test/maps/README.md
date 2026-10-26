# Netflow Map test map (2026.10.25)

Copyright (c) 2026 LFC Foundry. MIT License. Made for the build 2026.10.24.2045 (netflow-scene 1.1.1). Time to make: about 40 min; compute: light (one lab check of each view in Chromium).

## What this is
A made-up network you can open in Netflow Map to try its features and its speed, and to turn in 3D. Twelve groups of items (Atlas, Birch, Cedar and so on), mostly linked inside their group, with some links between groups. Every link has a **kind** (`flow`, `backup` or `alert`) and a **weight**, so link rules have something to work on.

## Pick a size
| File | Items | Links | Use it for |
|---|---|---|---|
| `netflow-test-map-2000.json` | 2,000 | 6,192 | a first look, a phone |
| `netflow-test-map-8000.json` | 8,000 | 25,096 | the main test (start here) |
| `netflow-test-map-30000.json` | 30,000 | 94,597 | speed stress on a laptop |

## Open it
1. Open Netflow Map (`index.html`), go to **Data**, and drop in or choose the file.
2. Go to **Map**. It opens as a flat network.
3. Open the **Views** tab on the right, find "Open a shared view", paste one of the texts below, and press **Open it**.

## The three views (paste one text from the boxes)
**A. 3D, just turn it.** Best for smooth turning: drag to turn, wheel to zoom. On a computer with a graphics card, a big 3D map without link rules turns on the card itself.

**B. 3D with rules.** Backup links dotted, alert links red with arrowheads and thicker, links between groups bent. This shows the new "rules, arrows and bends in the compact lists" work, but a 3D map with dotted, bent or arrow links turns by rebuilding the picture each step, so expect it to turn less smoothly than A (in the lab, in Chromium 155 without a graphics card, one turn step took 0.23 s for A and 0.35 s for B, lower is better; your device will differ). Making B as smooth as A is a possible next step.

**C. Flat with rules.** The same rules on the flat map. This is the one to compare for rebuild speed: move an item, change a label size, and watch how fast the picture settles.

## What to try
- Drag the map to turn it in 3D (views A and B); try the 2,000 and 30,000 files too.
- In view C, drag items and change label sizes (rebuilds reuse each link's look).
- Style tab: change the rules (turn one off, change a color) and see the picture update.
- The hidden speed button (five taps in the top-left corner) saves a small timing report you can send back.

## Texts to paste
### A. 3D, just turn it

```
NFM-VIEW1:eyJ2aWV3IjoibmV0d29yayIsImFycmFuZ2UiOiJmb3JjZTNkIiwiY29sb3JCeSI6Imdyb3VwIn0=
```

### B. 3D with rules (dotted, arrows, bent)

```
NFM-VIEW1:eyJ2aWV3IjoibmV0d29yayIsImFycmFuZ2UiOiJmb3JjZTNkIiwiY29sb3JCeSI6Imdyb3VwIiwicnVsZXMiOlt7InRhcmdldCI6ImxpbmtzIiwib24iOnRydWUsIndoZW4iOnsidHlwZSI6ImtpbmQiLCJ2YWx1ZSI6ImJhY2t1cCJ9LCJzZXQiOnsiZGFzaCI6ImRvdCJ9fSx7InRhcmdldCI6ImxpbmtzIiwib24iOnRydWUsIndoZW4iOnsidHlwZSI6ImtpbmQiLCJ2YWx1ZSI6ImFsZXJ0In0sInNldCI6eyJjb2xvciI6IiNkNjI4MzkiLCJhcnJvdyI6dHJ1ZSwidyI6Mi41fX0seyJ0YXJnZXQiOiJsaW5rcyIsIm9uIjp0cnVlLCJ3aGVuIjp7InR5cGUiOiJiZXR3ZWVuIn0sInNldCI6eyJiZW5kIjowLjI1fX1dfQ==
```

### C. Flat with rules (dotted, arrows, bent)

```
NFM-VIEW1:eyJ2aWV3IjoibmV0d29yayIsImFycmFuZ2UiOiJzdHJlc3MiLCJjb2xvckJ5IjoiZ3JvdXAiLCJydWxlcyI6W3sidGFyZ2V0IjoibGlua3MiLCJvbiI6dHJ1ZSwid2hlbiI6eyJ0eXBlIjoia2luZCIsInZhbHVlIjoiYmFja3VwIn0sInNldCI6eyJkYXNoIjoiZG90In19LHsidGFyZ2V0IjoibGlua3MiLCJvbiI6dHJ1ZSwid2hlbiI6eyJ0eXBlIjoia2luZCIsInZhbHVlIjoiYWxlcnQifSwic2V0Ijp7ImNvbG9yIjoiI2Q2MjgzOSIsImFycm93Ijp0cnVlLCJ3IjoyLjV9fSx7InRhcmdldCI6ImxpbmtzIiwib24iOnRydWUsIndoZW4iOnsidHlwZSI6ImJldHdlZW4ifSwic2V0Ijp7ImJlbmQiOjAuMjV9fV19
```

