# Own saga shutdown completion

This example binds `DCP-SAGA-RUNTIME-008` to one application's shutdown caller.
The pinned deprecated `DStructuredSaga.stop()` returns void and does not wait for
in-flight handlers. The caller stops admission, awaits the complete set of owned
work and propagates a failed handler after the others settle. The example's
injected boundary tests the caller; the source probe separately observes the
actual saga. It does not certify queue persistence, every producer, recovery,
timeouts or compensation. The application must track its actual in-flight work
and give it a budget. An empty fabricated list is not evidence of safe shutdown.

Copy the `.cjs.fixture` files into a temporary project and remove `.fixture`.
Run `bun quality/verify.cjs`. Removing `await` must fail. Replacing
`Promise.allSettled` with `Promise.all` must also fail the held-work/early-failure
control. Use actual lifecycle ownership and handler paths before adoption.

Include the source and method in one reviewed `pack apply` proposal:

```json
{
  "sources": [{ "kind": "library", "ns": "dcouplr" }],
  "methodologies": ["dcouplr/saga-runtime"]
}
```

All eight saga requirements initially remain UNVERIFIED. Fingerprint
`quality/verify.cjs` with `pregate fitness fingerprint`, then propose a reviewed
binding for `DCP-SAGA-RUNTIME-008` with the verifier command, definition inputs,
hash, timeout, actual owner/applicability and coverage limits. Explicitly review
an enforcing override; optional shadow policy remains diagnostic. See
[the project binding contract](../../features/project-fitness.md).

Run `pregate fitness run DCP-SAGA-RUNTIME-008`. Only this bounded assertion passes;
the other seven saga and all 64 core obligations stay UNVERIFIED. A caller edit
invalidates evidence. A missing await or early-failure shutdown fails verification
and blocks the enforcing check. Restore the behavior and rerun. A verifier edit
requires new human review of its fingerprint.

The compiled adoption test uses test-mode approval. It does not establish a live
human approval observation or recommend adoption of the deprecated saga API.
