# Bind a bounded inspection export assertion

This example adopts `DCP-OBSERVABILITY-006` for one application export function.
The function admits at most 100 events and exports only validated numeric sequence
and timestamp values. It excludes raw, activity and detail fields, including cyclic
or confidential payloads, and produces fresh values. It does not redact the
inspector's internal storage or certify other export routes.

Copy both `.cjs.fixture` files into a project's `src/` and `quality/` directories,
removing `.fixture`. Activate `dcouplr/observability` in a reviewed pack plan.
Run `pregate fitness fingerprint quality/verify.cjs` and bind the resulting hash
to `DCP-OBSERVABILITY-006` with command `node quality/verify.cjs`, the verifier
as an input and a 1,000 ms timeout. Then run that verifier and `pregate audit`.

The compiled adoption test covers reviewed activation, missing proof, execution,
removed redaction, failed execution and stale evidence. The other seven
observability requirements and the 64 core evidence requirements remain unverified.
Bind separate application assertions for capture, network access, rendering and
server lifecycle when those requirements apply.
