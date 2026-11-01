# Engineering-skill review

This is the coverage ledger for [mattpocock](README.md). Source: [all engineering skills at the reviewed revision](https://github.com/mattpocock/skills/tree/6fd947921b935b7e1e69293a200400f0fdd5c15f/skills/engineering); commit `6fd947921b935b7e1e69293a200400f0fdd5c15f`; reviewed 2026-10-06. All 20 SKILL.md files and their in-directory Markdown references and shell templates were read as source material, without invoking them. Agent metadata only governs skill invocation and contributes no code invariant.

**Partial** means an admitted syntactic slice, not enforcement of the complete skill. **Workflow** requires session, tracker or execution state. **Unsupported** requires facts outside current primitives. **Review** means the upstream requirement intentionally requires judgment. None of these latter categories is presented as an executable invariant.

## Every skill

| Skill and pinned source | Conversion | Candidate requirements | Limits / companion references |
| --- | --- | --- | --- |
| [ask-matt](https://github.com/mattpocock/skills/blob/6fd947921b935b7e1e69293a200400f0fdd5c15f/skills/engineering/ask-matt/SKILL.md) | Workflow | Choose the appropriate engineering flow; preserve primary context at phase boundaries. | Session state and intent cannot be inferred from a code tree. Reviewed PHASE-BOUNDARIES.md. |
| [code-review](https://github.com/mattpocock/skills/blob/6fd947921b935b7e1e69293a200400f0fdd5c15f/skills/engineering/code-review/SKILL.md) | Review | Separate Standards and Spec results; repository standards override the Fowler baseline. | Smells are explicitly judgment calls upstream. No hard smell rules imported. |
| [codebase-design](https://github.com/mattpocock/skills/blob/6fd947921b935b7e1e69293a200400f0fdd5c15f/skills/engineering/codebase-design/SKILL.md) | Partial | MP-PARAMS-001 observes effective function inputs; injected dependencies and observable results remain design guidance. | Depth, deletion test, locality and justified adapters require semantics. Reviewed DEEPENING.md and DESIGN-IT-TWICE.md. |
| [diagnosing-bugs](https://github.com/mattpocock/skills/blob/6fd947921b935b7e1e69293a200400f0fdd5c15f/skills/engineering/diagnosing-bugs/SKILL.md) | Partial | MP-DEBUG-001 observes tagged console instrumentation. | Reproduction, hypotheses, minimization, regression and cleanup order need execution/session evidence. Reviewed scripts/hitl-loop.template.sh. |
| [domain-modeling](https://github.com/mattpocock/skills/blob/6fd947921b935b7e1e69293a200400f0fdd5c15f/skills/engineering/domain-modeling/SKILL.md) | Unsupported | Use resolved domain terms, keep glossary definitions free of implementation details, and record consequential tradeoffs. | Markdown/domain semantics are outside the engine. Reviewed ADR-FORMAT.md and GLOSSARY-FORMAT.md. |
| [grill-with-docs](https://github.com/mattpocock/skills/blob/6fd947921b935b7e1e69293a200400f0fdd5c15f/skills/engineering/grill-with-docs/SKILL.md) | Workflow | Combine interview decisions with glossary and ADR updates as they crystallize. | A wrapper around other skills has no standalone observable code invariant. |
| [implement](https://github.com/mattpocock/skills/blob/6fd947921b935b7e1e69293a200400f0fdd5c15f/skills/engineering/implement/SKILL.md) | Workflow / existing core | Build the spec; run narrow checks regularly and full checks at completion; review before committing. | Core fitness can bind current typecheck/test evidence, but does not prove chronology or spec fidelity. |
| [implement-spec](https://github.com/mattpocock/skills/blob/6fd947921b935b7e1e69293a200400f0fdd5c15f/skills/engineering/implement-spec/SKILL.md) | Workflow | Schedule only ready task-graph tickets; integrate worktrees onto one branch; verify and clean up. | Requires ticket dependencies, branch history and orchestrator state. |
| [improve-codebase-architecture](https://github.com/mattpocock/skills/blob/6fd947921b935b7e1e69293a200400f0fdd5c15f/skills/engineering/improve-codebase-architecture/SKILL.md) | Review | Scope exploration to stated direction or recent hotspots; propose evidenced deepening candidates and respect ADRs. | A review/reporting workflow; it does not define a numerical depth metric. Reviewed HTML-REPORT.md. |
| [pr](https://github.com/mattpocock/skills/blob/6fd947921b935b7e1e69293a200400f0fdd5c15f/skills/engineering/pr/SKILL.md) | Workflow | Provide an understandable summary, before/after evidence, reversibility and blast-radius assessment. | PR bodies and execution evidence are not static code checks. Reviewed CREDITS.md (Dex Horthy / Humanlayer). |
| [prototype](https://github.com/mattpocock/skills/blob/6fd947921b935b7e1e69293a200400f0fdd5c15f/skills/engineering/prototype/SKILL.md) | Workflow / unsupported | Answer one explicit question; mark throwaway code; avoid persistence unless being tested; keep decisions and prototypes separately. | No HTML parser, runtime persistence or build-environment evaluation. Reviewed LOGIC.md and UI.md; UI mutating variants use stubs. |
| [research](https://github.com/mattpocock/skills/blob/6fd947921b935b7e1e69293a200400f0fdd5c15f/skills/engineering/research/SKILL.md) | Workflow | Trace factual claims to primary sources and save cited findings using the repository's convention. | Citation presence alone cannot prove that a source supports a claim. |
| [retro](https://github.com/mattpocock/skills/blob/6fd947921b935b7e1e69293a200400f0fdd5c15f/skills/engineering/retro/SKILL.md) | Workflow | Turn mechanical recurring errors into deterministic checks; reserve prose standards for judgment. | Requires session evidence and knowledge of existing tool coverage; this pack implements that distinction. |
| [setup-matt-pocock-skills](https://github.com/mattpocock/skills/blob/6fd947921b935b7e1e69293a200400f0fdd5c15f/skills/engineering/setup-matt-pocock-skills/SKILL.md) | Workflow | Preserve existing steering files, configure tracker/labels/doc layout and confirm choices. | Reviewed domain.md, triage-labels.md and all three tracker templates; configuration is intentionally prompt-driven. |
| [tdd](https://github.com/mattpocock/skills/blob/6fd947921b935b7e1e69293a200400f0fdd5c15f/skills/engineering/tdd/SKILL.md) | Partial | MP-SELF-001, MP-MOCK-001, MP-CALLS-001 and MP-MOCK-BRANCH-001 observe specific testing anti-patterns. | Approved seams, public behavior and red-before-green chronology remain unproven. Reviewed tests.md and mocking.md. |
| [to-spec](https://github.com/mattpocock/skills/blob/6fd947921b935b7e1e69293a200400f0fdd5c15f/skills/engineering/to-spec/SKILL.md) | Workflow | Synthesize agreed behavior, test seams and out-of-scope boundaries into a durable spec. | No Markdown/spec semantics; prototype snippets are an explicit exception to the no-code rule. |
| [to-tickets](https://github.com/mattpocock/skills/blob/6fd947921b935b7e1e69293a200400f0fdd5c15f/skills/engineering/to-tickets/SKILL.md) | Workflow | Use verifiable vertical tickets with true blockers; use expand-contract for wide refactors. | Requires task-graph state and CI evidence. Do not interpret every refactor as a vertical slice. |
| [triage](https://github.com/mattpocock/skills/blob/6fd947921b935b7e1e69293a200400f0fdd5c15f/skills/engineering/triage/SKILL.md) | Workflow | Use exactly one category and state role, verify claims, and produce durable briefs with acceptance criteria. | Requires tracker state and maintainer decisions. Reviewed AGENT-BRIEF.md and OUT-OF-SCOPE.md; built features are not rejected features. |
| [wayfinder](https://github.com/mattpocock/skills/blob/6fd947921b935b7e1e69293a200400f0fdd5c15f/skills/engineering/wayfinder/SKILL.md) | Workflow | Keep a map as an index; claim ready tickets; record each decision once; distinguish fog from out of scope. | Requires issue graph, human exchanges and session claims; decision tickets are not implementation tickets. |
| [wizard](https://github.com/mattpocock/skills/blob/6fd947921b935b7e1e69293a200400f0fdd5c15f/skills/engineering/wizard/SKILL.md) | Workflow / unsupported | Capture secrets with hidden input, persist values to their intended destinations, confirm irreversible actions and syntax-check the wizard. | Bash/template state is outside this engine. Reviewed template.sh; do not execute a generated interactive wizard as part of pack checks. |

## Admitted invariant slices

| ID | Observable condition | Evidence section | Local policy / exceptions |
| --- | --- | --- | --- |
| MP-SELF-001 | Same identifier/scalar on both sides of positive direct equality matcher | tdd/SKILL.md, Anti-patterns; tdd/tests.md, Tautological tests | Independent literals/results pass; stateful calls and getters are not analyzed |
| MP-MOCK-001 | Recognized mock API with literal relative module specifier | tdd/mocking.md, When to Mock | Relative module ownership is a proxy; injected boundary stand-ins and external packages pass |
| MP-CALLS-001 | Recognized count/order matcher in an expect chain | tdd/tests.md, Bad Tests / Red flags | Boundary call-count contracts can be legitimate; ordinary argument assertions pass |
| MP-MOCK-BRANCH-001 | if/switch/ternary inside inline vi.fn/jest.fn callback | tdd/mocking.md, Designing for Mockability | Specific operation responses pass; intentional stateful fakes need review |
| MP-PARAMS-001 | More than max effective inputs at a parsed function | codebase-design/SKILL.md, Small surface area | Local max=4, configurable; no claim about module depth |
| MP-DEBUG-001 | Direct console call with argument starting [DEBUG-...] | diagnosing-bugs/SKILL.md, Instrument / Cleanup | Ordinary operational logs pass; temporary logs can be intentional during diagnosis |

Each row links to its pinned source in the methodology's generated [reference](REFERENCE.md). Every check has at least two pass, two fail and one trap fixture. A trap is a violation that must remain observable through a realistic variation, rather than an intentionally uncovered form.

## Reusable adjacent coverage

| Requirement | Existing policy / capability | What remains unverified |
| --- | --- | --- |
| Completion uses current passing typecheck/test evidence | [Core fitness reference](../../docs/core-catalog.md) and [project verifier bindings](../../docs/features/project-fitness.md) | Red-before-green order, regular execution and choice of an adequate seam |
| Tests must actually exercise an assertion | [pstack/proof](../pstack/REFERENCE.md) | Independent truth and observable public behavior |
| Full suite must remain runnable | [testing/tdd](../testing/REFERENCE.md) | That the suite ran; runner aliases/modifiers outside its slice |
| Message-chain smell during review | [senior/fowler](../senior/REFERENCE.md) | Whether chaining is inappropriate; upstream code-review labels smells as heuristic |
| Repeated mechanical errors should have checks | [Pack authoring guide](../../docs/guides/docs-to-rule-pack.md) | Whether a particular session establishes a recurring error |

These are references, not dependencies or automatic activation. Existing tests may intentionally be replaced during module deepening, so a no-decrease assertion ratchet is not imported as a universal Matt Pocock rule.

See [BACKLOG.md](BACKLOG.md) for the concrete facts needed before additional candidates can ship.
