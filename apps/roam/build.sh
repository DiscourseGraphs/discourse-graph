#!/bin/bash
set -e
npm install -g corepack@latest
corepack enable pnpm
pnpm install
npx turbo run build --filter=roam
cp dist/* .
