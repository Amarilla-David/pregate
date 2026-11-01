# ddd backlog

Practices from *Domain-Driven Design* (E. Evans, 2003) and *Implementing Domain-Driven Design* (V. Vernon, 2013) that are not decidable from a single file's syntax tree without semantic domain knowledge.

## Implemented static slices in `ddd/ddd-tactical`

- **`DDD-VO-001` (`ddd/value-objects/readonly-fields`):** Requires fields on classes in `**/value-objects/**` and `**/*.vo.ts` to be `readonly` or `private`.
- **`DDD-VO-002` (`ddd/value-objects/no-public-setters`):** Denies public setter methods (`set value(...)` or `setX(...)`) on value-object classes.
- **`DDD-ENT-001` (`ddd/entities/no-public-mutable-fields`):** Denies public non-`readonly` fields on entity classes (`**/entities/**`, `**/*.entity.ts`), requiring state transitions to pass through domain methods.

## Companion checks in `architecture`

- **`architecture/ACL-REEXPORT-001`:** Prevents anti-corruption layers (`acl/`) from re-exporting upstream package types directly.
- **`architecture/REPO-ROW-001`:** Prevents repositories from returning raw persistence rows (`row`, `record`, `raw`) without mapping to domain types.
- **`architecture/HEX-EDGE-001` & `architecture/ARCH-EFF-002`:** Keep domain and entity modules free of adapter imports and ambient clock/crypto nondeterminism.

## Non-decidable tactical and strategic DDD practices

- **Ubiquitous Language alignment:** Verifying that class, method, and event names match the bounded context's glossary requires human domain review (`design-invariants` and `agent-practices/domain-ownership` track this as project fitness evidence).
- **Aggregate consistency boundaries & transaction scope:** Deciding whether an operation modifies two aggregates in a single database transaction or violates an aggregate root's business invariant requires dataflow and transaction-boundary verification.
- **Value object structural equality:** Checking whether two value objects compare equal by all of their attributes (or via an `equals()` method) is runtime behavior; in TypeScript, plain `readonly` interfaces and classes vary by project convention.
- **Domain event past-tense naming & immutability:** While payload `readonly` modifiers can be checked when event paths are standardized, deciding whether an event captures a meaningful domain occurrence vs. a CRUD property change is a modeling judgment.
- **Bounded Context maps (Customer-Supplier, Conformist, Shared Kernel):** Strategic relationships between teams and subsystems belong to architecture documentation and `preset.json` layer definitions (`architecture/MOD-SHARED-001`, `architecture/MOD-EDGE-001`).
