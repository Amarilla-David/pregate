# postgres backlog

Judgment, server-side SQL, or checks the TS syntax tree cannot decide. Most need a
SQL grammar first; the rest need preset knowledge (environment, topology, workload).

## Value and flow limits

The closed pattern vocabulary inspects syntax in one file. It cannot evaluate
arbitrary expressions, resolve imported values, or prove interprocedural data
flow. The following plausible evasions are backlog cases, not pass fixtures or
claimed trap coverage.

| Rule | Uncaught flow | Missing capability |
| --- | --- | --- |
| PG-POOL-001 | `new (require("pg").Client)(cfg)`, or a `Client` constructed in a factory in another file. | Computed constructor expressions and cross-file construction sites. |
| PG-ERROR-001 | `pool.on("error", swallow)`, where `swallow` is an imported no-op function. | Function-body resolution through imports; only literally empty callbacks are seen. |
| PG-TX-001 | `db.query("BEGIN")` on a receiver not named `pool`, or `pool.query("  BEGIN")` with leading whitespace. | Receiver-identity tracking; the rule pins the literal `pool.query("BEGIN` shape. |
| PG-SLEEP-001 | `pool.query("SELECT " + fn + "(5)")` built from parts, or `pg_sleep` reached through a helper. | String-value evaluation across concatenation and call graphs. |
| PG-ROWS-001 | `const email = res.rows[0]["email"]`, or a `row` bound then read after an unrelated guard. | Bracket-access shapes and guard-to-use flow; only direct `.field` chains are seen. |
| PG-CONCAT-001 | `const text = "SELECT ... " + id; pool.query(text)`, or `pool.query(buildSql(a + b))`: the SQL is assembled before the call or inside a helper. Only the first argument itself is read, looking through parentheses, `as`, `satisfies`, `!`, both ternary branches, `??`/`||`/`&&` operands, assignments, and a `{ text }` config object. | Same-file value flow and helper return values. |
| PG-CONCAT-001 | ``client.query(sql`... ${id}`)`` passes as a parameterizing tag (slonik, postgres.js), but so does any tag that only joins strings. | Library knowledge to tell a parameterizing tag from string assembly. |
| PG-SSL-001 | `ssl: verifyTls()` where the helper returns false, or `sslmode` assembled from parts. | Return-value evaluation and string assembly. |
| PG-TIMEOUT-001 | `new Pool(opts)` where `opts` carries the timeout from another module. | Object provenance across imports; only inline option text is seen. |
| PG-RELEASE-001 | `client.release()` reached only in `catch`, or a client handed to `withClient(client)` that may never release it. | Path-sensitive control flow and callee behavior; any `client.release` reference or `return client` in the file passes. |
| PG-IDENT-001 | `const text = "SELECT * FROM $1"; pool.query(text, [table])`, or `FROM $1` followed by a keyword outside the listed clause starters (for example `FOR UPDATE`). | Same-file constant evaluation; only literal text inside the `.query(` arguments is read. |

## Server-side candidates (need a SQL grammar)

- **RLS policies.** `CREATE POLICY` presence, `USING`/`WITH CHECK` expressions referencing `auth.uid()`, tables without `ENABLE ROW LEVEL SECURITY`: all SQL, invisible to this engine.
- **Index selection.** Missing indexes on foreign keys and filtered columns, unused indexes: needs workload and query-plan facts, not TS shapes.
- **Migration discipline.** Reversible migrations, no `DROP COLUMN` without backfill, single-statement DDL transactions: migration files are SQL/config, and ordering needs the migrator CLI.
- **Isolation levels.** `SET TRANSACTION ISOLATION LEVEL`, serializable retry loops, advisory-lock pairing: statement semantics across awaits, not one call shape.
- **LISTEN/NOTIFY topology.** Channel allowlists, `UNLISTEN` pairing on shutdown, payload-size caps: cross-statement lifecycle and deployment knowledge.
- **Extensions.** `CREATE EXTENSION` allowlist (`pgcrypto`, `pg_trgm`), untrusted procedural languages: SQL DDL review.
- **Connection-string secrets.** Hardcoded `postgres://user:pass@` URLs are already covered globally by `vibe-proof` hardcoded-secret, so this pack does not duplicate that rule.
- **Transaction helpers (`PG-TX-ROLLBACK-001` limit).** `PG-TX-ROLLBACK-001` checks `try` blocks that directly issue `client.query('BEGIN')`. If `ROLLBACK` is delegated to a helper function `await safeRollback(client)` inside `catch`, the literal `query('ROLLBACK')` check does not follow the helper body.
