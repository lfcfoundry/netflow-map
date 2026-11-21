Copyright (c) 2026 LFC Foundry. MIT License.

# Netflow Map layout-result handoff candidate results

Copy one report per candidate. Keep raw trials and fixture definitions with the report.

## Candidate

- ID and hypothesis:
- Baseline commit:
- Candidate commit / exact diff:
- Source and test files changed:
- Date and operator:
- Existing checks run and result:
- New focused checks run and result:
- Candidate switch/default state:

## Environment

| Browser | Exact version | OS/device | CPU class / cores | Viewport / DPR | Renderer | Status |
|---|---|---|---|---|---|---|
| Chromium | | | | | | |
| Firefox | | | | | | |
| WebKitGTK | | | | | | |
| Chrome on Android | | | | | | |

Record power mode, browser flags, worker/card availability, memory telemetry, and any session differences. Mark engines not run and backends unavailable explicitly.

## Correctness and parity

- Matrix cells executed and omitted:
- Fixture names, sizes, link density, and seeds:
- Baseline and oracle comparison:
- Packed and fallback result shapes:
- Properties, values, ordering, and `pos` reference results:
- Pins, pick/selection, drag, save, export, rebuild, and stale-cancel results:
- Renderer pixel parity and skipped backends:
- Failures, minimized cases, and follow-up:

## Phase timing and memory

| Workload | Browser | Worker build | Pack | Transfer | Unpack | Scene make | First stable draw | Total | Max task | >50 ms tasks | Peak / retained memory scope |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| | | | | | | | | | | | |

| Workload ID | Items / links | Result shape / renderer | Baseline p50/p90 | Candidate p50/p90 | Paired effect + interval | First-picture delta | Long-task / memory delta |
|---|---:|---|---:|---:|---|---:|---|
| | | | | | | | |

- Warm-up and paired trial counts:
- Raw result file(s), commands, source hash, fixture generator and seed:
- Instrumentation used and whether it changed the timed path:
- Out-of-memory, skipped cells, crashes, retries, or anomalies:

## Decision

- Adopt / reject / inconclusive / stop at RC-00:
- Correctness and visual gates:
- Target workloads improved:
- Small-map and other protected controls:
- Browser and device coverage:
- Known limitations and remaining work:
- Reproduction steps:
