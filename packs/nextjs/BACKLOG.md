# nextjs backlog

Judgment, cross-file facts, or checks the TS syntax tree cannot decide. All five are
**candidate** rules: the closed pattern vocabulary inspects syntax in one file, so it
cannot prove absence, resolve imports across modules, or read file-system conventions.

## Cache Components limits

`NEXT-CACHE-001`, `NEXT-REVAL-001`, and `NEXT-SERVER-EXPORT-001` read the first existing
root `next.config.js`, `next.config.mjs`, or `next.config.ts` while judging a file.
They treat Cache Components as on only when that file's exported config object sets
`cacheComponents` to literal `true`. These are not detected:

- `next.config.mts`, `next.config.cjs`, or `next.config.cts`
- a config in a nested app (`apps/web/next.config.ts`)
- `experimental.cacheComponents`, a comment, or a computed value
- `defineConfig({ cacheComponents: true })` and other wrapper calls
- an empty `generateStaticParams` return (`empty-generate-static-params`)

Existing `fetch` `cache` and `next` options still work under Cache Components, so they
are not reported. A Pre edit that only changes `next.config` does not rescan route files;
the next check of those files, or `pregate check`, sees the new flag.

## Candidate rules

- **route.ts method exports presence.** A route handler only runs when the file exports
  a named HTTP method (`GET`, `POST`, ...). Flagging a missing export means proving a
  negative across the whole file — needs absence detection, not a banned shape.
- **generateStaticParams presence.** Dynamic segments should declare their static
  params, but the obligation depends on the route being dynamic, which is a directory
  fact (`[slug]` in the path), not a syntax fact in the file. Needs file-system plus
  absence detection.
- **Server/client boundary AND-directives.** Correct layering needs `"use client"` in
  exactly the modules that touch browser APIs and nowhere else. That is a conjunction
  of two directions (directive present AND browser API used; directive absent AND no
  browser API) across module boundaries — needs cross-file import facts.
- **Proxy matcher.** A `proxy.ts` (legacy Edge `middleware.ts`) without a `matcher`
  config runs on every route, but proving the config is missing (rather than inherited
  or set elsewhere) needs absence detection plus knowledge of which file is the entry point.
- **Parallel routes.** Slot props (`@slot/page.tsx`) must be accepted by the parent
  layout, which means correlating directory siblings with layout signatures — a
  cross-file convention the single-file vocabulary cannot see.
