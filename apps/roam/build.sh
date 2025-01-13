#!/bin/bash
set -e  # Exit immediately if a command exits with a non-zero status
npm install
npx turbo run build --filter=roam
