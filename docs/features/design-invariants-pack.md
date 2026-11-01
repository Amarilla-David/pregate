# Design invariants pack

Optional preview pack for the supplied design, package, architecture, domain,
quality, safety, security, testing, performance, and process statements that
are not already an active core invariant.

The supplied list has **104 statements**. Fifty-five are already active core
invariants. This pack adds **48** project-evidence gates, in ten methodologies,
for the statements core does not already own. Core stays on. Statement 83 is
split: hardcoding stays on `CORE-INV-040`, and rotation is `DESIGN-036`.
Statements 18 and 94 share `DESIGN-004`. This pack does not restate a core
rule as a second unverified obligation.

These gates are fitness obligations. A receipt proves that the reviewed
assertion ran on the current inputs. It does not prove the principle. Size,
parameter count, naming narrative, Boy Scout cleanup, and arrange-act-assert
are project standards with a reviewed bound, not universal line or keyword
limits. `bun scripts/readiness-packs.ts` owns the manifests, checks, and
receipt fixtures. This document owns the ledger and the requirement text.

## How to adopt

```sh
pregate pack add --library design-invariants --preview
pregate pack enable design-invariants/security --only DESIGN-034,DESIGN-035 --preview
```

Or one plan that selects the methodologies you want:

```json
{
  "sources": [{ "kind": "library", "ns": "design-invariants" }],
  "methodologies": ["design-invariants/security", "design-invariants/testing"]
}
```

```sh
pregate pack apply plan.json --preview
```

Bind each adopted id with `pregate fitness bind <id> --preview`. Include a
failing control. Unbound ids stay unverified. Optional rules stay in shadow
until a reviewed enforcement override. Do not treat a green suite as proof of
every id it was not written for.

## Ledger

Each supplied statement has one owner. A core id is already enforced as an
active invariant. A `DESIGN` id is a new evidence gate. Notes name a related
optional slice that does not prove the statement.

| # | Statement | Invariant | Note |
| --- | --- | --- | --- |
| 1 | Keep it simple | CORE-INV-027 | |
| 2 | Do not repeat knowledge | CORE-INV-012 | |
| 3 | Do not build what is not needed yet | CORE-INV-026, CORE-INV-006 | 006 limits speculative abstractions |
| 4 | Separate concerns | CORE-INV-001 | |
| 5 | One reason to change | CORE-INV-007 | |
| 6 | Open for extension, closed for modification | DESIGN-001 | Extension only once a real variant exists |
| 7 | Subtypes substitute for their base type | DESIGN-002 | |
| 8 | Small client-specific interfaces | CORE-INV-011 | |
| 9 | Depend on abstractions | CORE-INV-005 | |
| 10 | High cohesion | CORE-INV-002 | |
| 11 | Low coupling | CORE-INV-002 | |
| 12 | Law of Demeter | CORE-INV-009 | |
| 13 | Composition over inheritance | CORE-INV-010 | |
| 14 | Encapsulation | CORE-INV-003 | |
| 15 | Least astonishment | CORE-INV-033 | The name predicts the behavior |
| 16 | Command-query separation | CORE-INV-017 | |
| 17 | Leave touched code cleaner | DESIGN-003 | Bounded to code the change already edits |
| 18 | Measure before optimizing | DESIGN-004 | Same gate as statement 94 |
| 19 | Prefer explicit dependencies and intent | CORE-INV-008, CORE-INV-016, CORE-INV-024 | |
| 20 | Design for deletion | CORE-INV-028 | |
| 21 | Reuse-release equivalence | DESIGN-005 | |
| 22 | Common closure | DESIGN-006 | |
| 23 | Common reuse | DESIGN-007 | |
| 24 | Acyclic package dependencies | DESIGN-008 | |
| 25 | Stable dependencies | CORE-INV-005 | |
| 26 | Stable abstractions | DESIGN-009 | |
| 27 | Information expert | DESIGN-010 | |
| 28 | Creator | DESIGN-011 | |
| 29 | Controller | DESIGN-012 | |
| 30 | Pure fabrication | DESIGN-013 | |
| 31 | Indirection | DESIGN-014 | Only where it reduces a real coupling |
| 32 | Protected variations | CORE-INV-003 | |
| 33 | Polymorphism for type alternatives | DESIGN-015 | A closed set may stay an exhaustive branch |
| 34 | Dependencies point inward | CORE-INV-013 | Optional layer edges: architecture/dependency-rule |
| 35 | Depend toward stable abstractions | CORE-INV-005 | |
| 36 | Isolate volatile parts | CORE-INV-003, CORE-INV-030 | 030 forbids an extension for a change not yet seen |
| 37 | Business rules independent of delivery | CORE-INV-013, CORE-INV-018 | |
| 38 | Explicit, injectable dependencies | CORE-INV-008 | |
| 39 | Acyclic component graph | DESIGN-016 | Package cycles are DESIGN-008 |
| 40 | Independent, interchangeable parts | CORE-INV-001, CORE-INV-028 | |
| 41 | Hide implementation across boundaries | CORE-INV-003 | |
| 42 | Fail fast | CORE-INV-019 | |
| 43 | Design for failure | CORE-INV-022, CORE-INV-023 | |
| 44 | Idempotent retries | CORE-INV-021 | |
| 45 | Conway: design the system and the teams | DESIGN-017 | |
| 46 | Quality attributes drive architecture | DESIGN-018 | |
| 47 | Always-valid domain objects | CORE-INV-014 | |
| 48 | The model protects its invariants | CORE-INV-014 | |
| 49 | Valid immediately after construction | CORE-INV-014 | |
| 50 | Aggregate roots control access | DESIGN-019 | ddd/ddd-tactical does not prove this access rule |
| 51 | Loop properties hold each iteration | DESIGN-020 | |
| 52 | Derived structures match their source | DESIGN-021 | Domain state remains CORE-INV-014 |
| 53 | Immutable local values | DESIGN-022 | Shared cross-boundary data remains CORE-INV-015 |
| 54 | Minimize shared mutable state | CORE-INV-015 | |
| 55 | One source of truth | CORE-INV-012 | |
| 56 | Record events when audit or rebuild matters | DESIGN-023 | |
| 57 | Names reveal intent | CORE-INV-018, CORE-INV-033 | |
| 58 | A function does one thing | CORE-INV-007 | |
| 59 | Functions stay within a reviewed size | DESIGN-024 | Project bound; expectation is one screen |
| 60 | One level of abstraction | CORE-INV-034 | |
| 61 | Few parameters, no behavior flag | DESIGN-025 | clean-code parameter metric is a separate optional slice |
| 62 | No magic numbers or strings | CORE-INV-036 | |
| 63 | Readable over clever | CORE-INV-032 | |
| 64 | Written for the maintainer | CORE-INV-032 | |
| 65 | Reads top-down | DESIGN-026 | |
| 66 | Pure computation separate from state change | CORE-INV-017, CORE-INV-024 | |
| 67 | Smallest scope | DESIGN-027 | |
| 68 | Initialized before read | DESIGN-028 | |
| 69 | Constant unless it must change | DESIGN-029 | |
| 70 | Details behind an interface or facade | CORE-INV-003 | |
| 71 | Failures are not swallowed | CORE-INV-019, CORE-INV-020 | |
| 72 | Check a result, or ignore it explicitly | DESIGN-030 | |
| 73 | Prefer a type error to a runtime error | DESIGN-031 | |
| 74 | Broken internal assumptions fail | CORE-INV-019 | |
| 75 | Continue in a reduced mode | CORE-INV-022, CORE-INV-023 | |
| 76 | Timeouts and circuit breakers | CORE-INV-022, CORE-INV-023 | |
| 77 | Failure is visible in the type or control flow | DESIGN-032 | |
| 78 | Resources are released on every path | DESIGN-033 | |
| 79 | Validate boundary input | CORE-INV-039 | |
| 80 | Least privilege | CORE-INV-038 | |
| 81 | More than one independent control | DESIGN-034 | |
| 82 | Encrypt sensitive data at rest and in transit | DESIGN-035 | |
| 83 | Secrets stay out of code and are rotated | CORE-INV-040, DESIGN-036 | 040 owns hardcoding; 036 owns rotation |
| 84 | The default configuration is the secure one | DESIGN-037 | |
| 85 | Automated unit, integration, and useful end-to-end tests | DESIGN-038 | |
| 86 | Tests are fast, isolated, and repeatable | DESIGN-039 | |
| 87 | Arrange, act, assert | DESIGN-040 | |
| 88 | Test domain behavior directly | CORE-INV-044 | |
| 89 | Test-first where the team uses it | DESIGN-041 | testing/tdd covers the suite before integrate |
| 90 | Property tests for selected complex invariants | DESIGN-042 | |
| 91 | Required main-branch checks stay green | DESIGN-043 | |
| 92 | Concurrent code avoids shared mutable state | CORE-INV-015 | |
| 93 | Shared data is not shared mutable memory | CORE-INV-015 | Message passing is one way to satisfy it |
| 94 | Profile before a performance change | DESIGN-004 | Same gate as statement 18 |
| 95 | Structure matches the dominant access | DESIGN-044 | |
| 96 | No accidental N+1 or cardinality blow-up | CORE-INV-047 | |
| 97 | Bound loops and resource use | CORE-INV-046, CORE-INV-047 | |
| 98 | Dependencies are pinned, locked, audited, and justified | CORE-INV-049, CORE-INV-050, CORE-INV-051, CORE-INV-052, CORE-INV-053 | |
| 99 | Automate builds, tests, and formatting | DESIGN-045 | Deployment automation remains CORE-INV-059 |
| 100 | Check assumptions against real use | DESIGN-046 | |
| 101 | Record why a decision was made | CORE-INV-062 | |
| 102 | Change one cause at a time | DESIGN-047 | |
| 103 | Someone other than the author reviews the change | DESIGN-048 | |
| 104 | Use the least mechanism that solves the problem | CORE-INV-026, CORE-INV-035 | |

## Requested invariant rules

### Design principles

1. When a real new variant arrives, add it by extension. Do not rewrite the existing variant's behavior to make room for it, and do not add the extension point before that variant exists.
2. A subtype can stand in for its base type for every caller of the base contract without changing the outcome that contract promises.
3. A change leaves the code it already edits cleaner than it found it, and does not open an unrelated cleanup.
4. A performance change targets a bottleneck a measurement has shown.

### Package principles

5. A reused package is released as one unit. Callers depend on that release, not on unpublished internals of a subset.
6. Types that change for the same reason live in the same package.
7. Types that callers use together live in the same package. Depending on the package does not force a caller to take types it does not use.
8. The dependency graph among packages has no cycle.
9. A package that others depend on for stability is more abstract than the packages that depend on it.
10. A responsibility belongs to the type that already holds the information the responsibility needs.
11. An object is created by a type that contains it, records it, or closely uses it.
12. A system event is handled by a controller that represents the use case or the system, not by a user-interface or persistence type.
13. A type that is not a domain concept exists only when that type is what keeps cohesion high and coupling low.
14. An intermediate object exists only where it reduces a real coupling.
15. Where the set of alternatives is open, callers select among types by a polymorphic operation. A closed set may use an explicit exhaustive branch.

### Architecture

16. Major components have no circular source dependency.
17. A decision that draws a component boundary records the team boundary it mirrors, or the reason it does not.
18. The architecture records the quality attributes it prioritizes. A change that trades one of them off names that trade.

### Domain state

19. Code outside an aggregate reads and changes that aggregate's internal entities only through the aggregate root.
20. Where a loop's correctness depends on a stated property, that property holds at the start and at the end of each iteration.
21. A cache, index, or other derived structure matches the source it represents after every update the product claims is consistent.
22. A local value that no requirement changes is immutable. Shared data that crosses a thread, process, or time boundary remains CORE-INV-015.
23. When the product requires audit or rebuild, it records the events that produced the current state, and that state can be rebuilt from those events.

### Code quality

24. Each function stays within the size bound the project has reviewed. The supplied expectation is that a function fits on one screen. This gate is that reviewed bound, not a universal line limit.
25. Each function stays within the reviewed parameter budget. The supplied expectation is at most two parameters and no boolean flag whose only job is to select behavior.
26. A unit reads from the general statement down to the detail, and that detail is a named unit below it.
27. A name is declared in the smallest scope that uses it.
28. A variable has a value before any read.
29. A binding that is not assigned again is constant or immutable.

### Error handling

30. A returned error or result is checked, or the choice to ignore it is explicit.
31. A fault that the language's type system can express is rejected at compile time.
32. An operation that can fail shows that failure in its type or in its control flow.
33. A resource is released on every path that acquires it, including a failure path.

### Security

34. A security-sensitive action is checked by more than one independent control.
35. Sensitive data is encrypted at rest and in transit.
36. A secret is rotated on a reviewed schedule. Keeping the secret out of code and logs remains CORE-INV-040.
37. The configuration that applies when the operator sets nothing is the secure configuration.

### Testing

38. The project has automated unit tests and integration tests, and an end-to-end test where smaller tests cannot see the behavior.
39. An automated test is fast, isolated, and repeatable. It does not depend on order, another test's clock, or a shared mutable fixture it does not own.
40. A unit test separates arrange, act, and assert.
41. Where the team uses test-first for a change, a failing test exists before the production change that makes it pass.
42. A complex invariant the project selects for generative testing has a property test that fails on a violating input.
43. The main branch's continuous integration is green for the checks the project requires.

### Performance and data

44. The structure used on a hot access path matches that path's dominant reads and writes.

### Process

45. A build, test, or formatting step that can run unattended does run unattended. Deployment automation remains CORE-INV-059.
46. A product assumption is checked against real use before the work is treated as complete.
47. A debugging or refactoring session changes one cause at a time, and the result of that change is known before the next change.
48. A change is reviewed by someone other than its author before it is integrated, or the project records an explicit exception for that change.
