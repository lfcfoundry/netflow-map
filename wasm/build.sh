#!/bin/sh
# Copyright (c) 2026 LFC Foundry. MIT License.
# Builds force.wasm from force.c and prints its size. Needs clang with the wasm32 target and wasm-ld (checked with Ubuntu clang 18.1.3).
# -ffp-contract=off keeps every multiply and add separate, as in JavaScript, so the positions match the JavaScript ones to the last digit.
set -e
cd "$(dirname "$0")"
clang --target=wasm32 -O3 -msimd128 -mbulk-memory -ffp-contract=off -nostdlib -ffreestanding -fno-builtin \
  -Wl,--no-entry -Wl,--export=force_round -Wl,--export=__heap_base \
  -Wl,--initial-memory=1048576 -Wl,--max-memory=2147483648 -Wl,-z,stack-size=8192 -Wl,--strip-all -Wl,--global-base=1024 \
  -o force.wasm force.c
wc -c force.wasm
