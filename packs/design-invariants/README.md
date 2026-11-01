# Design invariants

An optional preview pack for design statements that are not already active core
invariants. Forty-eight evidence gates keep one owner each. Select a
methodology, or use `--only` for a reviewed subset. Core stays on. The ledger
in the feature guide maps all 104 supplied statements, including the ones core
already owns.

| Methodology | IDs | Purpose |
| --- | --- | --- |
| `design-invariants/design-principles` | DESIGN-001–004 | Extension, substitution, bounded cleanup, measured performance |
| `design-invariants/package-principles` | DESIGN-005–015 | Release, closure, reuse, acyclic packages, stability, GRASP |
| `design-invariants/architecture` | DESIGN-016–018 | Acyclic components, team boundaries, quality attributes |
| `design-invariants/domain-state` | DESIGN-019–023 | Aggregate access, loop and derived-state consistency, local immutability, event history |
| `design-invariants/code-quality` | DESIGN-024–029 | Reviewed size and parameters, narrative, scope, initialization, const |
| `design-invariants/error-handling` | DESIGN-030–033 | Checked results, type errors, visible failures, resource release |
| `design-invariants/security` | DESIGN-034–037 | Independent controls, encryption, secret rotation, secure defaults |
| `design-invariants/testing` | DESIGN-038–043 | Automated tests, FIRST, arrange-act-assert, test-first, properties, green main branch |
| `design-invariants/performance-and-data` | DESIGN-044 | Data structure matches the dominant access |
| `design-invariants/process` | DESIGN-045–048 | Unattended build/test/format, real use, one cause at a time, review |

```sh
pregate pack show --library design-invariants --json
pregate rules test --library design-invariants
```

Read the [ledger and requirements](../../docs/features/design-invariants-pack.md)
and [evidence adoption](../../docs/guides/readiness-packs.md). Missing product
assertions stay unverified. Receipt fixtures test evidence admission, not 48
production behaviors. Size, parameter, narrative, and cleanup gates are the
project's reviewed standard.

<!-- BEGIN generated reference -->

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

## Exact rule contract

Category: **invariants**. Version: `1.0.0`. 48 distinct check IDs.

Methodologies: `design-invariants/architecture` (preview), `design-invariants/code-quality` (preview), `design-invariants/design-principles` (preview), `design-invariants/domain-state` (preview), `design-invariants/error-handling` (preview), `design-invariants/package-principles` (preview), `design-invariants/performance-and-data` (preview), `design-invariants/process` (preview), `design-invariants/security` (preview), `design-invariants/testing` (preview).

[Every rule's severity, defaults, provenance, repair guidance and limits](REFERENCE.md). The reviewed preset determines effective policy; these defaults are not a claim of complete framework compliance.
<!-- END generated reference -->
