# Verify factory input before using dependencies

This example binds `DCP-FACTORY-RUNTIME-003` to one real application creator.
It rejects invalid or inherited amounts before it resolves the injected billing
port, retains an admitted value independently of later caller mutation, and
uses that value for charging. The pinned-source probe separately verifies
dcouplr's actual input and resolution behavior. This example does not certify
all application factories, configured adapters, monetary units or tenant scope.

Copy the two `.cjs.fixture` files into a temporary project, remove `.fixture`
and run `bun quality/verify.cjs`. Deleting input validation must fail. Changing
the charge callback to use the caller's mutable amount must also fail. Replace
this example with the actual domain input, bounds and injected application paths.

Propose the optional library method in a reviewed pack plan:

```json
{
  "sources": [{ "kind": "library", "ns": "dcouplr" }],
  "methodologies": ["dcouplr/factory-runtime"]
}
```

Other methods and packs can share the same plan. Preview with
`pregate pack apply plan.json --preview`, then use the human approval route.
All eight requirements initially remain UNVERIFIED.

Fingerprint `quality/verify.cjs` with `pregate fitness fingerprint`. Propose a
reviewed [fitness binding](../../features/project-fitness.md) for
`DCP-FACTORY-RUNTIME-003` with the trusted runtime and verifier command, its
current definition hash, explicit input paths and a rationale that names the
domain constraints, failing controls and remaining gaps. Review an
`enforcement: "enforce"` override; a shadow rule stays diagnostic.

Run `pregate fitness run DCP-FACTORY-RUNTIME-003`. Only the bound assertion passes;
seven other factory requirements and all 64 core obligations remain UNVERIFIED.
A changed creator makes the receipt stale. A broken validation or mutation
invariant fails the assertion and blocks the enforcing check. Restore and rerun.
A changed verifier requires review of its new fingerprint before execution.

The compiled adoption test uses test-mode approval. It does not observe a live
human approval or establish behavior of the real configured billing adapter.
