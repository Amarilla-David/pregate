# vue backlog

Candidate rules that are not decidable from TypeScript syntax alone. No `.vue` grammar exists in the engine, so everything below stays out of `checks/` until a template grammar lands.

- **`v-for` `:key`.** Template-only. Whether a list renders a stable key is visible only in the `<template>` block, which this grammar never sees.
- **`v-html` / raw HTML injection.** Template-only. The directive and its binding live in markup, not in the script tree.
- **`<script setup>` sugar presence.** Requires parsing single-file-component blocks to tell `setup()` from `<script setup>`. Composable-style `.ts` fixtures cannot express the difference.
- **Emits declaration presence.** Proving a component declares what it emits needs the SFC boundary plus runtime component options, not one call shape.
- **Provide/inject keys.** Matching a provided key to an injected key across files is a cross-module judgment, and string keys versus symbols change the shape.
- **SFC parsing in general.** Any rule that reads `<template>` or `<style>`, or correlates template usage with script definitions, waits on a real SFC grammar.
- **`const self = this` aliasing.** Bare-`this` capture is covered by VUE-THIS-001's `this_expression` shape, but tracking the alias through later uses is dataflow, not syntax.
- **Decoy `storeToRefs`.** A wrapper named `storeToRefs` that returns plain values satisfies the letter of VUE-PINIA-001 without keeping reactivity. Same hole family as decoy validators elsewhere.
- **Destructured value types and action bindings.** VUE-DEST-001 and VUE-PINIA-001 are off. Nested reactive proxies retain reactivity and bound Pinia actions may be extracted directly; a destructuring shape cannot distinguish them from primitive state. VUE-TICK-001 warns only on discarded zero-argument calls: callback calls are supported, and later DOM-use intent is not established.
