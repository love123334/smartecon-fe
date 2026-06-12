#!/usr/bin/env bash
# SEDSP Frontend — first-time setup (macOS/Linux)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo ">> npm install..."
npm install

if [[ ! -f .env && -f .env.example ]]; then
  cp .env.example .env
  echo ">> Created .env from .env.example"
fi

echo ">> Done. Run: npm run dev"
