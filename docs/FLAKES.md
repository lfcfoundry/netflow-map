# Flake ledger

A check that failed once and passed on a rerun with no code change. Rule (universal QA guide): a flake is a bug in the check. Log it here, rerun once, then find the cause; never retry silently. Capture WHICH check failed the first time (name and browser) before rerunning.

| Date | Build | Browser | Check | What happened | Judged | Cause / status |
|---|---|---|---|---|---|---|
| 2026-10-17 | 0033 | WebKitGTK 2.52.6 | "WebGL 2 context lost" alarm after a renderer was destroyed | A late context-lost event tore down the next renderer | Real bug in the app, not a flake | Fixed (`destroyed` flag), build 2026.10.17.0033 |
| 2026-10-17 | 0100 | Chromium | "links table filter works" after shortening the pauses | The test looked before the table's 400 ms filter delay had finished | A gap in the test, found by shortening pauses (not an app bug) | Fixed: the test waits with `settle()` / `NFM.pending()` instead of a guessed pause (CHANGELOG 0100) |
| 2026-10-17 | 0228 | Firefox 158.0 | `node test/fuzz.browser.js firefox 60` (in-page zip fuzz) | Dies with "NFMUnpack is not defined" after the memory loop; 3 of 3 runs at 40 s and 60 s, 1 chunked-10-s run also; 5 s passes; the page still has NFMUnpack just before the call | Reproducible, so NOT a flake: a defect in how the check runs in Firefox | Open. Chromium 155 passes the same check (146,060 zips opened, 0 unexpected errors). Cause not found; not an app bug as far as seen |

Add a row for every failure that passes on a rerun with no change. If the same check repeats on an idle machine, it is a real bug: find the cause.
