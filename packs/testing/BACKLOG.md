# testing backlog

Practices from *Test-Driven Development: By Example* (K. Beck, 2002), *Test Desiderata* (K. Beck, 2019), and *xUnit Test Patterns* (G. Meszaros, 2007) that are not decidable from a single test file's syntax tree.

## Implemented static and diff slices in `testing/tdd`

- **`TDD-FOCUS-001` (`testing/testing/no-focused-tests`):** Denies `.only`, `.skip`, `fit`, `fdescribe`, `xit`, and `xdescribe` in TypeScript/JavaScript test suites, except Playwright's runtime `test.skip(condition, reason)` inside a test body, hook or describe callback.
- **`TDD-SKIP-001` (`testing/testing/no-unconditional-skip`):** Warns on unconditional `@pytest.mark.skip`, `@unittest.skip`, `pytest.skip()`, `self.skipTest()`, and unguarded Go `t.Skip*()` calls.
- **`TDD-DEL-001` (`testing/testing/assertions-no-decrease`):** Requests human review (`ask`) when a diff reduces the number of assertions in a test file.
- **`TEST-NOCATCH-001` (`testing/testing/no-try-catch-in-test`):** Warns on manual `try / catch` blocks inside `test(...)` or `it(...)` callbacks so expected throws are asserted via `expect(() => ...).toThrow()` or `expect(...).rejects`.

## Companion test checks in `pstack` and `mattpocock`

- **`pstack/PS-PROOF-001` (`pstack/testing/test-has-assertion`):** Denies test blocks without any assertion call.
- **`pstack/PS-PROOF-002` (`pstack/testing/no-weak-assertion`):** Flags vacuous truthiness assertions (`toBeDefined`, `toBeTruthy`) when stronger value assertions apply.
- **`mattpocock/MP-SELF-001` (`mattpocock/tests/no-self-equality`):** Warns on `expect(x).toEqual(x)` self-comparisons.
- **`mattpocock/MP-MOCK-001` (`mattpocock/tests/no-internal-module-mock`):** Warns on mocking relative internal modules.
- **`mattpocock/MP-CALLS-001` & `MP-MOCK-BRANCH-001`:** Warn on brittle call-count/order matchers and conditional logic inside mock implementations.

## Non-decidable testing practices kept out of static AST checks

- **Red-Green-Refactor temporal order:** Proving that a failing test was observed before production code was written requires ordered execution history across the session.
- **Behavioral sensitivity & predictive value (Test Desiderata):** Whether a test fails on real production regressions while remaining insensitive to internal refactoring requires mutation testing or behavioral execution receipts (`CORE-INV-053`–`CORE-INV-057`, `agent-practices/behavior-testing`).
- **Assertion oracle independence:** Determining whether an expected value was computed from the domain specification rather than copied from buggy output requires human review or property-based specification.
- **Hermetic test isolation (no shared mutable state or live network):** While direct `fetch()` calls can be flagged in unit-test paths, helper modules and database fixtures require runtime sandboxing to prove hermeticity.
