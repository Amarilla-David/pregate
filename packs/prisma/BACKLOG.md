# prisma backlog

Judgment, or checks the syntax tree cannot decide without a Prisma schema grammar, flow analysis, or runtime semantics.

- **Schema indexes (`@@index`, `@@unique`).** `.prisma` files have no grammar in this engine, so missing indexes on foreign keys and queried fields cannot be flagged. Needs a schema parser.
- **`relationMode` and referential actions.** Whether a relation should cascade, restrict, or set null is a domain decision per model. The tree sees client calls, not the schema.
- **N+1 queries.** A findMany followed by per-row finds in a loop needs flow analysis across statements. The shape is visible; the loop-carried dependence is not decidable here.
- **Unbounded findMany complement.** VP-FIND-MANY-001 already flags findMany without take/limit/cursor; this pack deliberately does not duplicate it.
- **Migration discipline.** `prisma migrate dev` against production, discarded migrations, and drift are CLI-side behavior with no TypeScript shape.
- **Row-level security.** Whether a query should be scoped to the caller's tenant needs a policy language, not a syntax pattern.
- **`$transaction` isolation.** Interactive transactions, timeouts, and isolation levels need runtime semantics the tree cannot see. A future PRISMA-TX-001 belongs here until the shapes are pinned. One shape is pinned: a query on the outer client inside the interactive callback is PRISMA-TXCLIENT-001.
- **`upsert` versus `create`.** Choosing between them needs the uniqueness story of the row, which lives in the schema.
- **Soft-delete versus hard delete.** Whether a model should be archived instead of removed is domain policy per model.
- **Dynamic filter variables in bulk writes (`PRISMA-EMPTY-WHERE-001` limit).** `PRISMA-EMPTY-WHERE-001` structurally denies inline `where: {}` object pairs in `deleteMany` and `updateMany` call arguments. When a caller constructs `const filter = {}` dynamically and passes `{ where: filter }` or `updateMany(filterVar)`, detecting the empty predicate requires dataflow analysis.
- **Prisma ORM 7 schema and CLI breaks.** Confirmed in the [7.0.0 changelog](https://www.prisma.io/changelog/2025-11-19) and the [v7 upgrade guide](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7), and not encoded because `.prisma` files and `prisma.config.ts` have no grammar here: `prisma-client` is the default generator and `prisma-client-js` is deprecated; `output` is required; `url`, `directUrl`, and `shadowDatabaseUrl` move to `prisma.config.ts`; the CLI no longer loads `.env` by itself; the postinstall generate hook is gone; `migrate` no longer runs `prisma db seed` implicitly. MongoDB is unsupported on Prisma ORM 7, so those projects stay on Prisma 6, which the version gate already leaves quiet.
