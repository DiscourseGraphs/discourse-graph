#!/bin/bash
set -e  # Exit immediately if a command exits with a non-zero status
cd apps/roam || exit 1
cd apps/roam
npm install
npm run update:extension 