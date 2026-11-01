# Give the agent the decisions it cannot infer

An agent can suggest mechanisms. It still needs the project's facts to choose and
verify them. Record a small design contract before a risky change. Start with the
observed change or failure, not a complete architecture for an imagined future.
Keep it in the repository so later tasks use the same meanings and limits.

## Write a short change brief

| Decision | Record | Verification |
| --- | --- | --- |
| Domain boundary | Owner, reason for change, allowed operations and legal state transitions | Test accepted and rejected transitions; test callers that bypass UI validation |
| Relationships | Identity, cardinality, ownership, optionality and conflict policy | Test empty, one, many, duplicate and cross-owner cases; enforce the real constraints |
| Values | Units, precision, time zone, locale and reference frame where relevant | Test rounding, conversions, boundary values and incompatible units or frames |
| Data model | Actual access patterns, consistency needs, lifecycle and source of truth | Test transaction/conflict behavior and migration with old data; justify another model with observed needs |
| External boundary | Inputs, outputs, timeout, retry/idempotency policy and failure result | Contract tests include timeout, malformed input, repeated delivery and access denial |
| Work budget | Maximum records, dependency calls, concurrency, payload and latency | Measure realistic bounded inputs and reject an over-budget or unbounded path |
| Change evidence | The axis that already changed and the smallest replaceable contract | A fitness assertion exercises replacement or forbidden dependency; a written reason explains the tradeoff |

For geometry, state the relationship that matters: containment, adjacency,
distance, coordinate frame or another actual domain property. Do not add geometry
to a product that does not use it. For storage, choose representations from the
real queries and consistency constraints. One database model is not universally
correct, and several models add synchronization work that needs explicit proof.
Close-to-metal design is useful when measured constraints require it; it is not
a default reason to remove a stable boundary or reimplement a proven library.

## Turn the brief into a bounded assertion

Suppose a page lists at most 100 orders and their customer labels. Record whether
each label must be current, whether a bulk read is possible, and which tenant owns
each order. An assertion can count database calls at 1, 10 and 100 orders, check a
maximum request count, reject a cross-tenant lookup and check the displayed result.
An invalid control puts a lookup in the per-order loop and must fail the same
assertion. A green unit test of the local mapping function cannot prove the query
budget or tenant isolation.

Ask the agent:

> Read our design contract and the actual call path. Identify missing facts about
> boundaries, relationships, units and work budgets. Propose the simplest change
> that meets the recorded constraints. Show a behavior assertion and an invalid
> control for each claimed rule. Keep uncovered conditions explicit. Prepare all
> selected fitness candidates for one review; do not approve or execute them yet.

Use [domain language](domain-language.md) for a small typed command vocabulary,
[project fitness](../features/project-fitness.md) for reviewed assertions and the
[rule-pack worksheet](rule-pack-worksheet.md) for repeated mistakes. Syntax checks
belong in the relevant optional language/library pack; project vocabulary and
business decisions belong in its custom pack and evidence definitions. Avoid
copying a general prompt into every rule or treating prose as execution evidence.
