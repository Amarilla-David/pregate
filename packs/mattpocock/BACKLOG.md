# mattpocock coverage backlog

The [complete skill ledger](INVARIANTS.md) is the canonical inventory. This document explains why its remaining candidates are not checks. The [pack README](README.md) describes selection and current limits.

## Testing beyond local syntax

The engine cannot determine whether a seam was approved, whether it is public, whether a test observes a private collaborator or external contract, or whether an expected value was derived independently from the spec. MP-SELF-001 admits only identical identifiers/scalars; arithmetic recomputation through variables would require dataflow and an independent oracle. MP-MOCK-001 admits relative module replacements; path naming cannot establish ownership or system boundaries. MP-CALLS-001 and MP-MOCK-BRANCH-001 require review of external ordering/count contracts and stateful fakes.

One logical assertion may require multiple syntactic assertions. Do not ship a maximum-expect-count rule. Do not require every matcher argument to be a literal: an independently sourced fixture or worked example is valid. Red-before-green, one slice per cycle and refactoring deferred to review need ordered execution/session evidence. The seam note added at this pin (what a proposed seam catches and what it misses) is text in the conversation that agrees the seam. A test file does not carry that note.

Deepening explicitly replaces shallow-module tests. A blanket test/assertion deletion denial would contradict that guidance. Existing assertion ratchets can request review but do not prove a faithful replacement.

## Deep modules and interfaces

A module may be a function, class, package or a tier-spanning slice. The interface includes caller knowledge, ordering, invariants, configuration and error behavior. MP-PARAMS-001 only measures effective input width with a local max; upstream does not specify four inputs.

Depth is leverage, not implementation-line padding or a class-method count. The deletion test, locality, actual adapter variation, accepting dependencies and returning results all require semantic context. A ban on every constructor or void-returning function would reject legitimate adapters and stateful modules. A one-adapter port is a candidate for design review, not an AST violation.

## Diagnosis and cleanup

A tight reproduction must exercise the exact reported symptom and be run before hypotheses. Minimization needs repeated executions; perf diagnoses need baseline measurements; flaky diagnoses need a stable measured reproduction rate. Cleanup requires the original scenario and regression checks to pass, not merely the absence of a debug string.

MP-DEBUG-001 observes direct tagged logs at all phases. It does not know whether diagnosis has ended. Untagged instrumentation, logger adapters, temporary artifacts, secret redaction and root-cause records need additional scope or runtime facts. Do not replace this rule with a ban on all operational console output.

Phase 5 now says: if the red was forced by mutating code or a fixture, `diff` that edit against a pristine copy before trusting the failure. The tree after the fact cannot show the pristine copy, the mutation, or that the diff was read. Do not treat a failing assertion, a changed fixture, or a `diff` call in source as that proof.

## Domain language and durable documents

The glossary is created lazily and contains domain definitions rather than implementation decisions. ADRs are justified only for consequential, surprising tradeoffs. Detecting a missing glossary in every project would contradict setup's instruction to continue when domain docs are absent. Setup now offers to rename a legacy `CONTEXT.md` or `CONTEXT-MAP.md` to the `GLOSSARY` name. That is an offered migration of this skill's file, not a ban on every file with that name.

Specs, briefs, research reports, maps and PR bodies need meaningful acceptance criteria, supported citations, explicit scope and evidence. Markdown shape alone cannot establish those properties, and the current engine does not parse these documents. Prototype-derived decision snippets are allowed in specs/tickets; do not forbid every code fence or path mechanically.

## Tracker and orchestration state

Exclusive triage category/state roles, ready-frontier selection, blocking relationships, claim ownership, single-source decisions and expand-contract integration need a tracker graph and ordered events. Branch isolation, merging from the integration tip and cleaning worktrees need Git/orchestrator facts. Session compaction and context-primary-source choices are session decisions.

The same limit covers the requirements added at this pin. A fresh context window, a new implementer subagent per ticket, a foreground pair of review sub-agents, a search that must include `CODING_STANDARDS.md` and `CONTRIBUTING.md` when those files exist, a fetched ticket title, `wayfinder:` labels with no triage label, real issue ids instead of a placeholder, and a research branch with no pull request are all session, tracker or host actions. The presence of `CONTRIBUTING.md` is not a violation, and its absence is not one either.

The pack does not invoke skills, spawn agents, publish issues, close tickets, commit work or run interactive setup. Those actions belong to an explicitly chosen workflow.

## Prototypes and human wizards

Prototype persistence exceptions depend on the question being tested. UI variants must preserve their host page's fetching/auth, use stubs for mutations and keep the switcher out of production; deciding this needs framework/build/runtime facts. A component named PrototypeSwitcher is not proof of a throwaway route or a missing production gate.

Wizard secret input, template integrity, idempotent environment writes, exact CI-secret matching, irreversible-action confirmation and shell syntax require Bash/CI/template analysis. The template at this pin uses Readline, single-quoted `.env` values, a symlink-preserving write, an EOF failure, a `tput` fallback and stages kept inside `run_wizard`. Those are properties of the generated shell script. No Bash, HTML or Markdown support is introduced by this data pack.

## Conditions for future admission

Use existing primitives when the missing facts become available. Admit a precise violation with pinned evidence, documented exceptions, meaningful pass/fail/trap fixtures and a calibration on a consuming project. Preserve upstream's judgment calls and execution requirements as such; a green static fixture suite cannot certify an entire skill.
