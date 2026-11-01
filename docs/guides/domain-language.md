# Make domain language executable

A project-specific language can be a small set of typed commands and outcomes.
Start with the words customers use and the observed mistakes agents make. Use a
new parser or general rule engine only when the project's inputs require one.
The core stays language-independent; language, pattern and library packs supply
their own checks. A project's vocabulary belongs in its versioned custom pack
and its reviewed assertions, not in universal core naming bans.

## Define the contract before the syntax

Create a short glossary when terms are ambiguous or recur across tasks. Ask the
domain owner to confirm each definition. Include the verbs, legal transitions,
units, scope, failure behavior and intentional exceptions. An existing domain
model is evidence; a folder called `domain` does not prove that model is correct.

| Term | Meaning in this fictional ordering example | Observable condition |
| --- | --- | --- |
| Draft | An order that can still acquire lines | It can be empty; it cannot be placed empty |
| Place order | Accept the current nonempty order | Only a draft can become placed |
| Cancel order | End an order with a stated reason | A bounded nonempty reason is required; a cancelled order cannot be cancelled again |
| Order command | One named operation, not an arbitrary patch | Unknown verbs and extra fields are rejected at the boundary |

This example's decisions are local policy. Some real products permit repeated
cancellation for idempotency or cancellation only before fulfillment. Define and
test the actual policy instead of installing this example unchanged.

## Use a closed command vocabulary

The [executable example](../examples/domain-language/order.ts) uses a discriminated
union for `place-order` and `cancel-order`, immutable values and a pure transition
function. A parser admits only those command shapes. Domain transitions enforce
their invariants even when an internal caller bypasses the parser. The exhaustive
switch forces a typecheck when a new command is added without its implementation.

Run the [behavior and rejection tests](../examples/domain-language/order.test.ts):

```sh
bun test ./docs/examples/domain-language/order.test.ts
```

Copy and adapt the model, parser and tests into the consuming project. Keep UI,
database and third-party terminology in adapters that translate into the command
vocabulary. Authentication, tenant scope, persistence, retries and UI behavior
require their own assertions; this small example does not implement them. Its
TypeScript `readonly` properties constrain typed callers and are not runtime deep
freezing or a security boundary.

## Turn repeated mistakes into a project pack

Combine independently selected slices rather than adopting every author's policy:

| Need | Existing starting point | Evidence still needed |
| --- | --- | --- |
| Explicit operations rather than broad patches | `pstack/boundaries`: PS-PARTIAL-001, PS-AS-001 | Aliases, legal patch exceptions and transition behavior |
| Entity changes keep domain intent | `ddd/ddd-tactical`: DDD-ENT-001 | The project's vocabulary and actual invariant preservation |
| Tests assert outcomes | `mattpocock/testing`, `pstack/proof` | Real outcomes, adapter exceptions and failing controls; syntax alone is insufficient |
| Named inputs and useful boundaries | `mattpocock/design` | Shared reasons for change and measured replacement cost |
| Vocabulary has the intended meaning | `core/CORE-INV-018` | A reviewed assertion plus a domain owner's review of the definitions |

The mattpocock pack is bundled and optional. Inspect `pack show --library <id>`
before adoption. Use [the conversion worksheet](rule-pack-worksheet.md) to record
the concrete failure, exact source, scope and exceptions. Start syntactic
heuristics in shadow/warn, with pass/fail/trap fixtures. Do not infer glossary
quality from spelling or invent a semantic guarantee from a matching identifier.

For a reviewed semantic assertion, use the existing binding helper after copying
and adapting the tests. For example, from the consuming project root:

```sh
pregate fitness bind core/CORE-INV-018 \
  --command-json '["bun","test","test/domain/order-language.test.ts"]' \
  --inputs 'src/domain/**,test/domain/**,docs/domain-glossary.md,package.json,bun.lock' \
  --rationale 'Checks the reviewed order vocabulary, command rejection and transition table; other bounded contexts require additional assertions' \
  --preview
```

Those paths must exist in the project and contain the adapted assertion. Include
all helpers/configuration that define its behavior. Review the exact digest,
approve as a human, then run `fitness run CORE-INV-018`. A green test verifies
its declared scope; it does not certify all naming or business meaning. If the
requirement covers more contexts, expand the assertion before claiming coverage.

Verify the verifier: remove the empty-order guard or admit an extra command field
in an isolated copy and confirm the test fails. Also test a legitimate exception.
Record the limitation when a rule cannot reliably distinguish the two. Preserve
existing frozen debt and fix new violations; propose a bounded rule adaptation
when necessary instead of disabling PREGATE.
