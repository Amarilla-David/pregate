# nextjs backlog

Judgment, cross-file facts, or checks the TS syntax tree cannot decide. All five are
**candidate** rules: the closed pattern vocabulary inspects syntax in one file, so it
cannot prove absence, resolve imports across modules, or read file-system conventions.

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
- **Middleware matcher.** A `middleware.ts` without a `matcher` config runs on every
  route, but proving the config is missing (rather than inherited or set elsewhere)
  needs absence detection plus knowledge of which file is the middleware entry point.
- **Parallel routes.** Slot props (`@slot/page.tsx`) must be accepted by the parent
  layout, which means correlating directory siblings with layout signatures — a
  cross-file convention the single-file vocabulary cannot see.
