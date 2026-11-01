# design-invariants backlog

Candidates, static slice mappings, and engine boundaries for the `design-invariants` pack.

The `design-invariants` pack defines 48 optional project evidence gates (`DESIGN-001` through `DESIGN-048`) across 10 preview methodologies:
1. `design-invariants/design-principles` (`DESIGN-001`–`DESIGN-004`)
2. `design-invariants/package-principles` (`DESIGN-005`–`DESIGN-015`)
3. `design-invariants/architecture` (`DESIGN-016`–`DESIGN-018`)
4. `design-invariants/domain-state` (`DESIGN-019`–`DESIGN-023`)
5. `design-invariants/code-quality` (`DESIGN-024`–`DESIGN-029`)
6. `design-invariants/error-handling` (`DESIGN-030`–`DESIGN-033`)
7. `design-invariants/security` (`DESIGN-034`–`DESIGN-037`)
8. `design-invariants/testing` (`DESIGN-038`–`DESIGN-043`)
9. `design-invariants/performance-and-data` (`DESIGN-044`)
10. `design-invariants/process` (`DESIGN-045`–`DESIGN-048`)

Together with the 56 core invariants that cover the remainder of the 104 supplied design statements, these 48 rules use `primitive: fitness`. Below is the mapping between static AST checks available in companion packs and inherent semantic/runtime obligations.

## Companion static AST slices

- **Domain & Local Immutability (`DESIGN-019`, `DESIGN-022`):**
  - *Static slices:* `ddd/value-objects/readonly-fields` (`DDD-VO-001`), `ddd/value-objects/no-public-setters` (`DDD-VO-002`), `ddd/entities/no-public-mutable-fields` (`DDD-ENT-001`), `senior/style/no-var` (`SR-VAR-001`), and `senior/style/no-param-reassign` (`SR-MUT-001`).
- **Function Size, Parameters & Control Nesting (`DESIGN-024`):**
  - *Static slices:* `clean-code/complexity/fn-max-lines` (`CC-FN-001`), `clean-code/complexity/fn-max-params` (`CC-FN-002`), `clean-code/complexity/nesting-max-depth` (`CC-NEST-001`), and `maintainability/complexity/cognitive-complexity` (`MAINT-NEST-001`).
- **Visible Failures & Error Handling (`DESIGN-032`):**
  - *Static slices:* `clean-code/errors/no-empty-catch` (`CC-ERR-001`) and `clean-code/errors/try-is-whole-function` (`CC-ERR-002`).
- **Test Integrity (`DESIGN-038`–`DESIGN-043`):**
  - *Static slices:* `testing/testing/no-focused-tests` (`TDD-FOCUS-001`), `testing/testing/no-unconditional-skip` (`TDD-SKIP-001`), `testing/testing/assertions-no-decrease` (`TDD-DEL-001`), and `testing/testing/no-try-catch-in-test` (`TEST-NOCATCH-001`).

## Inherent project fitness boundaries

- **Liskov Substitution, Open-Closed & GRASP (`DESIGN-001`, `DESIGN-002`, `DESIGN-011`–`DESIGN-015`):**
  - Behavioral subtyping, extension points, and responsibility assignment depend on subtype postconditions and change history across releases.
- **Package Cohesion & Stability (`DESIGN-005`–`DESIGN-010`, `DESIGN-016`–`DESIGN-018`):**
  - Common Closure, Common Reuse, Stable Dependencies, and Stable Abstractions require workspace package graphs and release-cadence evidence beyond single-file AST patterns.
- **Encryption, Secret Rotation & Dominant Access Complexity (`DESIGN-035`, `DESIGN-036`, `DESIGN-044`):**
  - Verifying key rotation procedures, at-rest/in-transit cipher configuration, and workload-matched data structures requires benchmark and infrastructure verification receipts.
