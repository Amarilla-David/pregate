# Rule precision and proof limits

These rule precision refinements are part of the built-in catalog and bundled
packs in `v0.0.1`. See the [release notes](../releases/0.0.1.md).

## Cases distinguished by the current rules

| Policy | Valid case | Finding retained |
| --- | --- | --- |
| Node builtin prefix (`NODE-PREFIX-001`) | Application data such as `{ protocol: "http" }`, type literals and callback arguments | A bare builtin in an actual import/export source or the first static argument of `require`, `module.require` or `import`; use `node:http`, for example |
| Interval cleanup (`VP-INTERVAL-001`) | A stored interval handle with a matching `clearInterval` read, including a shared typed container field in sibling functions | A missing cleanup, a different handle or an unrelated container binding/type |
| SQL interpolation (`VP-SQL-001`) | An outer transaction callback, bound values, or an interpolated scope argument beside a transaction handle | Direct interpolation in the first SQL argument of `.query`, `.execute`, `.raw` or `.unsafe`, including transparent parentheses and TypeScript type wrappers |
| React index key (`REACT-KEY-001`) | `Array.from({ length: 3 }, (_, index) => <span key={index} />)` with a fixed numeric literal length and only positional placeholder rendering | Index keys for data rendering, dynamic lengths, custom components or transformed lists; a fixed length alone does not establish stable item identity |
| Credential literal (`VP-SECRET-001`) | A complete static credentialed URL in a `.test`/`.spec` file whose password is exactly `secret`, `password` or `changeme` | Production credentialed URLs, real-looking test passwords, prefixed tokens, private-key text, credentials in comments, interpolation, or a real secret beside a placeholder URL |

The SQL check inspects the actual callee and first argument. It still reports a
genuine unsafe SQL call nested inside a transaction callback. It does not prove
the safety of SQL assembled through variables, concatenation or tagged templates;
review those paths separately. The credential exception is a narrow fixture
distinction, not permission to store secrets in tests.

Matching interval cleanup is syntactic evidence that the same stored handle is
read by `clearInterval`. It does not prove that teardown runs on every lifecycle
path. React's placeholder exception likewise does not prove arbitrary list
stability. Keep runtime behavior tests for these requirements.
Sibling parameters sharing a local named container type do not prove that they
refer to the same runtime instance. Imported container types and complex
alias/call flows still need separate evidence.

## Drizzle result bounds

`DRIZ-LIMIT-001` accepts a modeled result bound from the evaluated query's
`limit`/terminal `get`, or proved schema and input cardinality. Static imported
schema, reexports and TypeScript aliases can supply actual declared primary or
unique keys, including composite keys. Names such as `id` and `slug` do not
establish uniqueness. A joined table must be reached through a proved unique
key; an amplifying join or union still needs a separate bound.

A fixed `inArray` list supplies a finite input budget. An array-typed parameter
can use a literal `slice(0, n)` or a preceding rejecting length guard in the same
function. Intervening mutation or opaque calls invalidate that evidence; normal
query construction and imported predicate helpers do not. Another query's
`limit`, `get`, `select` or `from` cannot supply this query's proof.

Partial or functional unique indexes, unknown validators, mutable initializer
flows, split query construction, schema wrappers and aggregates remain unproved.
This policy models result cardinality, not database execution cost or the schema
actually deployed by migrations. Supply project assertions for those guarantees.
See the [Drizzle pack](../../packs/drizzle/README.md) and
[invariant enforcement](invariant-enforcement.md).

## Verification scope

Paired public examples exercise valid cases alongside findings that must remain.
Read-only analysis of the reported consumer files supports the reported false
positive repairs; it does not migrate their active contracts. Earlier compiled
CLI controls identify their own source/artifact snapshot and do not certify a
later integrated build. Final generated references, full source verification,
packaged controls and latency measurements follow source freeze.

For policy changes, preserve existing aliases, severities and shadow overrides
and use the [reviewed contract workflow](daily-use.md#review-a-contract-change-inside-the-harness).
See the [documentation index](../README.md) and [pack reference](../packs.md).
