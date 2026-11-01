# vibe-proof backlog

Checklist rows that are not a syntax invariant. Finding ids match the auditor checklist.

- **Empty catch.** Core `CC-ER-002`. Returning null from a catch is explicitly allowed there. This pack does not add a second swallow rule.
- **Floating promises that are not named Async.** `typescript/TS-FLOAT-001`.
- **Secret scanners, gitignore, and rotation after a leak.** Those are CI and history, not one file's tree. A split string (`"sk_" + "live_"`) is a known hole of VP-SECRET-001.
- **Auth server-side, session cookies, logout, generic login errors (`auth-enumeration`).** The check is the response a live handler returns, not a keyword.
- **Rate limit and bot protection (`missing-rate-limit`).** A limiter that exists on one route and not another is a coverage judgment.
- **IDOR / BOLA (`idor`).** Needs the stranger test: user B requests user A's id. A missing `where owner` is not proof without the schema.
- **RLS and Firebase rules (`rls-open`).** Often SQL or JSON outside this TypeScript grammar, and `USING (true)` needs the policy language.
- **Frontend is not the authorization boundary.** A client check can be legitimate UX on top of a server check. The absence of the server check is not visible from the component.
- **File upload bounds (`unrestricted-file-upload`).** Size, content, and path are a protocol, not one call shape.
- **Security headers, HTTPS, CSRF.** Deployment and framework config. A missing header is the response, not the source of one handler.
- **Webhook signatures.** Which header and which scheme depend on the provider. A missing `constructEvent` call is a hint, not a proof.
- **Prompt injection, spend limits, privacy notice, security scan.** Process and product.
- **Tests, isolation tests, low-signal tests beyond the shapes pstack flags, concurrency, duplicate effects.** Behavior, not a token.
- **Architecture rows** (`state-orphan`, `aggregate-bypass`, `covert-recursion`, `step-skipped`, `split-write-loss`, and the rest of section 4). They need a named business invariant.
- **Retry storms and unsafe retry (`retry-storm`, `unsafe-retry`).** A loop bound is only visible when the retry is a local `while`. A queue redelivery is configuration.
- **Unbounded buffers (`unbounded-buffer`).** An array that grows is normal unless the lifetime is known.
- **Resource leaks beyond setInterval (`resource-leak`, `cleanup-on-failure-missing`).** `finally` pairing needs the acquire and the release to be the same resource.
- **Stale cache, N+1, indexes, harness cost.** Measurements.
- **Slopsquat, lockfiles, advisories.** Package metadata.
- **Human-interview rows.** Not assessed from code. The checklist says they are never a gate.
- **Product, scope, rollback rehearsals, migrations, accessibility, responsive layout.** Not syntax.
- **Awaited generic SQL calls (VP-SQL-001).** tree-sitter-typescript parses ``await pool.query<Row>(`${id}`)`` as a call whose function is the `await_expression`, so the member_expression callee anchor misses it; `void` and `!` prefixes misparse the same way. postgres PG-CONCAT-001 already accepts those shapes; port its `call-prefix` (await or unary) alternative here.
- **Decoy `safeParse`.** VP-INPUT-001 treats any call whose name ends in safeParse as validation. A function that only returns true satisfies the rule without parsing. That hole is why a schema review still has to read the boundary.
