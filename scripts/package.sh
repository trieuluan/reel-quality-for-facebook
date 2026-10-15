#!/usr/bin/env bash
# Build dist/reel-quality-<version>.zip for upload to the Chrome Web Store.
set -euo pipefail
cd "$(dirname "$0")/.."

version=$(node -p "require('./manifest.json').version")
out="dist/reel-quality-${version}.zip"

mkdir -p dist
rm -f "$out"
zip -qr "$out" manifest.json src icons/*.png LICENSE -x '.*'
echo "Built $out"
unzip -l "$out"
