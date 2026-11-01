#!/bin/sh
# Reproduce the shipped first-value demo. All sample repositories, consent and installations
# belong to the demo's temporary area. No downloads, user project changes or global installation.
# Usage: sh scripts/demo.sh [compiled-engine]
set -eu

src=$(cd "$(dirname "$0")/.." && pwd -P)
tmp=$(mktemp -d "${TMPDIR:-/tmp}/pregate-demo-wrapper.XXXXXX")
trap 'rm -rf "$tmp"' EXIT
tmp=$(cd "$tmp" && pwd -P)

if [ "$#" -gt 1 ]; then
  echo 'usage: sh scripts/demo.sh [compiled-engine]' >&2
  exit 1
fi
engine=${1:-$tmp/pregate}
if [ "$#" -eq 0 ]; then
  (cd "$src" && bun build src/main.ts --compile --minify --bytecode \
    --no-compile-autoload-bunfig --no-compile-autoload-dotenv \
    --define=PREGATE_TEST_BUILD=false --outfile="$engine" >/dev/null)
else
  engine=$(cd "$(dirname "$engine")" && pwd -P)/$(basename "$engine")
fi
"$engine" demo
