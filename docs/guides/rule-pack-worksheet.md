# Rule pack conversion worksheet

Copy this Markdown into your pack's authoring notes and replace the placeholders.
Follow the [conversion guide](docs-to-rule-pack.md) to create the data files.
This worksheet is documentation; PREGATE does not execute or import it.

## Source and compatibility

- Pack namespace and version: `<namespace>@<version>`
- Source kind: `<skill / library documentation / team policy>`
- Source title, URL or local path: `<source>`
- Source version/revision and section: `<immutable revision and section>`
- Source license and permitted reuse: `<license or permission>`
- Applicable library versions and migration direction: `<versions>`
- Tested PREGATE version and languages: `<engine version; languages>`
- Intended project scope and exceptions: `<paths, layers, exclusions>`

Record compatibility and licensing in the pack README. These are authoring notes,
not additional fields to insert into `source.json` or `check.json`.

## Classify each requirement

| ID | Paraphrased requirement | Evidence locator | Decision | Checker and limits |
| --- | --- | --- | --- | --- |
| `<id>` | `<one observable condition>` | `<revision/section>` | `<executable / evidence obligation / workflow / unsupported>` | `<primitive or AST pattern; unsupported facts>` |

Use these decisions consistently:

- **Executable:** a supported checker can establish the stated condition.
  Create a check, a methodology invariant and its fixture suite.
- **Evidence obligation:** a semantic/runtime/process condition has explicit
  applicability and a project can implement a reviewed assertion for it. Declare
  a `fitness` check and receipt fixtures. Document the actual proof needed;
  neither a syntax reference nor a passing receipt fixture proves that property.
- **Workflow:** instructions such as installing a dependency, consulting a guide
  or performing a migration. Retain them in documentation or a companion skill.
  Extract a separate executable condition only if it has a supported checker.
- **Unsupported:** claims requiring unavailable facts, such as production latency
  or complete security. Document the gap and the evidence a future checker needs.

For example, a skill may say “read the migration guide, replace the retired
package and run tests.” The supported import rule can detect literal imports of
the retired package. It cannot establish that the guide was read, tests ran, the
replacement API behaves correctly or the entire migration is complete.

## Specify one executable candidate

- Invariant alias and check ID: `<NS-ALIAS>; <ns/area/check>`
- Condition: `<exact violation and exceptions>`
- Methodology: `<independently selectable ns/methodology>`
- Supported languages and paths: `<language-specific scope>`
- Checker, parameters and measurable facts: `<implementation and defaults>`
- Initial severity: `<warn / ask / deny / off>`
- Initial enforcement: `<project shadow or enforce selection>`
- Provenance: `<source.work; source.locator; source.paraphrase>`
- Why it matters: `<concrete consequence>`
- Smallest repair: `<fixHint>`
- Changes to avoid: `<avoid>`
- Coverage limits: `<what this rule cannot determine>`
- Interactions with other packs: `<relations: contradicts / duplicates ns/ALIAS, or idiom ns; why; settle>`
- Stable condition: `<what must remain true when the implementation changes>`
- Applicability and exceptions: `<when the condition applies; valid alternatives>`
- Enforcement contract: `<product invariant / contextual policy / heuristic>`
- Violating control: `<a counterexample that the checker or project assertion rejects>`

Enforcement belongs to the consuming preset. A pack's severity alone does not
demonstrate that it will block a change in that project.
These classification notes do not add schema fields. A metric or heuristic is
not a universal invariant. Follow [enforcement criteria](invariant-enforcement.md)
before recommending blocking; preserve valid inference and implementation alternatives.

## Fixture evidence

Provide at least two passing cases, two failing cases and one failing trap for
each promised language. Add more cases for the coverage you advertise.

| Case | Language and target | Expected result/location/measurement | Purpose |
| --- | --- | --- | --- |
| `pass/<name>` | `<language; path>` | `<pass; metric if applicable>` | `<allowed behavior>` |
| `pass/<name>` | `<language; path>` | `<pass; metric if applicable>` | `<similar syntax that must remain allowed>` |
| `fail/<name>` | `<language; path>` | `<fail; line; metric if applicable>` | `<direct violation>` |
| `fail/<name>` | `<language; path>` | `<fail; line; metric if applicable>` | `<another supported violation>` |
| `trap/<name>` | `<language; path>` | `<fail; line; metric if applicable>` | `<realistic evasion>` |

Record the fixture command, tested engine version and actual outcome. Compare
the rule's advertised coverage against the cases; a passing suite proves the
cases, not universal precision.

## Review and distribution record

- Fixture result: `<command, engine version, outcome>`
- Consuming-project audit: `<scope, findings, errors and skipped rules>`
- Human review: `<accepted source and selected methodologies/invariants>`
- Calibration: `<reviewed false positives, uncertainties and added regressions>`
- Publication: `<pack-root repository, immutable tag/commit, license>`
- Update notes: `<changed requirements, compatibility and coverage>`

Publish only the admitted executable candidates as rules. Keep workflow and
unsupported entries visible in the README so consumers can assess what remains
outside enforcement. Providers can publish documentation, skills and rule packs
together; each pack must retain its own provenance, fixtures and selectable scope.
