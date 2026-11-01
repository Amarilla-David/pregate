# See the first useful decision

Run `pregate demo` from any directory. It creates tiny Python, Go and Rust repositories, installs
an isolated launcher, and exercises the same pre-write protocol used by Claude Code. Everything
created by the demo is removed when it finishes. It downloads no tools or dependencies.

Each sample makes one project decision explicit: domain code cannot import infrastructure.
The initial repository contains an existing forbidden import. The `no-new` ratchet permits
unchanged debt, denies a new forbidden dependency before writing, and accepts a valid repair.
The demo then repairs the original debt. Invalid syntax and a new generated-code comment also
receive real denials. A repeated accepted edit remains a no-op.

The forbidden proposal and the valid repair both calculate the requested total. When native
tooling is available, the demo proves that the rejected proposal passes its behavior test in a
separate temporary copy. The protected repository never receives that forbidden write: the
architecture constraint catches a dependency that the behavior test permits.

```sh
pregate demo --language python
pregate demo --language go
pregate demo --language rust
pregate demo --json
```

The demo approves only the toy contracts that it creates. This is sample automation, not a test
of human approval or a live coding-agent interface. It does not activate your projects or change
your global settings. Run `pregate guide` in a real project to review that project's scope and rules.

The samples record language quality policies in shadow mode and enforce the architecture rule,
with explicit domain and infrastructure layers. Core requirements remain active. These are selected project policies, not a claim that every
architecture must use these layers. Core fitness requirements remain **UNVERIFIED** throughout:
zero static architecture findings does not prove domain correctness, security or performance.

When the native language tool is already available, the demo also runs its own behavior tests
before and after repair. Missing tooling is shown as `not-verified`; the demo does not install it.
Rust invokes an installed compiler directly and builds only these dependency-free source files.
Go disables dependency downloads and toolchain auto-download. Each subprocess has a 30-second
budget; a present tool that fails its test fails the demo.

From a source checkout, `sh scripts/demo.sh` compiles a production binary in a temporary folder
and runs the same command. `sh scripts/demo.sh /absolute/path/to/pregate` uses an existing compiled
binary. JSON output includes the binary hash, bounded command receipts and remaining fitness gaps.
