#!/bin/bash
set -e
export ROAM_BUILD_SCRIPT=1
npm install -g corepack@latest
corepack enable pnpm
pnpm install
npx turbo run build --filter=roam
cp dist/* .
