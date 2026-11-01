# Verify queue admission before reporting acceptance

This executable example verifies one producer for `DCP-QUEUE-RUNTIME-001`.
It waits for queue admission, rejects a false result and propagates storage
failure. It injects a deferred boundary; the source probe separately tests the
actual pinned queue. It does not certify durability, recovery, every producer
or a configured storage adapter.

Copy the two `.cjs.fixture` files into a temporary project and remove `.fixture`.
Run `bun quality/verify.cjs`. Removing `await` from the caller must fail the same
assertion. Removing the false-result check must also fail. Replace the example
with actual producer paths and the product's reject, retry or backpressure policy.

After initialization, propose the source and methodology in a reviewed plan:

```json
{
  "sources": [{ "kind": "library", "ns": "dcouplr" }],
  "methodologies": ["dcouplr/queue-runtime"]
}
```

You can include other dcouplr methods and proposed packs in the same plan.
Use `pregate pack apply plan.json --preview` and the human approval route.
All eight queue requirements initially remain UNVERIFIED.

Fingerprint `quality/verify.cjs` using `pregate fitness fingerprint`. Propose a
human-reviewed binding for `DCP-QUEUE-RUNTIME-001`, using the trusted runtime
and verifier as its command, its current hash and the verifier as its definition
input. Explain the actual producer, owner, admission and failure assertions and
coverage gaps in the rationale. Review an `enforcement: "enforce"` override;
optional shadow rules remain diagnostic. See the [binding contract](../../features/project-fitness.md).

Run `pregate fitness run DCP-QUEUE-RUNTIME-001`. Only this bounded producer
assertion passes; the other seven queue and all 64 core requirements remain
UNVERIFIED. A caller change invalidates its evidence. Removing `await`, then
rerunning, fails and blocks the enforcing check. Removing the false-result
policy also fails. Restore behavior and rerun. A verifier edit needs new review
of its fingerprint before execution.

The compiled adoption test executes the flow with test-mode approval. It is
not a live human approval observation or a storage integration test.
