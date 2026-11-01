# Backlog: Future Human Maintainability & SE Invariants

PREGATE supports bounded syntax checks and project-fitness evidence gates. Syntax
cannot establish the semantic properties below. The optional `future-humans`
and `engineering` methodologies now provide one evidence obligation per complete
source clause; reviewed assertions must supply the missing project facts.
Passing pack fixtures tests receipt admission, not the claimed project property.

Many essential invariants from the source documents:
1. *One Hundred Invariants for Code Maintainable by Future Humans*
2. *One Hundred Invariant Rules for the Software Engineer–Architect*
3. *pstack Principles & Installed Skill Invariants*

describe semantic qualities, design decisions, architectural roadmaps, or team dynamics. These cannot be decided from a single AST syntax node. They are preserved below as review criteria for human maintainers, architects, and PR auditors.

---

## 1. Non-Decidable Future Human Maintainability Rules

- **FH-01 (Single-pass comprehension):** "Every module is intelligible to a competent engineer who has never seen the repository, given only the module and its public contract." *Requires comprehension modeling; enforced via peer code reviews.*
- **FH-02 (Zero oral history):** "No understanding of a change requires oral history, a Slack thread, or the presence of the original author." *Enforced via ADRs and complete commit messages.*
- **FH-03 (Bus factor > 1):** "The bus factor of every critical path is greater than one: a second person can modify it without a guided tour." *Organization/team governance.*
- **FH-06 (Readable happy path):** "The happy path of every module is readable in one pass, top to bottom, without jumping to a definition to recover intent." *Subjective layout.*
- **FH-08 (No redundant comments):** "No comment restates what the code already says; every comment that remains answers a question the code cannot." *Natural language understanding of comment vs syntax.*
- **FH-12 (Ubiquitous language):** "The ubiquitous language of the domain is the language of the code; a term in the code means the same thing it means to a domain expert." *Requires domain dictionary.*
- **FH-16 (Explicit units):** "Units, currencies, and time zones are in the type or the name; a bare number never carries an implicit unit." *Branded types or naming conventions (e.g. `timeoutMs`, `amountCents`).*
- **FH-21 (Referential transparency):** "The effect of a function is fully described by its name, its arguments, and its declared result; hidden reads and writes of ambient state do not exist." *Decidable only with whole-program purity analysis.*
- **FH-25 (Working memory fit):** "A function fits in working memory: one screen, one responsibility, one level of abstraction." *Partially approximated by cyclomatic complexity or lines of code, but semantic abstraction level is human.*
- **FH-32 (No shotgun surgery):** "Shotgun surgery — the same concept edited in many unrelated places — is treated as a design defect, not as normal work." *Multi-commit repository history metric.*
- **FH-35 (Expiring feature flags):** "Feature flags and temporary branches have an owner and an expiry; an expired flag is a defect." *Requires integration with feature flag service metadata.*
- **FH-38 (Reversible migrations):** "A database migration is reversible or explicitly marked irreversible, with the recovery path written down before it runs." *`MAINT-MIGR-001` only checks that a TS/JS migration defines a down step; whether down reverses up, SQL migrations and the recorded recovery path are evaluated in database change governance.*

---

## 2. Non-Decidable Software Engineering Invariant Rules

- **SE-01 (Verifiable problem statement):** "Every line of code exists to satisfy a verifiable problem; code with no associated problem is not written." *Traceability from issues/PRs to code.*
- **SE-03 (Documented trade-offs):** "Every non-obvious design decision has a recorded trade-off (ADR) stating context and the rejected alternative." *Enforced via documentation audits.*
- **SE-05 (Replaceable dependencies):** "Every third-party dependency is declared, isolated, audited, and replaceable." *Architectural adapter discipline.*
- **SE-07 (Simplest solution):** "The adopted solution is the simplest one that satisfies the current requirement." *Clean architecture and anti-overengineering heuristic.*
- **SE-09 (Single source of truth):** "Each item of system knowledge has exactly one authoritative representation." *DRY principle across schemas, contracts, and implementations.*
- **SE-13 (Root cause correction):** "Every corrected defect has an identified root cause, not merely a suppressed symptom." *Post-mortem and test coverage audit.*
- **SE-18 (Vertical slice first):** "Every large feature has at least one vertical slice operating end to end before it is widened." *Workflow milestone gating.*
- **SE-35 (Command Query Separation):** "Every function is either a command or a query, never both." *Requires tracking return value semantics alongside mutation state.*
- **SE-41 (Single Responsibility):** "Every module has exactly one reason to change." *Design cohesion evaluation.*
- **SE-43 (Liskov Substitution):** "Every subtype is substitutable for its base type without altering observable behavior." *Behavioral subtyping verification.*

---

## 3. Non-Decidable pstack & Operational Skill Invariants

- **PS-01 (Laziness protocol):** "The merged change is the smallest diff that solves the stated problem. Dead code, unused abstractions, and speculative generality are absent." *Diff minimization protocol.*
- **PS-03 (Redesign from first principles):** "A new requirement is integrated as if it had been a foundational assumption from day one." *Refactoring mindset.*
- **PS-04 (Attack the premise):** "After two or more fixes that share one premise fail the same gate, the premise is rejected." *Agent debugging strategy.*
- **PS-08 (Experience first):** "When implementation convenience conflicts with consumer experience, consumer wins." *Product and developer UX heuristic.*
- **PS-10 (Build the lever):** "Non-trivial edits, migrations, analyses, and checks are performed by a rerunnable tool." *Codemods and automation artifacts.*
- **PS-13 (Type-system discipline):** "Illegal states are unrepresentable. External data is parsed at the boundary. The compiler is not lied to." *Design methodology.*
- **PS-17 (Prove it works):** "A task is not done until the real artifact has been exercised." *Empirical verification.*
- **PS-21 (Guard the context window):** "Bulk evidence is routed to a subagent; coordinating thread holds summary." *Multi-agent prompt orchestration.*
