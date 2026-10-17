# Flake ledger

A check that failed once and passed on a rerun with no code change. Rule (universal QA guide): a flake is a bug in the check. Log it here, rerun once, then find the cause; never retry silently. Capture WHICH check failed the first time (name and browser) before rerunning.

| Date | Build | Browser | Check | What happened | Judged | Cause / status |
|---|---|---|---|---|---|---|
| 2026-10-17 | 0033 | WebKitGTK 2.52.6 | "WebGL 2 context lost" alarm after a renderer was destroyed | A late context-lost event tore down the next renderer | Real bug in the app, not a flake | Fixed (`destroyed` flag), build 2026.10.17.0033 |
| 2026-10-17 | 0100 | Chromium | "links table filter works" after shortening the pauses | The test looked before the table's 400 ms filter delay had finished | A gap in the test, found by shortening pauses (not an app bug) | Fixed: the test waits with `settle()` / `NFM.pending()` instead of a guessed pause (CHANGELOG 0100) |

Add a row for every failure that passes on a rerun with no change. If the same check repeats on an idle machine, it is a real bug: find the cause.
