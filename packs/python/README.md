# Python starter policies

Version 1.0.0. Data-only policies authored for PREGATE; no official language-provider endorsement.

- quality: function parameters/size and mixed-control nesting, declared public methods and bare-except warnings, plus mutable default arguments, `is` against a literal (deny) and wildcard imports outside package `__init__.py`.
- architecture: layer edges in explicitly declared core layers.
- effects: selected literal I/O imports in those core layers.

Thresholds are configurable starter policies, not universal quality claims. Init selects quality in shadow; architecture/effects require reviewed layers and explicit selection. Each check has at least two pass, two fail and one alternate-syntax trap.

Self/cls and variadic arguments each count as a parameter. Public-method metrics count declared non-underscore names, including properties/decorators. Imports model regular root/src packages and bounded initializers; namespace/search-hook/value-flow semantics are outside coverage.

Source syntax metrics do not certify runtime/compiler correctness. See docs/features/language-analysis.md in the engine repository for exact limits. Run language-specific compiler/tests/linters alongside these checks.

Discover with pregate pack show --library python. Validate with pregate rules test --library python or pregate rules test packs/python from the engine checkout. Add the versioned source with pregate pack add --library python --preview, then select only desired methodologies or invariants. Adding a source does not activate its policy.

<!-- BEGIN generated reference -->

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

## Exact rule contract

Category: **language**. Version: `1.2.0`. 12 distinct check IDs.

Methodologies: `python/architecture` (complete), `python/effects` (complete), `python/quality` (complete).

[Every rule's severity, defaults, provenance, repair guidance and limits](REFERENCE.md). The reviewed preset determines effective policy; these defaults are not a claim of complete framework compliance.
<!-- END generated reference -->
