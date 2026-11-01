#!/bin/sh
# PREGATE pre-commit (ARCHITECTURE §4.5, MULTI-HARNESS MH-28). `pregate install --git-hook` commits it as
# .pregate/git-hooks/pre-commit. The staged tree is checked against HEAD with the lock recompiled from
# the index, by the global pregate, which runs the engine the lock pins (MH-19). It runs from the
# PREGATE root, which may be a subfolder of the repository.
cd "$(dirname "$0")/../.." || exit 1
t=$(command -v pregate) || t=$HOME/.local/bin/pregate
# An empty file would run as an empty script: exit 0, a commit nobody checked.
[ -x "$t" ] && [ -s "$t" ] || {
  printf '%s\n' 'PREGATE is not installed on this machine; this repo requires it. Install PREGATE (pregate setup) and retry the commit.' >&2
  exit 1
}
exec "$t" check --staged --ratchet
