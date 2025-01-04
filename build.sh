#!/bin/bash
set -e  # Exit immediately if a command exits with a non-zero status
npm install
cd apps/roam || exit 1
turbo run build -- --build-extension
