# Raw tables per data set (Firefox 158.0, about 100,000 items each)

Copyright (c) 2026 LFC Foundry. MIT License. Made by bench/compression-methods/run.js. Packed size lower is better; unpack must be exact (all were).

### app:communities firefox firefox/158.0

fast mode
| piece | raw | packed | % of raw | pack ms | unpack ms | number blocks (count) | byte coder (chunks) |
|---|---|---|---|---|---|---|---|
| graph items: communities | 16.76 MB | 3.8 KB | 0.0% | 47 | 75 | - | LZ4 (wasm), shuffle 4+delta 2; LZ4 (wasm), no shuffle 1 |
| graph links: communities | 46.72 MB | 797.7 KB | 1.7% | 113 | 243 | - | LZ4 (wasm), shuffle 4 2; LZ4 (wasm), shuffle 4+delta 2 |
| layout links: communities | 78.86 MB | 812.5 KB | 1.0% | 333 | 671 | - | LZ4 (wasm), shuffle 4 2; LZ4 (wasm), shuffle 4+delta 4; LZ4 (wasm), no shuffle 5 |
| scene numbers, positions: communities | 1.53 MB | 1.33 MB | 86.9% | 18 | 2 | - | LZ4 (wasm), shuffle 8 2 |
| scene numbers, link ends: communities | 2.38 MB | 1.15 MB | 48.3% | 5 | 6 | - | LZ4 (wasm), shuffle 4 3 |
| scene numbers, link colors: communities | 1.19 MB | 4.8 KB | 0.4% | 0 | 1 | - | LZ4 (wasm), no shuffle 2 |

balanced mode
| piece | raw | packed | % of raw | pack ms | unpack ms | number blocks (count) | byte coder (chunks) |
|---|---|---|---|---|---|---|---|
| graph items: communities | 16.76 MB | 0.5 KB | 0.0% | 87 | 67 | INTS:DELTA 39, INTS:CONST 3 | LZ4 (wasm), shuffle 4+delta 2; LZ4 (wasm), shuffle 8+delta 2; LZ4 (wasm), no shuffle 2 |
| graph links: communities | 46.72 MB | 563.8 KB | 1.2% | 242 | 210 | INTS:ENT 36, INTS:PFOR 4, INTS:DELTA 40 | LZ4 (wasm), shuffle 4 2; LZ4 (wasm), shuffle 4+delta 2; LZ4 (wasm), shuffle 8 1; LZ4 (wasm), shuffle 8+delta 1 |
| layout links: communities | 78.86 MB | 573.8 KB | 0.7% | 541 | 1068 | INTS:ENT 36, INTS:PFOR 4, INTS:DELTA 80 | LZ4 (wasm), shuffle 4 2; LZ4 (wasm), shuffle 4+delta 4; LZ4 (wasm), shuffle 8 1; LZ4 (wasm), no shuffle 5; LZ4 (wasm), shuffle 8+delta 2 |
| scene numbers, positions: communities | 1.53 MB | 1.33 MB | 86.9% | 5 | 1 | - | LZ4 (wasm), shuffle 8 2 |
| scene numbers, link ends: communities | 2.38 MB | 1.15 MB | 48.3% | 5 | 4 | - | LZ4 (wasm), shuffle 4 3 |
| scene numbers, link colors: communities | 1.19 MB | 4.8 KB | 0.4% | 1 | 1 | - | LZ4 (wasm), no shuffle 2 |
### app:random firefox firefox/158.0

fast mode
| piece | raw | packed | % of raw | pack ms | unpack ms | number blocks (count) | byte coder (chunks) |
|---|---|---|---|---|---|---|---|
| graph items: random | 16.00 MB | 3.3 KB | 0.0% | 45 | 53 | - | LZ4 (wasm), shuffle 4+delta 2 |
| graph links: random | 44.98 MB | 899.5 KB | 2.0% | 132 | 210 | - | LZ4 (wasm), shuffle 4 2; LZ4 (wasm), shuffle 4+delta 2 |
| layout links: random | 75.94 MB | 913.5 KB | 1.2% | 522 | 1051 | - | LZ4 (wasm), shuffle 4 2; LZ4 (wasm), shuffle 4+delta 4; LZ4 (wasm), no shuffle 5 |
| scene numbers, positions: random | 1.53 MB | 1.33 MB | 86.9% | 4 | 1 | - | LZ4 (wasm), shuffle 8 2 |
| scene numbers, link ends: random | 2.29 MB | 1.41 MB | 61.6% | 4 | 3 | - | LZ4 (wasm), shuffle 4 3 |
| scene numbers, link colors: random | 1.14 MB | 4.6 KB | 0.4% | 0 | 2 | - | LZ4 (wasm), no shuffle 2 |

balanced mode
| piece | raw | packed | % of raw | pack ms | unpack ms | number blocks (count) | byte coder (chunks) |
|---|---|---|---|---|---|---|---|
| graph items: random | 16.00 MB | 0.4 KB | 0.0% | 115 | 67 | INTS:DELTA 28 | LZ4 (wasm), shuffle 4+delta 2; LZ4 (wasm), shuffle 8+delta 2 |
| graph links: random | 44.98 MB | 660.1 KB | 1.4% | 157 | 185 | INTS:FOR 38, INTS:DELTA 38 | LZ4 (wasm), shuffle 4 2; LZ4 (wasm), shuffle 4+delta 2; LZ4 (wasm), shuffle 8 1; LZ4 (wasm), shuffle 8+delta 1 |
| layout links: random | 75.94 MB | 669.8 KB | 0.9% | 707 | 382 | INTS:FOR 38, INTS:DELTA 76 | LZ4 (wasm), shuffle 4 2; LZ4 (wasm), shuffle 4+delta 4; LZ4 (wasm), shuffle 8 1; LZ4 (wasm), no shuffle 5; LZ4 (wasm), shuffle 8+delta 2 |
| scene numbers, positions: random | 1.53 MB | 1.33 MB | 86.9% | 9 | 2 | - | LZ4 (wasm), shuffle 8 2 |
| scene numbers, link ends: random | 2.29 MB | 1.41 MB | 61.6% | 9 | 3 | - | LZ4 (wasm), shuffle 4 3 |
| scene numbers, link colors: random | 1.14 MB | 4.6 KB | 0.4% | 1 | 6 | - | LZ4 (wasm), no shuffle 2 |
### app:hub firefox firefox/158.0

fast mode
| piece | raw | packed | % of raw | pack ms | unpack ms | number blocks (count) | byte coder (chunks) |
|---|---|---|---|---|---|---|---|
| graph items: hub | 16.00 MB | 3.3 KB | 0.0% | 47 | 50 | - | LZ4 (wasm), shuffle 4+delta 2 |
| graph links: hub | 44.81 MB | 841.5 KB | 1.8% | 200 | 235 | - | LZ4 (wasm), shuffle 4 2; LZ4 (wasm), shuffle 4+delta 2 |
| layout links: hub | 75.76 MB | 855.6 KB | 1.1% | 469 | 975 | - | LZ4 (wasm), shuffle 4 2; LZ4 (wasm), shuffle 4+delta 4; LZ4 (wasm), no shuffle 5 |
| scene numbers, positions: hub | 1.53 MB | 1.34 MB | 87.7% | 6 | 10 | - | LZ4 (wasm), shuffle 8 2 |
| scene numbers, link ends: hub | 2.29 MB | 1.26 MB | 55.3% | 12 | 4 | - | LZ4 (wasm), shuffle 4 3 |
| scene numbers, link colors: hub | 1.14 MB | 4.6 KB | 0.4% | 0 | 2 | - | LZ4 (wasm), no shuffle 2 |

balanced mode
| piece | raw | packed | % of raw | pack ms | unpack ms | number blocks (count) | byte coder (chunks) |
|---|---|---|---|---|---|---|---|
| graph items: hub | 16.00 MB | 0.4 KB | 0.0% | 61 | 82 | INTS:DELTA 28 | LZ4 (wasm), shuffle 4+delta 2; LZ4 (wasm), shuffle 8+delta 2 |
| graph links: hub | 44.81 MB | 613.9 KB | 1.3% | 168 | 162 | INTS:ENT 38, INTS:DELTA 38 | LZ4 (wasm), shuffle 4 2; LZ4 (wasm), shuffle 4+delta 2; LZ4 (wasm), shuffle 8 1; LZ4 (wasm), shuffle 8+delta 1 |
| layout links: hub | 75.76 MB | 623.6 KB | 0.8% | 541 | 757 | INTS:ENT 38, INTS:DELTA 76 | LZ4 (wasm), shuffle 4 2; LZ4 (wasm), shuffle 4+delta 4; LZ4 (wasm), shuffle 8 1; LZ4 (wasm), no shuffle 5; LZ4 (wasm), shuffle 8+delta 2 |
| scene numbers, positions: hub | 1.53 MB | 1.34 MB | 87.7% | 13 | 2 | - | LZ4 (wasm), shuffle 8 2 |
| scene numbers, link ends: hub | 2.29 MB | 1.26 MB | 55.3% | 9 | 9 | - | LZ4 (wasm), shuffle 4 3 |
| scene numbers, link colors: hub | 1.14 MB | 4.6 KB | 0.4% | 1 | 2 | - | LZ4 (wasm), no shuffle 2 |
### app:rich firefox firefox/158.0

fast mode
| piece | raw | packed | % of raw | pack ms | unpack ms | number blocks (count) | byte coder (chunks) |
|---|---|---|---|---|---|---|---|
| graph items: rich | 24.41 MB | 1.90 MB | 7.8% | 132 | 132 | - | LZ4 (wasm), no shuffle 6; LZ4 (wasm), shuffle 8 1; LZ4 (wasm), no shuffle, stored plain 1; LZ4 (wasm), shuffle 4+delta 1 |
| graph links: rich | 55.43 MB | 3.06 MB | 5.5% | 139 | 227 | - | LZ4 (wasm), shuffle 8 3; LZ4 (wasm), shuffle 4 4; LZ4 (wasm), no shuffle 1; LZ4 (wasm), shuffle 4+delta 2 |
| layout links: rich | 75.87 MB | 756.0 KB | 1.0% | 140 | 319 | - | LZ4 (wasm), shuffle 4 2; LZ4 (wasm), shuffle 4+delta 4; LZ4 (wasm), no shuffle 5 |
| scene numbers, positions: rich | 1.53 MB | 1.31 MB | 85.7% | 3 | 1 | - | LZ4 (wasm), shuffle 8 2 |
| scene numbers, link ends: rich | 2.29 MB | 1.07 MB | 46.9% | 5 | 4 | - | LZ4 (wasm), shuffle 4 3 |
| scene numbers, link colors: rich | 1.14 MB | 4.6 KB | 0.4% | 0 | 2 | - | LZ4 (wasm), no shuffle 2 |

balanced mode
| piece | raw | packed | % of raw | pack ms | unpack ms | number blocks (count) | byte coder (chunks) |
|---|---|---|---|---|---|---|---|
| graph items: rich | 24.41 MB | 1.82 MB | 7.5% | 161 | 94 | INTS:ENT 28, INTS:DELTA 30 | LZ4 (wasm), no shuffle 8; LZ4 (wasm), shuffle 8 5; LZ4 (wasm), no shuffle, stored plain 1; LZ4 (wasm), shuffle 4+delta 1; LZ4 (wasm), shuffle 8+delta 2 |
| graph links: rich | 55.43 MB | 2.45 MB | 4.4% | 293 | 169 | INTS:ENT 76, INTS:FOR 38, INTS:PFOR 31, INTS:DELTA 45 | LZ4 (wasm), shuffle 8 7; LZ4 (wasm), shuffle 4 4; LZ4 (wasm), no shuffle 1; LZ4 (wasm), shuffle 4+delta 2; LZ4 (wasm), shuffle 8+delta 1 |
| layout links: rich | 75.87 MB | 540.4 KB | 0.7% | 272 | 781 | INTS:PFOR 31, INTS:DELTA 83 | LZ4 (wasm), shuffle 4 2; LZ4 (wasm), shuffle 4+delta 4; LZ4 (wasm), shuffle 8 1; LZ4 (wasm), no shuffle 5; LZ4 (wasm), shuffle 8+delta 2 |
| scene numbers, positions: rich | 1.53 MB | 1.31 MB | 85.7% | 4 | 1 | - | LZ4 (wasm), shuffle 8 2 |
| scene numbers, link ends: rich | 2.29 MB | 1.07 MB | 46.9% | 5 | 2 | - | LZ4 (wasm), shuffle 4 3 |
| scene numbers, link colors: rich | 1.14 MB | 4.6 KB | 0.4% | 1 | 1 | - | LZ4 (wasm), no shuffle 2 |
### other firefox firefox/158.0

fast mode
| piece | raw | packed | % of raw | pack ms | unpack ms | number blocks (count) | byte coder (chunks) |
|---|---|---|---|---|---|---|---|
| text: words, unsorted | - | 497.1 KB | - | 24 | 23 | - | LZ4 (wasm), no shuffle 2 |
| text: words, sorted | - | 189.7 KB | - | 36 | 25 | - | LZ4 (wasm), no shuffle 2; LZ4 (wasm), shuffle 2+delta 1 |
| text: file paths, sorted | - | 1.19 MB | - | 80 | 82 | - | LZ4 (wasm), no shuffle 9 |
| text: log lines | - | 169.8 KB | - | 197 | 231 | - | LZ4 (wasm), shuffle 2 1; LZ4 (wasm), shuffle 2+delta 1; LZ4 (wasm), shuffle 4+delta 1; LZ4 (wasm), no shuffle 1 |
| numbers: counting 0,1,2... | 781.2 KB | 3.3 KB | 0.4% | 2 | 4 | - | LZ4 (wasm), shuffle 8+delta 1 |
| numbers: small whole (0 to 99) | 781.2 KB | 172.4 KB | 22.1% | 1 | 4 | - | LZ4 (wasm), shuffle 8 1 |
| numbers: two decimals | 781.2 KB | 484.9 KB | 62.1% | 7 | 3 | - | LZ4 (wasm), no shuffle 1 |
| numbers: random fractions | 781.2 KB | 556.8 KB | 71.3% | 5 | 3 | - | LZ4 (wasm), shuffle 8 1 |
| numbers: timestamps in ms | 781.2 KB | 215.1 KB | 27.5% | 1 | 3 | - | LZ4 (wasm), shuffle 8+delta 1 |
| numbers: big whole | 781.2 KB | 463.3 KB | 59.3% | 4 | 3 | - | LZ4 (wasm), shuffle 8 1 |
| bytes: random 1 MB | 1.00 MB | 1.00 MB | 100.0% | 8 | 8 | - | LZ4 (wasm), no shuffle, stored plain 1 |
| bytes: repeating pattern 1 MB | 1.00 MB | 34.1 KB | 3.3% | 0 | 4 | - | LZ4 (wasm), no shuffle 1 |
| bytes: smooth gradient 1 MB | 1.00 MB | 420.2 KB | 41.0% | 6 | 4 | - | LZ4 (wasm), no shuffle 1 |

balanced mode
| piece | raw | packed | % of raw | pack ms | unpack ms | number blocks (count) | byte coder (chunks) |
|---|---|---|---|---|---|---|---|
| text: words, unsorted | - | 497.1 KB | - | 15 | 27 | - | LZ4 (wasm), no shuffle 2 |
| text: words, sorted | - | 164.5 KB | - | 99 | 24 | INTS:DELTA 14 | LZ4 (wasm), no shuffle 2; LZ4 (wasm), shuffle 2+delta 1; LZ4 (wasm), shuffle 8+delta 1 |
| text: file paths, sorted | - | 1.19 MB | - | 72 | 98 | - | LZ4 (wasm), no shuffle 9 |
| text: log lines | - | 123.9 KB | - | 170 | 45 | INTS:FOR 14, INTS:DELTA 42 | LZ4 (wasm), shuffle 2 1; LZ4 (wasm), shuffle 8 1; LZ4 (wasm), shuffle 2+delta 1; LZ4 (wasm), shuffle 4+delta 1; LZ4 (wasm), shuffle 8+delta 3; LZ4 (wasm), no shuffle 1 |
| numbers: counting 0,1,2... | 781.2 KB | 3.4 KB | 0.4% | 1 | 4 | - | LZ4 (wasm), shuffle 8+delta 1 |
| numbers: small whole (0 to 99) | 781.2 KB | 172.4 KB | 22.1% | 6 | 5 | - | LZ4 (wasm), shuffle 8 1 |
| numbers: two decimals | 781.2 KB | 484.9 KB | 62.1% | 9 | 5 | - | LZ4 (wasm), no shuffle 1 |
| numbers: random fractions | 781.2 KB | 556.8 KB | 71.3% | 13 | 2 | - | LZ4 (wasm), shuffle 8 1 |
| numbers: timestamps in ms | 781.2 KB | 215.2 KB | 27.5% | 4 | 2 | - | LZ4 (wasm), shuffle 8+delta 1 |
| numbers: big whole | 781.2 KB | 463.4 KB | 59.3% | 6 | 5 | - | LZ4 (wasm), shuffle 8 1 |
| bytes: random 1 MB | 1.00 MB | 1.00 MB | 100.0% | 7 | 5 | - | LZ4 (wasm), no shuffle, stored plain 1 |
| bytes: repeating pattern 1 MB | 1.00 MB | 34.1 KB | 3.3% | 0 | 4 | - | LZ4 (wasm), no shuffle 1 |
| bytes: smooth gradient 1 MB | 1.00 MB | 420.2 KB | 41.0% | 7 | 5 | - | LZ4 (wasm), no shuffle 1 |
