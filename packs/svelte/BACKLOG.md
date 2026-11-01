# svelte backlog

Judgment, or checks the syntax tree cannot decide without guessing intent.

- **$effect read/write loop.** Whether an effect writes the same `$state` variable it reads (an infinite loop) needs dataflow: an assignment inside the callback is not proof the assigned name is the state the callback read. SV-EFFECT-001 covers only the decidable half (async callbacks). Candidate when dataflow lands.
- **`{@html}` injection.** Whether `{@html value}` renders unsanitized input needs taint tracking: a constant template is safe, a fetched string is not, and the tree cannot tell them apart. Judgment.
- **Event forwarding.** Whether a component should forward an unhandled DOM event (`onclick` without a handler) depends on the component contract, not the syntax. Judgment.
- **Snippet arguments.** Whether a `{@render children(...)}` call passes the arguments the snippet declares needs cross-component arity checking the single-file tree cannot do. Candidate.
- **$props reassignment.** Whether `prop = ...` reassigns a `$props` binding needs dataflow from the `$props()` destructure to the assignment. The destructure shape alone is not proof. Candidate when dataflow lands.
- **$store auto-subscription in modules.** `$store` syntax is only valid in `.svelte` components, but `$`-prefixed identifiers are also the runes (`$state`, `$derived`, `$effect`, `$props`, `$inspect`), which the Rust regex subset cannot exclude without lookahead. Judgment until the grammar or the DSL can tell them apart.
- **SFC grammar.** Markup, styles, and template expressions in `.svelte` files need a dedicated grammar; this pack stays data-only on `.ts` runes modules.
- **Async helper inside $effect.** An `async` function declared inside a synchronous `$effect` callback still matches the arguments text. SV-EFFECT-001 flags it; hoist the helper out of the call. Known hole documented on the invariant.
- **Derived promises without keywords.** `$derived(loadUser(id))` returns a promise with no `async`/`await` marker and stays out of reach of SV-DERIVED-001. Known hole documented on the invariant.
