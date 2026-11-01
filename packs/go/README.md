# Go starter policies

Version 1.0.0. Data-only policies authored for PREGATE; no official language-provider endorsement.

- quality: function parameters/size and mixed-control nesting, plus warnings for dot imports, deprecated `io/ioutil` imports, `context.Context` stored in structs (outside `_test.go`) and a context parameter that is not first.
- architecture: layer edges in explicitly declared core layers.
- effects: selected literal I/O imports in those core layers.

Thresholds are configurable starter policies, not universal quality claims. Init selects quality in shadow; architecture/effects require reviewed layers and explicit selection. Each check has at least two pass, two fail and one alternate-syntax trap.

Grouped parameter names count individually; receivers are excluded. Imports map single-module go.mod and unversioned local replacements to package directories. Use directory layer globs (such as internal/core/**); workspaces, version-specific/outside replacements and build/module-graph semantics are outside coverage.

Source syntax metrics do not certify runtime/compiler correctness. See docs/features/language-analysis.md in the engine repository for exact limits. Run language-specific compiler/tests/linters alongside these checks.

Discover with pregate pack show --library go. Validate with pregate rules test --library go or pregate rules test packs/go from the engine checkout. Add the versioned source with pregate pack add --library go --preview, then select only desired methodologies or invariants. Adding a source does not activate its policy.

<!-- BEGIN generated reference -->

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

## Exact rule contract

Category: **language**. Version: `1.2.0`. 10 distinct check IDs.

Methodologies: `go/architecture` (complete), `go/effects` (complete), `go/quality` (complete).

[Every rule's severity, defaults, provenance, repair guidance and limits](REFERENCE.md). The reviewed preset determines effective policy; these defaults are not a claim of complete framework compliance.
<!-- END generated reference -->
