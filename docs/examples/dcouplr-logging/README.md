# Verify owned logging completion

This executable example verifies one shutdown caller for `DCP-LOGGING-005`.
The caller waits for a buffered adapter's flush, propagates flush failure and
permits a synchronous unbuffered logger with no flush. The source probe tests
the pinned dcouplr gate separately. The example does not establish remote
retention or compliance of every application path.

Copy `src/shutdown.cjs.fixture` and `quality/verify.cjs.fixture` into a temporary
project and remove `.fixture`. Run `bun quality/verify.cjs`. Removing the caller's
`await` must make the same assertion fail. Use the real shutdown, configured
adapter and failure policy when you adopt the requirement in your product.

After initialization, select this optional method in a reviewed plan:

```json
{
  "sources": [{ "kind": "library", "ns": "dcouplr" }],
  "methodologies": ["dcouplr/logging"]
}
```

Use `pregate pack apply plan.json --preview` and the human approval route.
You can combine this method and other proposed packs in the same plan. All six
logging requirements start UNVERIFIED. Selection does not supply verifiers.

Fingerprint `quality/verify.cjs` with `pregate fitness fingerprint`. Propose a
reviewed binding for `DCP-LOGGING-005` with the verifier's hash, trusted runtime
and verifier path as its command and the verifier as its definition input.
State the actual caller, adapter, owner, failure and timing assertions and
coverage limits in its rationale. Review an `enforcement: "enforce"` override
for this requirement; optional shadow rules remain diagnostic.

Run `pregate fitness run DCP-LOGGING-005`. The bounded caller assertion passes;
the other five logging requirements and all 64 core obligations remain
UNVERIFIED. A caller edit invalidates the receipt. Removing `await`, then
rerunning, must fail and deny the enforcing check. Restoring the caller and
rerunning passes. A verifier edit requires review of its new fingerprint.

The compiled adoption test executes this flow in isolation with test-mode
approval. That is not a live human-harness approval observation.
