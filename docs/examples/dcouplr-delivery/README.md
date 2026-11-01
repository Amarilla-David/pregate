# Verify an application's delivery completion

This executable example verifies one application path for `DCP-DELIVERY-001`:
an order response waits for its local event operation and rejects when that
operation fails. It injects a deferred boundary to test the caller. The pinned
source probe independently tests dcouplr's real blocking/nonblocking/broker
semantics. Neither demonstration certifies all paths in a consuming project.

Copy the two `.cjs.fixture` files into a temporary project, removing `.fixture`.
Run `bun quality/verify.cjs`. Removing `await` from the application function must
make the same assertion fail. Replace this example with your actual critical
paths, configured adapters and application response/error policies.

After initialization, propose the dcouplr source and delivery methodology in
one reviewed plan:

```json
{
  "sources": [{"kind": "library", "ns": "dcouplr"}],
  "methodologies": ["dcouplr/delivery"]
}
```

Use `pregate pack apply plan.json --preview` and the human approval route. The
ten delivery requirements and all core obligations are visible; selecting the
methodology does not create project evidence. Inspect `pregate audit --json`.

Fingerprint `quality/verify.cjs` with `pregate fitness fingerprint`. Propose a
human-reviewed binding for `DCP-DELIVERY-001` with that hash, the trusted runtime
and `quality/verify.cjs` as its command, and the verifier as its definition input.
Its rationale must name the actual application paths, expected lifetime,
failure controls, owner and missing coverage. Configure the rule's override as
`enforcement: "enforce"`; an optional shadow rule does not block a failed
assertion. See the [binding schema](../../features/project-fitness.md).

Run `pregate fitness run DCP-DELIVERY-001`. Only this bounded assertion can pass;
other unbound requirements remain UNVERIFIED. Changing the application source
invalidates evidence. Removing `await`, then rerunning, must fail and block the
enforced check. Restore the actual behavior and rerun. A verifier edit requires
new human review of its fingerprint before it can execute.

The compiled `test/pack-adoption.test.ts` exercises selection, reviewed binding,
passing application behavior, stale evidence, the missing-await failure and
repair. Test-mode consent in that fixture is not a live human-harness approval.
