#!/bin/sh
# Copyright (c) 2026 JNFoo. MIT License.
# Turns on the tracked house-rule hooks for this clone (git does not copy hooks when it clones).
cd "$(git rev-parse --show-toplevel)" && git config core.hooksPath tools/hooks && chmod +x tools/hooks/* && echo "hooks on: $(git config core.hooksPath)"
