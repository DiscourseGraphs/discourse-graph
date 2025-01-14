#!/bin/bash
set -e
npm install
npx turbo run build --filter=roam
