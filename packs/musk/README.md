# musk

Rules derived from **Elon Musk's 5-step engineering algorithm** applied to software architecture, source trees, and development workflows:

1. **Make requirements less dumb**: Every requirement is dumb to some degree. Requirements must come with a name, not an anonymous team or generic suppression.
2. **Delete the part or process step**: If you are not adding things back 10% of the time, you are not deleting enough. Eliminate redundant process steps (e.g. useless try/catch rethrow wrappers).
3. **Simplify or optimize**: The most common error of a smart engineer is optimizing something that should not exist. Eliminate gratuitous complexity and nesting (guard clauses over redundant else blocks).
4. **Accelerate cycle time**: Move fast, but only after steps 1–3. Ban synchronous blocking I/O calls that stall the event loop and serialize execution.
5. **Automate**: The final step. Automate verification and never bypass or disable automated test execution in committed repositories.

## User control

The contract is the repository preset, not this pack. Take every pack, some packs, or some rules:

- Omit a pack by leaving it out of `sources`.
- Omit a methodology by leaving it out of `methodologies`.
- Turn one rule down or off with `overrides` (`off`, `warn`, `ask`, or `deny`). The key is `musk/MUSK-REQ-001`.
- When two methodologies disagree on one dimension, pick a side in `resolve`.
- `enforcement: "shadow"` sets the preset default. An override's `enforcement` selects `shadow` or `enforce` for one alias or check. Integrity always enforces. See [preset examples](../presets/README.md).

Ready-made preset: `packs/presets/musk-algorithm.json`.

## Rules

| ID | Forbids | Why | Default severity |
| --- | --- | --- | --- |
| `MUSK-REQ-001` | Anonymous `@ts-ignore`, `@ts-nocheck`, `@ts-expect-error`, or `eslint-disable` without an attributed owner or ticket. | Step 1 (Make requirements less dumb): A requirement to bypass safety must come from a person with a name, not an unaccountable anonymous directive. | deny |
| `MUSK-DEL-001` | A `try { ... } catch (err) { throw err; }` block that immediately rethrows without handling, logging, or transforming. | Step 2 (Delete the part or process step): A pass-through catch is an unnecessary process step that adds churn and noise. Delete the wrapper entirely. | deny |
| `MUSK-SIMP-001` | An `else` block following a branch that unconditionally returns or throws. | Step 3 (Simplify or optimize): Flatten control flow using guard clauses and early exits instead of gratuitous nesting. | deny |
| `MUSK-FAST-001` | Synchronous blocking I/O calls (`readFileSync`, `writeFileSync`, `execSync`, etc.) outside test files. | Step 4 (Accelerate cycle time): Blocking calls freeze the event loop, serialize workloads, and destroy throughput and response times. | deny |
| `MUSK-AUTO-001` | Skipping or focusing automated tests (`test.skip`, `it.skip`, `describe.skip`, `fit`, `xit`, `it.only`, etc.). | Step 5 (Automate): Automated test suites must run continuously and reliably; skipping tests circumvents automated safety guarantees. | deny |

## Methodologies

- `musk/algorithm` — MUSK-REQ-001, MUSK-DEL-001, MUSK-SIMP-001, MUSK-FAST-001, MUSK-AUTO-001

Non-decidable practices from the engineering algorithm are documented in [`BACKLOG.md`](BACKLOG.md).

<!-- BEGIN generated reference -->

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

## Exact rule contract

Category: **process**. Version: `1.0.1`. 5 distinct check IDs.

Methodologies: `musk/algorithm` (complete).

[Every rule's severity, defaults, provenance, repair guidance and limits](REFERENCE.md). The reviewed preset determines effective policy; these defaults are not a claim of complete framework compliance.
<!-- END generated reference -->
