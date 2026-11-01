# Verify named priority and admission before reporting success

This executable example binds `DCP-UTILITY-RUNTIME-008` to one application
producer. It rejects invalid or numeric priorities before adapter use, passes
the priority name and item in the required order, waits for admission, rejects
a false result and propagates failure. It injects a held boundary; it does not
claim that dcouplr provides a priority-queue implementation. The pinned source
publishes `IPriorityQueue` as a type and `QueuePriorities` as numeric ranks.
Its built-in `IQueue` remains FIFO and has a different enqueue signature.

Copy the two `.cjs.fixture` files into a temporary project, remove `.fixture`
and run `bun quality/verify.cjs`. Removing the await or false-result check must
fail. Replace the caller with actual producers and their admitted priority,
failure and backpressure policy. Verify the real selected adapter's ordering,
capacity, starvation decision, reads and destructive operations separately.

Propose the method in a reviewed plan, alongside any other applicable packs:

```json
{
  "sources": [{ "kind": "library", "ns": "dcouplr" }],
  "methodologies": ["dcouplr/utility-runtime"]
}
```

Preview with `pregate pack apply plan.json --preview` and use the human approval
route. All eight obligations initially remain UNVERIFIED. Fingerprint
`quality/verify.cjs` with `pregate fitness fingerprint`, then propose a reviewed
[fitness binding](../../features/project-fitness.md) for `DCP-UTILITY-RUNTIME-008`
with its actual command, definition hash, input paths, owner, constraints and
limits. Review an `enforcement: "enforce"` override; shadow remains diagnostic.

Run `pregate fitness run DCP-UTILITY-RUNTIME-008`. Only this bounded producer
assertion passes. Seven other utility requirements and all 64 core obligations
remain UNVERIFIED. A changed caller invalidates its receipt; broken admission
fails and blocks the enforcing rule. A changed verifier requires renewed review
of its fingerprint. The compiled adoption control uses test-mode approval;
it does not observe a live human or certify an actual scheduler.
