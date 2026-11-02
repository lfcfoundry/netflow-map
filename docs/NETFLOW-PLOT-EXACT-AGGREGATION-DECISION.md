Copyright (c) 2026 LFC Foundry. MIT License.

# Netflow Plot exact-aggregation decision

The JS-modules Stage 5 full-chart feasibility investigation evaluated BigInt exact aggregation reuse, a BigInt-free limb backend, and a hybrid backend. None met the predefined production acceptance budgets.

High-cardinality workloads did not deliver the required performance benefit. BigInt and hybrid performance and memory results were inconsistent; the limb backend was substantially slower in important workloads. Retained heap increased materially, every candidate exceeded the RSS growth budget, and the prototype runtime footprint exceeded the compressed-size budget. Browser compatibility was not established by actual browser testing. Correctness tests passed, but correctness alone did not justify production adoption.

**Do not port the rejected exact-aggregation-reuse architecture into Netflow Map. Do not replace or modify the existing vendored Netflow Plot implementation with any of these backends.** Preserve the existing Netflow Map repair work independently of this decision.

Any future reconsideration requires a materially different, lower-allocation exact representation and successful full-chart benchmarking against the established budgets. If those budgets or the benchmark methodology need to change, justify and document the changes before benchmarking.

The JS-modules repository contains the reproducible budgets, raw benchmark results, benchmark harness, memory probe, full-chart prototypes, and tests:

- [Stage 5 investigation summary](https://github.com/lfcfoundry/JS-modules/blob/codex-netflow-plot-2.5.0-edge-case-fixes/modules/netflow-plot/test/exact-feasibility/INVESTIGATION-SUMMARY.md)
- [Research branch](https://github.com/lfcfoundry/JS-modules/tree/codex-netflow-plot-2.5.0-edge-case-fixes)
- [Publication commit `ce053c430415f18cdeec01105070eb04f3e5cf34`](https://github.com/lfcfoundry/JS-modules/commit/ce053c430415f18cdeec01105070eb04f3e5cf34)
