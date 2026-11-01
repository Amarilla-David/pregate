# supabase backlog

Judgment, SQL policy language, or checks the TS syntax tree cannot decide. Most need
a SQL language pack or the Deno runtime first; the rest need preset knowledge
(bucket names, function names, framework layout).

## Value and provenance limits

The closed pattern vocabulary inspects syntax in one file. It cannot evaluate
arbitrary expressions, resolve imported values, or prove interprocedural data flow.
The following plausible evasions are therefore backlog cases, not pass fixtures
or claimed trap coverage.

| Rule | Uncaught flow | Missing capability |
| --- | --- | --- |
| SB-KEY-001 | `createClient(url, getKey(profile))`, where an imported helper returns the service_role key. | Constant evaluation and imported-value provenance. |
| SB-KEY-001 | `createClient(url, key)` in a client file, where `key` is imported from a module that re-exports the service_role value. | Cross-file value propagation. |
| SB-AUTH-001 | `const admin = supabase.auth.admin; admin.deleteUser(id)` in a component, where the receiver is aliased before the call. | Receiver alias tracking. |
| SB-QUERY-001 | A select builder returned from a helper and awaited elsewhere with no bound, e.g. `run(query())`. | Cross-statement builder flow. |
| SB-STORAGE-001 | `storage.from(bucket).upload(path, file)`, where `bucket` is a const holding `"public"`. | Same-file constant evaluation. |
| SB-RPC-001 | `supabase.rpc(fn, {})`, where an empty object carries no real params. | Semantic emptiness, not syntax. |
| SB-REALTIME-001 | `.channel("o").on(handler)` with a non-filter first argument, e.g. a bare callback instead of an event spec. | Argument-shape typing. |
| SB-EDGE-001 | A wrapper `apiFetch(path)` that concatenates the functions/v1 URL inside another module. | Cross-file URL construction. |

The client-file globs (`app/**`, `components/**`, `pages/**`, plus `src/` variants)
cover the common Next.js layouts. Other frameworks and routers outside those globs
are out of scope until the preset declares its client directories.

## Policy and runtime rules

- **RLS policy language.** Permissive versus restrictive policies, `rls-open` tables with no policy, `auth.uid()` versus `auth.jwt()` checks, `SECURITY DEFINER` functions: all SQL, invisible to this engine. The vibe BACKLOG explicitly punts rls-open; this pack does not duplicate that punt, it complements it.
- **Storage bucket policies.** Private-bucket insert/select/delete policies, `storage.foldername()` ownership checks, signed-URL expiry: SQL policy language, not TS shapes.
- **Edge function bodies.** Deno runtime imports, `Deno.serve` handlers, per-function JWT verification, CORS allowlists: needs the Deno runtime, not the TS client grammar.
- **Realtime authorization mapping.** Which tables may be exposed over realtime and how their RLS maps to channel filters: needs the preset's table registry; an `.on()` filter's presence does not prove its scope is correct.
- **Auth helpers per framework.** `@supabase/ssr` cookie handling, middleware session refresh, `getUser` versus `getSession` trust: framework wiring judgment, not import shapes. The one import shape here, a deprecated `@supabase/auth-helpers-*` package, is SB-HELPERS-001.
- **Key rotation and storage.** Where the service_role key lives server-side (vault, env, secret manager) and rotation process: operational process, not syntax.
- **Indirect server client modules (`SB-GETUSER-001` limit).** `SB-GETUSER-001` flags `.auth.getSession()` in files containing exported route handler or middleware functions (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `middleware`, `proxy`), `"use server"`, or `createServerClient`. Server utility modules that receive a Supabase client as a plain parameter without those markers require cross-file caller context.
