#!/bin/bash
# Pregate inside a Vercel build. `pregate install --ci vercel` writes this file.
# The gate runs before the framework build. A deny exits non-zero, so Vercel marks the
# deployment Error. Preview and production both run it. See docs/guides/vercel-ci.md.
set -euo pipefail

cd "$(dirname "$0")/.."
root=$PWD

echo "Pregate: VERCEL_ENV=${VERCEL_ENV:-unset}. Preview and production both run this gate."

machine=$(uname -m)
if [ "$machine" != "x86_64" ] && [ "$machine" != "amd64" ]; then
  echo "Pregate's Vercel recipe installs the linux-x64 release. This build machine is ${machine}." >&2
  exit 1
fi

if [ "${1:-}" = "--" ]; then
  shift
  if [ "$#" -eq 0 ]; then
    echo "Pass the framework build after --. Example: bash scripts/pregate-vercel-build.sh -- npm run build" >&2
    exit 1
  fi
  framework=("$@")
elif [ "$#" -eq 0 ]; then
  framework=(npm run build)
else
  echo "Pass the framework build after --. Example: bash scripts/pregate-vercel-build.sh -- npm run build" >&2
  exit 1
fi

lock=".pregate/pregate.lock.json"
production="${PREGATE_PRODUCTION_BRANCH:-main}"
base=""
if git rev-parse --verify --quiet "origin/${production}" >/dev/null; then
  base=$(git merge-base HEAD "origin/${production}" || true)
fi
if [ -z "$base" ]; then
  GIT_TERMINAL_PROMPT=0 git fetch --depth=50 origin "$production" >/dev/null 2>&1 || true
  if git rev-parse --verify --quiet "origin/${production}" >/dev/null; then
    base=$(git merge-base HEAD "origin/${production}" || true)
  fi
fi

engine_of() {
  sed -n 's/.*"engine"[[:space:]]*:[[:space:]]*"\([0-9][0-9A-Za-z.-]*\)".*/\1/p' | head -n 1
}

# A preview must run the engine the base branch pins. The commit being built can edit its own
# lock; the base lock cannot. Production is the branch that already merged, so its own lock is
# the pin. vercel.json build.env can override variables, which is why CODEOWNERS has to protect
# this script and vercel.json the same way it protects a GitHub Actions workflow.
if [ "${VERCEL_ENV:-preview}" != "production" ]; then
  if [ -z "$base" ]; then
    echo "Pregate: this preview has no merge base with origin/${production}, so the base branch engine pin cannot be read. The deployment is refused." >&2
    exit 1
  fi
  version=$(git show "${base}:${lock}" | engine_of)
else
  version=$(engine_of < "$lock")
fi
printf '%s\n' "$version" | grep -Eqx '[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?'

if ! command -v cosign >/dev/null 2>&1; then
  # Same cosign release the GitHub Actions installer pins (sigstore/cosign-installer v4.1.1).
  cosign_sha=db15cc99e6e4837daabab023742aaddc3841ce57f193d11b7c3e06c8003642b2
  cosign_dir=$(mktemp -d)
  curl -fsSL --proto '=https' --proto-redir '=https' --tlsv1.2 --retry 3 --max-time 120 \
    -o "$cosign_dir/cosign" "https://github.com/sigstore/cosign/releases/download/v3.0.5/cosign-linux-amd64"
  echo "${cosign_sha}  ${cosign_dir}/cosign" | sha256sum -c
  chmod 755 "$cosign_dir/cosign"
  export PATH="${cosign_dir}:${PATH}"
fi

tarname="pregate-${version}-linux-x64.tar.gz"
release="https://github.com/pedroknigge/pregate/releases/download/v${version}"
cache="${root}/.vercel/cache/pregate/${version}"
work=$(mktemp -d)
fetch() {
  curl -fsSL --proto '=https' --proto-redir '=https' --tlsv1.2 --retry 3 --max-time 120 -o "$2" "$1"
}
fetch "${release}/SHA256SUMS" "$work/SHA256SUMS"
fetch "${release}/SHA256SUMS.bundle" "$work/SHA256SUMS.bundle"
fetch "${release}/${tarname}.bundle" "$work/${tarname}.bundle"
mkdir -p "$cache"
if [ -f "${cache}/${tarname}" ]; then
  cp "${cache}/${tarname}" "$work/${tarname}"
fi
(
  cd "$work"
  if [ ! -f "$tarname" ] || ! sha256sum -c --ignore-missing SHA256SUMS; then
    fetch "${release}/${tarname}" "$tarname"
    sha256sum -c --ignore-missing SHA256SUMS
  fi
  identity='^https://github\.com/pedroknigge/pregate/\.github/workflows/release\.yml@refs/tags/v'
  cosign verify-blob --bundle SHA256SUMS.bundle \
    --certificate-identity-regexp "$identity" \
    --certificate-oidc-issuer https://token.actions.githubusercontent.com \
    SHA256SUMS
  cosign verify-blob --bundle "${tarname}.bundle" \
    --certificate-identity-regexp "$identity" \
    --certificate-oidc-issuer https://token.actions.githubusercontent.com \
    "$tarname"
  cp "$tarname" "${cache}/${tarname}"
  tar -xzf "$tarname" pregate
  chmod 755 pregate
)
pregate_bin="${work}/pregate"

head_sha=$(git rev-parse HEAD)
if [ -n "$base" ] && [ "$base" != "$head_sha" ]; then
  echo "Pregate: check --ratchet --base ${base}"
  "$pregate_bin" check --ratchet --base "$base"
else
  parent=""
  if [ -n "$base" ]; then
    parent=$(git rev-parse --verify --quiet "${base}^" || true)
  fi
  if [ -n "$parent" ]; then
    echo "Pregate: check --ratchet --base ${parent}"
    "$pregate_bin" check --ratchet --base "$parent"
  else
    echo "Pregate: no earlier commit to ratchet against. Checking the whole tree."
    "$pregate_bin" check --all
  fi
fi

echo "Pregate: gate passed. Starting the framework build."
"${framework[@]}"
