# sveltekit backlog

Judgment, or checks the syntax tree cannot decide without guessing types.

- **Load return-type serializability (SK-LOAD-001).** Whether a returned value survives `devalue` serialization (Date, Map, class instances, functions) needs the value's type, which the tree does not know.
- **Form `enhance` judgment.** Whether a form uses progressive enhancement correctly is a client behavior question, not a single shape.
- **`+page.svelte` grammar.** Component markup, `export let data`, and reactive statements need a Svelte grammar the engine does not parse. Covered here only through the `.ts` load files beside them.
- **`hooks.server.ts` sequencing.** Handle ordering, response cloning, and route guards depend on runtime order across files, not one shape.
- **Param validation without a schema.** Whether `params.id` was validated needs the validator (zod or equivalent) the tree cannot assume.
- **Global `fetch` instead of the load `fetch`.** The docs recommend the `fetch` passed to `load` (credentials, relative URLs, response inlining), but the global call is not an error, and telling it apart needs to track whether `fetch` was destructured from the load event.
- **SK-REDIRECT-001 folded into SK-API-001.** Redirect-status misuse in API routes is covered by SK-API-001 (`redirect()` with 200/404/500); a separate alias added no new shape.
