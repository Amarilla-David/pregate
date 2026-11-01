# nuxt backlog

Judgment, template grammar, or checks the TS syntax tree cannot decide. The engine parses `typescript`/`tsx` only, so `.vue` single-file-component structure is invisible; template-only rules wait here.

## Template-grammar candidates

- **Auto-import presence.** Whether a `useFetch`/`ref`/`computed` identifier resolves to a Nuxt auto-import or an undeclared global needs module resolution, not syntax.
- **Middleware order.** Global versus named middleware execution order lives in filenames and `defineNuxtRouteMiddleware` registration across files.
- **Plugin naming and order.** `*.server.ts` / `*.client.ts` suffixes and numeric prefixes decide load order; the pattern sees one file at a time.
- **ClientOnly fallback.** A `<ClientOnly>` without a `#fallback` slot is a template shape; there is no `.vue` grammar.
- **Nitro preset config.** `nitro.preset` correctness depends on the deploy target named in the preset, not on syntax.
- **useFetch key dedupe judgment.** Two `useFetch` calls to the same URL without an explicit `key` double-fire. Same-URL comparison across calls needs value tracking; flagged as judgment, not denied.

## Value and provenance limits

The closed pattern vocabulary inspects syntax in one file. It cannot evaluate arbitrary expressions, resolve imported values, or prove interprocedural data flow.

| Rule | Uncaught flow | Missing capability |
| --- | --- | --- |
| NUXT-SERVER-001 | `import db from "~/drizzle"` where a barrel re-exports `server/db`. | Cross-file re-export resolution; only literal `/server/` path segments match. Bare `server/x` without a `./` prefix is also out of the regex. |
| NUXT-FETCH-001 | `const f = fetch; f("/api/orders")`, or a wrapper `apiGet()` that calls `fetch` internally. | Alias binding and wrapper call graphs. |
| NUXT-ENV-001 | `const env = process.env; env.API_KEY` in app code (member read separated from property access). | Partial-read then property flow; only `process.env` member text matches. |
| NUXT-STATE-001 | `useState(key)` where `key` is an empty string or a colliding constant. | Value evaluation; only syntactically empty `()` is denied. |
| NUXT-VALID-001 | `const b = await readBody(event); Order.parse(b)` validated one statement later. | Post-hoc validation flow; the call itself still flags. |
| NUXT-HYDR-001 | `Math.random()` inside `onMounted` (safe) still flags. | Scope awareness; the pattern cannot tell mount hooks from setup scope, so it over-flags by design. |
| NUXT-URL-001 | `` useFetch(`${base}/orders`) `` with an absolute `base`. | Computed URL evaluation; only literal `http(s)://` arguments match. |
| NUXT-CTX-001 | Stashing the event on a module global (`current = event`) without exporting it. | Cross-request escape needs data-flow facts, not export shapes. |

## Narrow readings (documented over-flagging)

- **NUXT-HYDR-001** flags `Math.random()`/`Date.now()` anywhere in app-scoped files, including inside `onMounted` where the value is client-only and safe. Prefer a tighter scope once hook awareness exists; until then, move even mount-local nondeterminism to clearly marked helpers or accept the flag.
- **NUXT-STATE-001** matches only syntactically empty argument lists (`()` with optional whitespace). A comment inside the parens (`useState(/* key */)`) does not match and stays unflagged.
