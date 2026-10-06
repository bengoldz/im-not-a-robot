#!/usr/bin/env bash
# Wraps each game's index.html in a full HTML document and zips it for itch.io upload ("HTML" project, "This file will be played in the browser").
set -e
cd "$(dirname "$0")"
mkdir -p itch-builds
for d in laser-pointer nine-lives herding-protocol do-not-disturb cat-translator zoomies tangled box-fort keyboard-cat electric-dreams i-am-the-dot not-a-robot; do
  [ -f "$d/index.html" ] || { echo "skip $d (not built)"; continue; }
  tmp=$(mktemp -d)
  { printf '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>*,*::before,*::after{box-sizing:border-box}body{margin:0}</style></head><body>\n'
    cat "$d/index.html"
    printf '\n</body></html>\n'; } > "$tmp/index.html"
  (cd "$tmp" && zip -q -r "$OLDPWD/itch-builds/$d.zip" index.html)
  rm -rf "$tmp"; echo "built itch-builds/$d.zip"
done
