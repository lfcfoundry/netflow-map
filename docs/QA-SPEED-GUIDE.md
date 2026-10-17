# Making QA Checks and Browser Tests Fast, Cheap and Trustworthy

Written 2026-10-17 from the Netflow Map project (repo lfcfoundry/netflow-map). Everything marked **Measured** was timed in this project. Everything marked **Estimate** is reasoning, not a measurement, and should be checked before relying on it.

Written in plain words: each technique says what it is, why it works, what it cost or saved, and the trap to avoid. Drop this file into a new project's first conversation so the speed habits start on day one.

---

## 1. The one-page version

1. **Time every check first.** You cannot speed up what you have not measured. Print seconds per check and a final total (Section 3).
2. **Wait for the thing, not for the clock.** Replace fixed `sleep(500)` pauses with "wait until the screen has really caught up" (Section 4). Biggest single saving in the browser test.
3. **Keep the data inside the page.** Compare pictures inside the browser and send back only "same / different" (Section 5).
4. **Use small samples for checks about correctness; big samples only for checks about speed** (Section 6).
5. **Run independent tests side by side**, longest first, and match the number of lanes to the processor cores (Section 7).
6. **Run the cheap tests while working. Run the expensive ones once when the design is settled** (Section 8). This is also your stated preference.
7. **A fast test that lies is worse than a slow one.** Every shortcut needs a switch that restores the full behavior, and the full run must still happen before a release (Section 9).
8. **Test the browsers that matter, one at a time** on a small machine. Parallel browsers fight for the same cores and make timings meaningless (Section 10).
9. **For people-run diagnostics (the tester page): one button, plain-words verdict, no toggling** (Section 12).

**Measured result in this project (2026-10-17):**

| Test | Before | After |
|---|---|---|
| Browser test, Chromium (ungoogled) | 150 s | 46 s |
| Browser test, Firefox | about 70 s | 27 s |
| Browser test, WebKitGTK | 43 s | 35 s |
| All Node tests | about 84 s one after another | about 44 s, two at a time |

Same checks, same pass criteria. Checks only got cheaper to run, not weaker.

---

## 2. Principles (the reasoning behind every technique)

- **Cost = waiting + work + data moved.** Most slow tests are mostly waiting. Fix waiting first, moved data second, work last.
- **Never trade away what the test is for.** A speed-up is allowed only if the same bug would still be caught. If unsure, keep a switch that restores the old slow way and run it before releases.
- **Time, not intuition.** In this project the biggest wins were in places I would not have guessed (fixed pauses and sending picture data out of the page).
- **Cheap early, expensive late.** Cost of a wasted run is highest when the design is still changing.
- **Measure the measurer.** If the computer is busy, every timing is wrong. Add a "was the computer steady?" check to speed tests (Section 11).
- **Report real time and compute on every run.** It keeps the cost visible and shows regressions in the tests themselves.

---

## 3. Step zero: add timing to the test runner

**What:** wrap each check so it records start and end times, and print a table at the end, slowest first.

**How we did it here:** setting `NFM_TIMES=1` makes `test/browser.test.js` print the seconds each check took plus a total.

```
NFM_TIMES=1 node test/browser.test.js firefox
```

**Why it matters:** the first profile showed where the 150 s went. Without it we would have tuned the wrong things.

**Tips:**
- Print in the order of cost, not the order of execution.
- Keep the timing code in the test file permanently; it costs nothing.
- Look for checks that take almost exactly a round number (500 ms, 1000 ms, 2000 ms). That is a fixed pause, not work.

---

## 4. Replace fixed pauses with real waits (biggest win)

**The problem:** tests often do `click(); sleep(600); check()`. The 600 ms is a guess. Too short, the test is flaky. Too long, you pay it hundreds of times.

**The fix:** wait for the actual condition.

1. **Wait for real animation frames** (two `requestAnimationFrame` ticks) so the screen has painted what you changed.
2. **Wait for the app's own "nothing pending" signal.** Netflow Map exposes `NFM.pending()` which counts short screen-update delays (debounces of 200 ms or less) still waiting to fire. `settle(ms)` waits for frames *and* `NFM.pending() === 0`.
3. **Keep real sleeps only for real time:** easing animations, playback, a typing delay the page does not count.

**Trap that actually bit us:** after shortening a pause, the check "links table filter works" failed because the table filter used a 400 ms debounce, longer than the 200 ms the counter tracked. The fix was to count that debounce too, not to put the long pause back. Lesson: when a shortened wait fails, find what the test was silently waiting for and make the page announce it.

**How to apply in a new project from day one:**
- Give the app a tiny test hook: `pending()` that returns how many scheduled updates are outstanding. It costs a few lines and never affects users.
- Use one helper, `settle()`, everywhere. Ban raw `sleep` except in a short allowed list.

**Measured:** this was the largest share of the Chromium 150 s to 46 s drop (together with Section 5).

---

## 5. Keep the data inside the page

**The problem:** a test grabs a screenshot or pixel array, ships it from the browser to Node (serialization, base64, copying), then compares it there. Thousands of numbers per picture, repeated for every comparison.

**The fix:** run the comparison inside the page (in our case `window.__px`) and return a single small result such as `{same: true, worst: 3}`.

**Why it works:** moving a 1 MB array across the automation connection costs far more than comparing it in place.

**Rules:**
- Return verdicts and a few numbers, never raw pixels, unless you need to *show* a failure.
- On failure only, return enough detail (where, how different) to debug.
- Same idea for logs: filter in the page (`read_console_messages` with a `pattern`) instead of pulling everything.

---

## 6. Right-size the samples

Different checks need different amounts of data.

| Check is about | Use | Why |
|---|---|---|
| Correctness (same picture, same layout, same result) | **Small** sample, such as 1,200 items or a 1,500-item turning map | A bug shows at any size; big samples only add time |
| Speed / smoothness | **Big** sample, real sizes (5k to 100k) | Smoothness problems appear only at scale |
| Edge cases (empty, one item, duplicates) | **Tiny** | Instant |

**What we did:**
- `?tunesizes=1500` makes the page use a 1,500-item sample for the turning-on-the-card check.
- `window.NFM_CHECK_MS` shortens the device check's timing window. Nothing sets it for real users.
- Switches that restore the old behavior: `NFM_FULLCHECK=1` (full samples) and `NFM_SLOW=1` (old fixed pauses).

**Trap:** do not shrink samples for a speed check. A 60-FPS result at 1,500 items says nothing about 100,000.

---

## 7. Run independent tests in parallel (Node tests)

**What:** `test/all.js` starts every Node test as its own process, a few at a time, longest first. Prints one line per test with its time, and the last lines of any that fail.

**Measured:** about 84 s one after another, about 44 s with two lanes.

**Design choices worth copying:**
- **Longest first.** Otherwise one slow test starts last and the whole run waits for it. Ours uses a simple weight table (fuzz first, oracle next, then card, layout, tune).
- **Lane count = min(cores, 4).** More lanes than cores makes every test slower and noisier.
- **Separate processes**, not threads, so one test's memory or crash cannot affect another.
- **Pass `--expose-gc`** where a test measures memory so it can force a clean-up before measuring.
- **Time budget on random tests.** The fuzz test gets 10 s in the normal run (`node test/all.js`) and 90 s in the full run (`--full`).
- **Exit code** is non-zero if anything failed so scripts and hooks can rely on it.

**Estimate:** on a 16-thread laptop, 4 lanes would be the cap here, and a 2-core cloud container was already saturated at 2.

**Do not parallelize** tests that share a port, a file, a database, or a single browser window.

---

## 8. A tiered schedule (what to run when)

Matches your stated preference: hold off on checks and benchmarks while the design is still moving.

| Tier | When | What | Target time |
|---|---|---|---|
| **0 Instant** | Every edit | Syntax check / build only | seconds |
| **1 Quick** | While working | The Node tests for the area you touched. `fuzz.test.js 20` is a 20-second spot check | under 30 s |
| **2 Standard** | When a change is "done" | `node test/all.js`, then the browser test in one browser | about 1.5 min |
| **3 Release** | Design settled, before sending to the owner | `node test/all.js --full`, browser test in every supported browser, one at a time, the long fuzz run | several minutes |
| **4 Real hardware** | After release | The tester page on the owner's laptop (his own run) | his time |

**Rules:**
- Never run Tier 3 on a design that may be thrown away.
- If Tier 2 passes, say so briefly. If it fails, show only the failing lines.
- Record in the CHANGELOG exactly which browsers and versions each build was tested in.

---

## 9. Keep fast tests honest

A shortcut is only safe if it cannot hide a real bug.

1. **Every shortcut gets an off switch** (`NFM_FULLCHECK`, `NFM_SLOW`), documented in AGENTS.md.
2. **Run the full version before a release.** Tier 3 uses the full switches.
3. **Never lower a pass threshold to make a test pass.** Fix the cause or document why the threshold was wrong.
4. **Watch for false alarms as hard as false passes.** We had two kinds:
   - The tester said "page in the background" when the page was only slow. Cause: a time-based guess. Fix: look at real page visibility and say "too slow to time" instead.
   - A WebGL "context lost" alarm after a renderer was deliberately destroyed. Fix: a `destroyed` flag so deliberate teardown is not reported as a fault.
5. **When a result looks bad, ask whether the computer was steady** before blaming the code (Section 11).
6. **Add a lock-in check** for decisions. Example: the app must never draw with WebGPU (owner's decision) and a test confirms it.

---

## 10. Browser testing strategy

**Which browsers (this project's rule):** ungoogled-chromium and current Firefox. WebKitGTK is also run as a Safari stand-in. Firefox is the stress test because it shows performance regressions most obviously. Chromium-based testing is not useless. Test only the browsers on the `browsers` branch of `JNFoo/knowledgebase-single-file`.

**Run one browser at a time on a small machine.** Two browsers running together compete for cores and memory. Timings and frame rates become meaningless. The Node tests are the exception because they do not measure frame rates.

**Software vs real graphics:** the cloud container has no graphics card, so it validates *correctness* (same pictures, no crashes) but not *smoothness*. Smoothness comes from the tester page running on the owner's own laptop. (Do not keep telling the owner about the missing graphics card; just route smoothness questions to the tester.)

**Make pictures comparable across browsers:**
- Compare drawing backends against each other (WebGL 2, Canvas 2D, WebGPU) with an agreed tolerance, not exact pixels. Our parity check lives in `test/browser.test.js`.
- Compare against a processor reference for layout correctness (small sample, Section 6).

**Cut browser start-up cost:**
- Reuse one browser launch for many checks. A new launch per check is slow.
- Open the app once, then reload only when the check needs a clean state.
- Disable things tests do not need (animations the check does not look at, remote fonts, network) where it cannot change what is being tested.

**Cut flakiness (re-runs cost as much as slow runs):**
- Wait for conditions, never time (Section 4).
- Seed random generators so a failure can be reproduced.
- Avoid depending on window focus or visibility. Background tabs are throttled, and we hit exactly this: a hidden page looks "slow" to a frame timer.

**Memory in long browser runs:** each big scene can allocate tens to hundreds of megabytes of temporary data. **Measured in Node:** a 100,000-item scene allocates about 120 MB of garbage per build (roughly 0.83 s), 50,000 about 390 ms, 5,000 about 40 ms. Twelve such scenes is about 1.4 GB. So:
- Free finished maps (drop the references) before building the next.
- Rebuild a scene on demand when it is shown, instead of keeping all of them. The tester's hands-on preview does this (`scenes[].rebuild`).
- Treat an out-of-memory in one size as *that row's* result, not the end of the whole run.

---

## 11. Benchmarks and the "is the computer steady?" problem

Timing tests are only as good as the machine's quiet.

1. **Check steadiness first.** The tester runs a small arithmetic loop twice, keeps the faster time, and compares it across the run. A big change means something else was using the computer (this explained one bad run).
   - **Trap:** the first loop is slow because the browser's compiler has not warmed up. Run twice, keep the faster.
2. **Do not time what you cannot finish.** At 100,000 items some pictures cannot be drawn fast enough to time. Report "too slow to time" instead of burning minutes. The tester drops per-picture timing at 100,000 and records the result as a verdict.
3. **Cap every timed window.** Our `frameTiming` stops at the target frame count or after a time limit (6 s), whichever comes first, and returns `{slow}` or `{hidden}` instead of hanging.
4. **Pick sizes that tell the story.** 5,000 / 25,000 / 50,000 (default drawing-time sizes) is enough to see the curve; 100,000 only where it is the question.
5. **Defer the demonstration.** The hands-on preview waits until all tests are finished, so it cannot disturb the timings. (Unverified whether it was the cause of freezes; the next run will say.)
6. **Record where freezes happen** (zoom level, size) so the cause can be found instead of guessed.
7. **Compare like with like:** same machine state, same browser version, same sizes, same backend. Write the build number next to every number.
8. **Use percentiles, not averages.** Average FPS hides freezes. Count frames over 34 ms and record the longest pause.

---

## 12. Rules for diagnostic pages the owner runs himself

(From your preferences of Oct 13.)

- **One button.** The page runs everything and explains results in plain words with a verdict.
- **Never ask the owner to toggle things** and work out what is being tested.
- **Always-on progress:** sticky strip with progress, current step, run clock and live FPS.
- **Sizes and units spelled out** ("100,000 items", not "1e5").
- **Honest verdicts:** "too slow to time", "ran out of memory in this size", "computer was not steady" are valid results, not failures of the page.
- **Always send the owner the newest file** after every change. (We forgot once; the owner had to ask "where's the tester?".)
- **Version stamp** in the form `2026.10.17.0209` (year.month.day.HHMM, US Eastern).

---

## 13. Memory: can tests or the app compress data instantly?

Short answer: no tool turns live JavaScript data into something small and back again with zero cost. Practical options, cheapest first:

1. **Make less garbage.** Reuse buffers while building scenes. Most of the 120 MB per 100,000-item scene is temporary.
2. **Smaller numbers.** *Correction, measured later the same day:* in Netflow Map the number buffers are only a few MB; the 150 MB per 100,000-item picture is JavaScript objects (about 300,000 links, 100,000 items, 100,000 labels, 100,000 dots). So 16-bit positions and buffer reuse would save almost nothing here. Measure what holds the memory (`process.memoryUsage()` with `--expose-gc`, then drop one list at a time) before choosing a fix.
   Real saving found: let go of the old picture's lists before building the new one, so two never exist at once (peak 300 MB to 150 MB at 100,000 items).
3. **Rebuild on demand and free the rest.**
4. **Keep large data only on the graphics card** when it never needs to come back.
5. **Real compression, only for off-screen data:**
   - Browser built-in `CompressionStream` / `DecompressionStream`: free, but asynchronous, so not usable inside a frame.
   - `fflate` (fast JavaScript deflate), `pako` (standard, slower), `lz4js` or a WebAssembly LZ4 (fastest class). **Estimate:** a few hundred MB/s for the deflate family, 1 GB/s or more for LZ4; float coordinates compress poorly (perhaps 10 to 30%).
   - lfcfoundry/JS-modules already has `save-kit` and `zip-open` using the built-in streams, and `lzma-decode` / `ppmd-decode` (slow, for download packages, not for live memory).

---

## 14. Checklist for the next project (copy into its first conversation)

- [ ] Add per-check timing on day one (`*_TIMES=1`) and a final total.
- [ ] Give the app a `pending()` test hook; write one `settle()` helper; ban raw sleeps.
- [ ] Do comparisons inside the page; return verdicts only.
- [ ] Small samples for correctness, big samples for speed.
- [ ] A parallel Node runner, longest first, lanes = min(cores, 4).
- [ ] Off switches for every shortcut, listed in AGENTS.md.
- [ ] Tiered schedule: instant, quick, standard, release, real hardware.
- [ ] Browsers from the `browsers` branch, one at a time.
- [ ] Steadiness check in every speed test; cap every timed window.
- [ ] Free big objects between tests; make out-of-memory a per-row result.
- [ ] A one-button tester with plain-words verdicts, newest file always sent.
- [ ] Report real elapsed time and approximate compute with every run.
- [ ] Review and profile the QA checks themselves every so often. Tests rot and get slow.

---

## 15. Open items in this project

- **Unverified:** whether closing the compute device before the drawing tests helps or hurts. Waiting for the owner's next tester run on build 2026.10.17.0209 (freeze count and zoom levels).
- **Not yet run in WebKit:** `fuzz-kit` and `pad-nav` (a JS-modules TASKS row).
- **Not started, needs a decision first:** buffer reuse and 16-bit storage (Section 13), landmark layout, WebAssembly SIMD.

---

*Time and compute for writing this document: reported in the chat reply.*
