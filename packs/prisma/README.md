# prisma

Prisma client invariants that the syntax tree can decide. The stance of this pack is: raw SQL only through the parameterizing template forms; never load a full relation with `: true`; every findFirst names its winner with orderBy; bulk writes always carry a where filter; route handlers share one client; and query text never reaches the logs. This pack enforces TypeScript client usage only — `.prisma` schema files have no grammar, so schema-level rules live in `BACKLOG.md`.

This pack complements `vibe-proof`: VP-SQL-001 misses `$queryRaw` / `$executeRaw` shapes and VP-FIND-MANY-001 covers unbounded findMany, so this pack closes the Unsafe hole, the concat hole, and the nondeterministic findFirst instead of duplicating them.

## User control

The contract is the repository preset, not this pack. Take every pack, some packs, or some rules:

- Omit a pack by leaving it out of `sources`.
- Omit a methodology by leaving it out of `methodologies`.
- Turn one rule down or off with `overrides` (`off`, `warn`, `ask`, or `deny`). The key is `prisma/PRISMA-RAW-001`.
- When two methodologies disagree on one dimension, pick a side in `resolve`.
- `enforcement: "shadow"` sets the preset default. An override's `enforcement` selects `shadow` or `enforce` for one alias or check. Integrity always enforces. See [preset examples](../presets/README.md).

Ready-made combinations live in `packs/presets/`.

## Rules

| ID | Forbids | Why | Default severity |
| --- | --- | --- | --- |
| `PRISMA-RAW-001` | `$queryRawUnsafe` / `$executeRawUnsafe` calls, which never parameterize. | An Unsafe call concatenates caller input straight into SQL. | deny |
| `PRISMA-SQL-001` | `$queryRaw` / `$executeRaw` with string concatenation (`+`) in the arguments. | Concatenation bypasses the parameterization the template form would apply. | deny |
| `PRISMA-RAW-002` | `Prisma.raw` whose first argument is a template with `${}` or a `+` concatenation. | `Prisma.raw` text is SQL syntax; the docs list interpolated `Prisma.raw` as injectable. | deny |
| `PRISMA-SELECT-001` | `include: { <relation>: true }`, loading a full relation without a nested select. | A full-relation include pulls every column of every related row. | deny |
| `PRISMA-TAKE-001` | `findFirst` / `findFirstOrThrow` with no `orderBy`. | Without an order the picked row is nondeterministic. | deny |
| `PRISMA-DELETE-001` | `deleteMany` with no `where` in the call. | A missing filter turns a scoped cleanup into a table wipe. | deny |
| `PRISMA-UPSERT-001` | `updateMany` with no `where` in the call. | A data-only call rewrites the column on every row. | deny |
| `PRISMA-TXCLIENT-001` | A model or raw query on the outer client inside an interactive `$transaction` callback. | Only queries on the callback's `tx` run in the transaction; the others commit on their own. | warn |
| `PRISMA-CONNECT-001` | `new PrismaClient()` inside route and API handler files. | A fresh client per request exhausts database connections. | deny |
| `PRISMA-LOG-001` | `new PrismaClient()` with a `query` log level. | Query logs carry SQL and bind parameters into log storage. | deny |
| `PRISMA-EMPTY-WHERE-001` | `.deleteMany({ where: {} })` or `.updateMany({ where: {}, ... })` with an empty `where` object. | An empty `where: {}` filter matches every row in the table just like omitting `where`. | deny |

## Methodologies

- `prisma/client` — PRISMA-RAW-001, PRISMA-SQL-001, PRISMA-RAW-002, PRISMA-SELECT-001, PRISMA-TAKE-001, PRISMA-CONNECT-001, PRISMA-LOG-001
- `prisma/writes` — PRISMA-DELETE-001, PRISMA-UPSERT-001, PRISMA-TXCLIENT-001, PRISMA-EMPTY-WHERE-001

Non-decidable practices from the same sources are in `BACKLOG.md`.

<!-- BEGIN generated reference -->

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

## Exact rule contract

Category: **library**. Version: `1.2.0`. 11 distinct check IDs.

Methodologies: `prisma/client` (complete), `prisma/writes` (complete).

[Every rule's severity, defaults, provenance, repair guidance and limits](REFERENCE.md). The reviewed preset determines effective policy; these defaults are not a claim of complete framework compliance.
<!-- END generated reference -->
