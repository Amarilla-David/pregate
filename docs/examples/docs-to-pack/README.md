# Documentation-to-pack example

Fictional migration guide, revision 1: “Use `modern-web-kit`; importing
`legacy-web-kit`, including its subpaths, is prohibited in migrated source.”
These names are examples, not an actual vendor policy. This pack demonstrates
how one precise documentation requirement becomes executable data.

The extracted condition is narrower than the whole migration guide: a supported
literal import in `src/**` must not name `legacy-web-kit` or a subpath. Importing
`modern-web-kit` is allowed, but this check does not require its presence or prove
that every retired API has been replaced. Use the
[conversion worksheet](../../guides/rule-pack-worksheet.md) to record that boundary
when adapting the example to your own skill or library.

Run `pregate rules test docs/examples/docs-to-pack` from the PREGATE repository root.
The six fixtures include allowed code, misleading text and literal import evasions.
Select `docs-demo/migration` after adding this directory as a local path source.
The methodology is informational by default; select blocking policy only after
reviewing and calibrating it against the actual consuming project.

Coverage: supported JS/TS literal imports, subpaths, literal dynamic imports and
literal require calls. This rule does not inspect arbitrary runtime loading,
package-manager lockfiles or prove a complete library migration.

Example content is authored for this project and uses the repository's MIT license.
