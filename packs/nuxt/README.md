# nuxt

Data-only rule pack for Nuxt 3 TypeScript projects. Source version **1.0.0**. Every check is a syntax pattern over the `typescript` grammar (`.ts` fixtures only); no executable code, no `.vue` grammar.

## Stance

Nuxt owns the server/client boundary, the SSR payload, and hydration. Code that reaches across the boundary — importing `server/` into app code, bare `fetch`, `process.env`, unkeyed `useState`, unvalidated bodies, nondeterministic setup values, absolute fetch URLs, exported request scope — compiles, then leaks, double-fires, or mismatches at runtime. So do an unreturned `navigateTo` in middleware and a `useAsyncData` handler that returns nothing. These rules flag those shapes. Everything the syntax tree cannot decide — auto-import presence, middleware order, plugin naming, `ClientOnly` fallbacks, Nitro presets, `useFetch` key dedupe — lives in [BACKLOG.md](BACKLOG.md).

## User control

The contract is the repository preset, not this pack. Take every pack, some packs, or some rules:

- Omit a pack by leaving it out of `sources`.
- Omit a methodology by leaving it out of `methodologies`.
- Turn one rule down or off with `overrides` (`off`, `warn`, `ask`, or `deny`). The key is `nuxt/NUXT-SERVER-001`.
- When two methodologies disagree on one dimension, pick a side in `resolve`.
- `enforcement: "shadow"` sets the preset default. An override's `enforcement` selects `shadow` or `enforce` for one alias or check. Integrity always enforces. See [preset examples](../presets/README.md).

## Rules

| ID | Flags | Why | Default severity |
| --- | --- | --- | --- |
| `NUXT-SERVER-001` | Importing `~/server/...` (also `@/`, relative) from app code, static and runtime loaders. | Bundles server-only code into the client. | deny |
| `NUXT-FETCH-001` | Bare `fetch(...)` (also `globalThis.fetch`) in pages/components/composables/app. | Double-fires across SSR and skips payload dedupe. | deny |
| `NUXT-ENV-001` | `process.env` reads (dot and bracket) in app code. | Leaks secrets or yields undefined in the client bundle. | deny |
| `NUXT-STATE-001` | `useState()` with no key, including generic-only forms. | Merges every instance into one shared slot. | deny |
| `NUXT-VALID-001` | `readBody(event)` in `server/` without schema validation. | Unshaped payloads reach writes and business logic. | deny |
| `NUXT-HYDR-001` | `Math.random()` / `Date.now()` in app setup code. | Server and client render different values; hydration mismatches. | deny |
| `NUXT-URL-001` | Absolute `http(s)` URLs in app `fetch`/`useFetch`/`useAsyncData`/`$fetch`. | Pins an origin and bypasses the Nitro proxy. | deny |
| `NUXT-CTX-001` | Exporting `event`/`context` bindings from `server/` files. | Leaks request scope across requests. | deny |
| `NUXT-NAV-001` | A `navigateTo(...)` or `abortNavigation(...)` statement that is neither awaited nor returned. | Middleware only redirects or cancels when the result is returned; a floating call lets the guarded page render. | deny |
| `NUXT-ASYNC-001` | A block-bodied `useAsyncData`/`useLazyAsyncData` handler with no valued `return`. | The handler must return a truthy value, or the client refetches during hydration. | deny |
| `NUXT-META-001` | `process.browser/client/dev/server/test` in app code. | Soft-deprecated since Nuxt 3.12; use the `import.meta` flags. | warn |

## Methodologies

- `nuxt/server` — NUXT-SERVER-001, NUXT-VALID-001, NUXT-URL-001, NUXT-CTX-001
- `nuxt/data` — NUXT-FETCH-001, NUXT-ENV-001, NUXT-STATE-001, NUXT-HYDR-001, NUXT-NAV-001, NUXT-ASYNC-001, NUXT-META-001

## Fixture coverage and limits

`pregate rules test packs/nuxt` runs **59** real fixtures (at least 2 pass + 2 fail + 1 trap per check). Every trap fails as required: dynamic server imports, member-call fetch, bracket env access, generic-only `useState`, size-limit-without-schema bodies, deferred `Date.now`, loopback absolute URLs, `context`-aliased scope exports, an unreturned `abortNavigation` on an `if` arm, an `useAsyncData` handler whose only `return` is in a nested callback, and the Nuxt 2 `process.browser` flag.

The hydration rule cannot tell `onMounted` from setup scope, so it flags all app-code `Math.random`/`Date.now` and documents the narrow reading in BACKLOG.md. The unkeyed-`useState` rule matches syntactically empty argument lists only. Cross-file facts (who imports what, where a value flows) stay out of scope.

<!-- BEGIN generated reference -->

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

## Exact rule contract

Category: **library**. Version: `1.2.0`. 12 distinct check IDs.

Methodologies: `nuxt/data` (complete), `nuxt/server` (complete).

[Every rule's severity, defaults, provenance, repair guidance and limits](REFERENCE.md). The reviewed preset determines effective policy; these defaults are not a claim of complete framework compliance.
<!-- END generated reference -->
