# angular backlog

Judgment, templates, or checks the TS syntax tree cannot decide. Most need the
HTML/template grammar, preset configuration, or lifecycle judgment the closed
pattern vocabulary does not have.

## Value and provenance limits

The closed pattern vocabulary inspects syntax in one file. It cannot evaluate
arbitrary expressions, resolve imported values, or prove interprocedural data
flow. The following plausible evasions therefore stay out of the deny rules.
They are backlog cases, not pass fixtures or claimed trap coverage.

| Rule | Uncaught flow | Missing capability |
| --- | --- | --- |
| ANG-SUB-001 | An inner subscribe hidden behind a helper called from the callback. | Cross-function nesting and call-graph flow. |
| ANG-PROMISE-001 | A local alias bound to `toPromise` before the call. | Receiver aliases and method binding. |
| ANG-SIGNAL-001 | A helper that writes the signal, called from inside computed. | Call-graph flow out of the computed argument. |
| ANG-HTTP-001 | A typed wrapper that forwards to an untyped call with `as T` on the result. | Cast provenance and wrapper call graphs. |
| ANG-SVC-001 | A shared helper that calls fetch, imported by the service. | Cross-file call graphs; the helper file is outside `*.service.ts`. |

## Template and lifecycle rules

- **ngOnChanges input detection.** Whether a component reacts to an input change needs the lifecycle method plus the template binding; the TS tree alone cannot prove the binding exists.
- **Async pipe versus subscribe judgment.** Preferring the async pipe over manual subscription is a component-design judgment, not a syntax ban; manual subscribes with takeUntilDestroyed are legitimate.
- **Standalone versus NgModule.** The migration choice depends on the repo's Angular major version and existing module graph, which the preset does not declare.
- **Template syntax.** `*ngIf`, `*ngFor`, interpolation, and event bindings live in HTML templates, which the TypeScript grammar does not parse.
- **`@HostBinding` / `@HostListener` versus `host` metadata.** Older style guides preferred the `host` object; the current angular.dev style guide no longer states it, so a ban would rest on no live source.
- **Injection context beyond lifecycle hooks.** ANG-INJECT-001 covers the hook methods Angular calls after construction. Event handlers and other methods may also run outside the context, but they can be called from the constructor too, so only the call graph decides.
- **Selector prefixes.** A company prefix rule needs the preset to name the prefix first; any literal prefix in the pack would be a guess.

## Candidates

- Unsubscribe discipline (`takeUntilDestroyed` on manual subscribes outside the async pipe).
- `OnPush` change detection on leaf components.
- `trackBy` functions on `*ngFor` over mutable lists.
- Service scope (`providedIn: "root"` versus feature providers).
