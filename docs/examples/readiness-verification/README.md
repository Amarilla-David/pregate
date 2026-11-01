# A bounded readiness assertion

This executable example checks read/write isolation for one in-memory document
service. It is a negative-control demonstration, not a production consumer or
proof of enterprise/consumer readiness. Identity admission, database queries,
session changes, bulk export and other paths need the actual product's tests.

Copy `src/documents.cjs.fixture` and `quality/verify.cjs.fixture` into a temporary
project, removing `.fixture` from the filenames. Run `bun quality/verify.cjs`.
The assertion permits the owner, rejects another tenant and user on both reads
and writes, tests absence, and rejects mutation through a returned reference.
Removing the tenant or owner check must make this verifier fail.

After initialization, propose both optional packs in one plan:

```json
{
  "sources": [
    {"kind": "library", "ns": "enterprise-ready"},
    {"kind": "library", "ns": "consumer-saas"}
  ],
  "methodologies": ["enterprise-ready/readiness", "consumer-saas/readiness"]
}
```

Run `pregate pack apply plan.json --preview`, review, and approve the displayed
digest through the human approval route. `pregate audit --json` now inventories
these requirements and the core. None has product evidence merely from selection.

Fingerprint `quality/verify.cjs` with `pregate fitness fingerprint`. Propose reviewed
bindings for `ENTERPRISE-014` and `CONSUMER-022` using the project-fitness workflow.
Each binding's rationale must state this example's restricted paths and missing
coverage; its command is the trusted runtime plus `quality/verify.cjs`, and its
inputs include that verifier. Use the returned hash, not a copied placeholder.
In the same reviewed change, explicitly set those two optional rules to
`enforcement: "enforce"` through their overrides. Initial optional shadow mode
does not block a failed assertion. See [binding commands and schema](../../features/project-fitness.md).

Run `pregate fitness run --all`, then audit. Only those two bounded assertions can
pass; all other unbound requirements remain unverified. Change the source to
remove a tenant check: evidence becomes stale, and rerunning fails. Restore the
check and rerun to obtain new passing evidence. An unreviewed verifier change is
rejected instead of becoming a new passing receipt.

The repository's `test/pack-adoption.test.ts` executes that sequence with the
compiled engine. Declarative pack fixtures separately test receipt admission.
