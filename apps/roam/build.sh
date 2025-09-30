#!/bin/bash
set -e
pnpm install
npx turbo run build --filter=roam
cp dist/* .
