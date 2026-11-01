# Maintainability & Software Engineering Invariants Catalog (200 Rules)

This document integrates the complete 200 invariant rules from:
1. **One Hundred Invariants for Code Maintainable by Future Humans** (FH-01 to FH-100)
2. **One Hundred Invariant Rules for the Software Engineer–Architect** (SE-01 to SE-100)

Every rule is tracked with its enforcement mechanism: whether it is an automated binary AST check in PREGATE, or an architectural review invariant.

---

## Part 1: One Hundred Invariants for Code Maintainable by Future Humans

### 1. The future reader
- **FH-01:** Every module is intelligible to a competent engineer who has never seen the repository, given only the module and its public contract. *(Review invariant)*
- **FH-02:** No understanding of a change requires oral history, a Slack thread, or the presence of the original author. *(ADR & PR governance)*
- **FH-03:** The bus factor of every critical path is greater than one: a second person can modify it without a guided tour. *(Team governance)*
- **FH-04:** Every assumption a future reader must not violate is written next to the code that embodies it, not in a separate document that can drift. *(Colocated contracts)*
- **FH-05:** No identifier requires the reader to know the author's private abbreviation, ticket number, or nickname. *(Enforced: `maintainability/MAINT-NAME-001` & naming review)*
- **FH-06:** The happy path of every module is readable in one pass, top to bottom, without jumping to a definition to recover intent. *(Layout & structure)*
- **FH-07:** Every surprise relative to the principle of least astonishment is marked at the point of surprise, with the reason it exists. *(Documented exceptions)*
- **FH-08:** No comment restates what the code already says; every comment that remains answers a question the code cannot. *(AST slice: `pstack/PS-COMMENT-001`; semantic review remains)*
- **FH-09:** Deleted explanations are deleted with the code they explained; no comment describes a world the code has left. *(Refactoring hygiene)*
- **FH-10:** A future reader can answer "what does this do, and what must not change?" from the names and the tests alone. *(Self-describing tests & types)*

### 2. Intent and vocabulary
- **FH-11:** Every name denotes a domain concept or an operation, never an implementation accident (`data`, `temp`, `flag`, `obj2`). *(Enforced: `maintainability/MAINT-NAME-001`)*
- **FH-12:** The ubiquitous language of the domain is the language of the code; a term in the code means the same thing it means to a domain expert. *(Domain modeling)*
- **FH-13:** Each concept has one name; each name denotes one concept. Synonyms are treated as defects. *(Domain dictionary)*
- **FH-14:** A rename of a domain concept is atomic across code, tests, and the contract that exposes it. *(Refactoring discipline)*
- **FH-15:** Boolean names state the true condition (`isClosed`, `hasPendingInvoice`), never a negated or ambiguous predicate. *(Enforced: `maintainability/MAINT-BOOL-001`)*
- **FH-16:** Units, currencies, and time zones are in the type or the name; a bare number never carries an implicit unit. *(Branded types / naming)*
- **FH-17:** Abbreviations are expanded unless they are standard in the domain (`HTTP`, `URL`); project-local abbreviations are forbidden. *(Vocabulary review)*
- **FH-18:** The scope of a name matches its lifetime: a name used across a boundary is stable; a name used inside a function may be short only if its role is obvious in one line. *(Scope hygiene)*
- **FH-19:** No name encodes a layer, a pattern, or a framework (`UserServiceImpl`, `ManagerHelper`) when a domain name would do. *(AST slice: `maintainability/MAINT-IMPL-001` for Impl/Implementation class names; other pattern names need review)*
- **FH-20:** A future reader can pronounce every public name and use it in a sentence about the business. *(Spoken clarity)*

### 3. Local reasoning
- **FH-21:** The effect of a function is fully described by its name, its arguments, and its declared result; hidden reads and writes of ambient state do not exist. *(Enforced: `pstack/PS-LET-001`)*
- **FH-22:** No function both answers a question and changes the world. *(Command Query Separation)*
- **FH-23:** Mutable state does not escape the scope in which a reader can see every write. *(Enforced: `typescript/TS-READONLY-001` & `pstack/PS-LET-001`)*
- **FH-24:** Control-flow nesting never exceeds two levels; deeper decisions are named functions. *(Enforced: `maintainability/MAINT-NEST-001`)*
- **FH-25:** A function fits in working memory: one screen, one responsibility, one level of abstraction. *(Enforced: `clean-code/CC-FN-001`)*
- **FH-26:** Arguments are few enough that the call site reads as a sentence; a long argument list is a missing concept. *(Enforced: `clean-code/CC-FN-002`)*
- **FH-27:** No Boolean argument selects a hidden second behaviour. *(Enforced: `senior/SR-FLAG-001`)*
- **FH-28:** Order of statements inside a function is the order of the story; setup, action, and result are not interleaved with unrelated concerns. *(Narrative order)*
- **FH-29:** A reader can predict the next line. When they cannot, the unpredictability is the defect, not the reader's failure. *(Least surprise)*
- **FH-30:** Cyclomatic complexity of a function is low enough that every path can be named and tested. *(Branch minimization)*

### 4. Locality of change
- **FH-31:** A requirement change touches one module, or a set of modules whose joint reason to change is explicit. *(High cohesion)*
- **FH-32:** Shotgun surgery — the same concept edited in many unrelated places — is treated as a design defect, not as normal work. *(Architectural smell)*
- **FH-33:** What changes together lives together; what changes for different reasons does not share a module. *(Enforced: `architecture/MOD-SHARED-001`)*
- **FH-34:** A boundary is drawn where the rate of change differs, not where the technology differs. *(Boundary strategy)*
- **FH-35:** Feature flags and temporary branches have an owner and an expiry; an expired flag is a defect. *(Release engineering)*
- **FH-36:** No copy of a business rule exists outside its authoritative module. Callers depend on the rule, they do not reimplement it. *(DRY business logic)*
- **FH-37:** Configuration that operators change is outside the code; configuration that developers change is code, reviewed and versioned. *(12-factor config)*
- **FH-38:** A database migration is reversible or explicitly marked irreversible, with the recovery path written down before it runs. *(AST slice: `maintainability/MAINT-MIGR-001` for TS/JS migrations without a down step; SQL migrations and reverse correctness need review)*
- **FH-39:** Public contracts change by addition or by a versioned break; silent changes of meaning are forbidden. *(Semantic versioning)*
- **FH-40:** The diff of a change is reviewable by a human in one sitting. A diff that cannot be reviewed is two changes. *(Diff atomicity)*

### 5. Boundaries that survive their authors
- **FH-41:** Every module has a public surface small enough to memorise and a private interior free to change. *(AST slice: `architecture/MOD-EDGE-001`; public-surface size is not checked)*
- **FH-42:** Callers depend on the contract, never on the order of fields, the shape of errors, or the timing of internal calls. *(Encapsulation)*
- **FH-43:** Third-party types do not leak across a boundary the team owns; an adapter is the only place that knows a vendor. *(Enforced: `architecture/HEX-PORT-001`)*
- **FH-44:** A boundary documents what it guarantees, what it refuses, and what it leaves undefined. *(Contract specification)*
- **FH-45:** Error types at a boundary are part of the contract; a new failure mode is a contract change. *(Typed errors)*
- **FH-46:** Timeouts, retries, and idempotency keys are part of the boundary contract, not an implementation detail discovered in production. *(AST slices: `pstack/PS-IDEM-001` and `vibe-proof/VP-TIMEOUT-001`; retry policy is not checked)*
- **FH-47:** A module can be deleted. If it cannot, the reason is written on the module, not left implicit. *(Deletability)*
- **FH-48:** Layering is one-directional. A domain concept does not import a delivery or infrastructure concept. *(AST slices: `architecture/DEP-ENT-001` and `architecture/DEP-UC-001`)*
- **FH-49:** The dependency graph of the system is acyclic at the module level, or every cycle is named and justified. *(Acyclic dependencies)*
- **FH-50:** A new team member can draw the boundaries of the system from the repository layout without a diagram that lives elsewhere. *(Screaming architecture)*

### 6. Knowledge that does not rot
- **FH-51:** The reason for a non-obvious decision sits in an architecture decision record linked from the code it constrains. *(ADR governance)*
- **FH-52:** ADRs are immutable records; a reversed decision is a new record that supersedes the old one, not an edit of history. *(Immutable decision records)*
- **FH-53:** Comments explain why, never what. A "what" comment is a failed name. *(AST slice: `pstack/PS-COMMENT-001`; meaning still needs review)*
- **FH-54:** TODO and FIXME carry an owner and a condition of removal; an ownerless TODO is deleted or promoted to a tracked defect. *(Enforced: `musk/MUSK-REQ-001`)*
- **FH-55:** No commented-out code remains. History lives in version control. *(Enforced: `pstack/PS-COMMENT-001`)*
- **FH-56:** The README of a module states its purpose, its non-purpose, and how to run its tests, in under one screen. *(Module documentation)*
- **FH-57:** Onboarding to a critical path is a written path — build, test, change, observe — not a pairing session that vanishes. *(Written onboarding)*
- **FH-58:** Runbooks for operational failure live next to the code that fails, or link to it; they are exercised, not merely stored. *(Operability)*
- **FH-59:** Glossaries of domain terms are generated from the code's public names or checked against them; a glossary that diverges is a defect. *(Glossary sync)*
- **FH-60:** A future reader can reconstruct the sequence of decisions that produced a module from the record, without interviewing anyone. *(Traceability)*

### 7. Tests as the specification the future can trust
- **FH-61:** Tests describe behaviour in the language of the domain, not in the language of the implementation. *(Behavioral tests)*
- **FH-62:** A failing test names the behaviour that broke, without requiring the reader to open production code first. *(Clear assertions)*
- **FH-63:** Every behaviour a future editor must preserve has a test that fails if it is lost. *(Living specification)*
- **FH-64:** Tests do not duplicate production logic; they state examples and boundaries. *(Anti-mirrored test logic)*
- **FH-65:** A test that fails intermittently is a defect in the test or in the system, and is not ignored. *(Flaky test zero-tolerance)*
- **FH-66:** Test data is recognisable as domain data. Obscure fixtures (`user1`, `foo`, `xxx`) are forbidden on public behaviour. *(Meaningful fixtures)*
- **FH-67:** The test suite is the living specification: when the test and the comment disagree, the test is the authority, and the comment is fixed or removed. *(Test supremacy)*
- **FH-68:** Characterisation tests pin behaviour before a legacy module is changed; unpinned legacy behaviour is not modified. *(Golden master / pinning)*
- **FH-69:** A test runs in seconds at the unit boundary and does not require a human environment, a secret, or a particular clock. *(Deterministic hermetic tests)*
- **FH-70:** Deleting a test requires a recorded reason. A deleted test is a deleted promise. *(Enforced: `testing/TDD-DEL-001`)*

### 8. Time, history, and aging
- **FH-71:** Code does not depend on the current date, the author's timezone, or the locale of the machine that builds it, except through an explicit clock and locale port. *(AST slice: `maintainability/MAINT-CLOCK-001` for direct domain clock calls; locale and indirect calls need flow analysis)*
- **FH-72:** No certificate, key, URL, or vendor endpoint is assumed permanent; each has a rotation or replacement path. *(Secret lifecycle)*
- **FH-73:** Deprecated surfaces announce their replacement and their removal condition at the point of use. *(AST slice: `maintainability/MAINT-DEPR-001` for empty JSDoc deprecation tags; the stated replacement and removal condition need review)*
- **FH-74:** A compatibility shim has a deletion criterion written on the shim. *(Enforced: `musk/MUSK-DEL-001`)*
- **FH-75:** Log lines and error messages remain meaningful after the author has left: they name the operation, the entity, and the failure, not an internal nickname. *(Structured error messages)*
- **FH-76:** Metrics and traces use stable names. Renaming an observability field is a contract change for the people who page on it. *(Observability stability)*
- **FH-77:** Data written today can be read by the code of next year, or a migration exists before the write format changes. *(Schema evolution)*
- **FH-78:** A feature removed from the product is removed from the code. Dead feature paths are not kept "in case." *(Enforced: `musk/MUSK-DEL-001` & dead code removal)*
- **FH-79:** Dependencies pin versions and record why a major upgrade is blocked; an unexplained pin is a defect. *(Dependency management)*
- **FH-80:** The oldest code in the repository is still approachable: it meets the same naming and test invariants, or it is isolated behind a boundary marked legacy. *(Legacy quarantine)*

### 9. Fear, safety, and the cost of being wrong
- **FH-81:** A future editor can run the relevant tests with one command and trust a green result. *(Single-command verification)*
- **FH-82:** A wrong change fails in the test or at the boundary, not silently in production a week later. *(Shift-left verification)*
- **FH-83:** Rollback of a release is a documented, practiced path, not a theory. *(Release rollback)*
- **FH-84:** Feature introduction can be separated from feature activation, so a bad change can be disabled without a redeploy of logic. *(Decoupled release)*
- **FH-85:** Observability is sufficient for a stranger to tell whether their change worked in production, without asking the author. *(Production telemetery)*
- **FH-86:** No global mutable singleton is the hidden input of a module a stranger must change. *(Enforced: `pstack/PS-LET-001`)*
- **FH-87:** Construction of collaborators is visible at the composition root; a stranger can substitute a fake without editing the module. *(Composition root)*
- **FH-88:** Invariants of a data structure are enforced by the type or by a constructor, not by the hope that every caller remembers them. *(Parse, don't validate)*
- **FH-89:** Partial failure is explicit. A function does not return success while having done half the work, unless the contract says the operation is partial and how to resume it. *(Explicit failure modes)*
- **FH-90:** The cost of a mistake on a critical path is bounded: limits, quotas, and kill switches exist before they are needed. *(Blast radius containment)*

### 10. The social invariants of a maintainable codebase
- **FH-91:** Code review checks maintainability for a future stranger, not style preference and not the author's intent as privately understood. *(Maintainability-first review)*
- **FH-92:** Review comments that encode a real invariant are promoted into code, a test, or an ADR; they do not remain only in the review. *(Promote lessons to structure)*
- **FH-93:** Ownership of a module is a name a future reader can find. Unowned code is assigned or deleted. *(Named code ownership)*
- **FH-94:** A module no one can explain is a risk, and is scheduled for characterisation or isolation. *(Risk register)*
- **FH-95:** Onboarding material is updated in the same change that invalidates it. *(Documentation freshness)*
- **FH-96:** Commit messages state the problem and the reason, not only the file touched. A future bisect can be read as a narrative. *(Narrative commits)*
- **FH-97:** Large rewrites are not the plan for unmaintainable code. Incremental characterisation and boundary extraction are. *(Strangler fig refactoring)*
- **FH-98:** Cleverness that saves lines at the cost of a future reader's hour is rejected. The reader's hour is the scarce resource. *(Clarity over cleverness)*
- **FH-99:** The team can delete code. Addition without a path to removal is treated as debt. *(Enforced: `musk/MUSK-DEL-001`)*
- **FH-100:** Every change leaves the touched region easier for the next stranger than it was found, or the reason it could not is written on the change. *(Boy Scout rule)*

---

## Part 2: One Hundred Invariant Rules for the Software Engineer–Architect

### 1. Epistemology and process
- **SE-01:** Every line of code exists to satisfy a verifiable problem; code with no associated problem is not written. *(Requirement traceability)*
- **SE-02:** Every fragment of code is intelligible to an engineer who did not author it, without reconstruction of the author's mental context. *(Intelligibility)*
- **SE-03:** Every non-obvious design decision has a recorded trade-off (ADR) stating context and the rejected alternative. *(ADRs)*
- **SE-04:** No line of code exists without a justification of value; dead code is deleted. *(Enforced: `senior/SR-DEAD-001`)*
- **SE-05:** Every third-party dependency is declared, isolated, audited, and replaceable. *(Dependency isolation)*
- **SE-06:** No known design or code defect remains without an owner and a correction plan. *(Defect ownership)*
- **SE-07:** The adopted solution is the simplest one that satisfies the current requirement. *(Simplicity principle)*
- **SE-08:** No abstraction, parameter, or extension exists for a requirement that has not yet been confirmed. *(Enforced: `maintainability/MAINT-EMPTY-001`)*
- **SE-09:** Each item of system knowledge has exactly one authoritative representation. *(Single source of truth)*
- **SE-10:** Every module admits a one-sentence explanation containing no exceptional qualifiers. *(Single responsibility)*
- **SE-11:** The intent of the code is evident to a human reader before it is evident to the compiler. *(Human-readable intent)*
- **SE-12:** No module is retained out of attachment; it is retained only while it remains the best representation of the problem. *(Objective retention)*
- **SE-13:** Every corrected defect has an identified root cause, not merely a suppressed symptom. *(Root-cause debugging)*
- **SE-14:** No unexpected behaviour is left without a verified hypothesis. *(Empirical investigation)*
- **SE-15:** Every behavioural change is introduced singly, with verification between changes. *(Atomic increments)*
- **SE-16:** Every communicated estimate is a range with explicit assumptions, never a point value. *(Range estimation)*
- **SE-17:** Every prototype is discarded or rewritten before it enters production; its only permanent product is learning. *(Throwaway prototypes)*
- **SE-18:** Every large feature has at least one vertical slice operating end to end before it is widened. *(Workflow invariant; path-shape checks cannot establish an end-to-end running slice)*
- **SE-19:** No irreversible decision is taken before the information that would make it reversible, or cheap to reverse, is available. *(Reversibility)*
- **SE-20:** No technology is adopted by fashion; every adoption has a documented criterion of fit to the problem. *(Technology evaluation)*

### 2. Naming and readability
- **SE-21:** Every name discloses the intent of the entity without a comment. *(Self-documenting names)*
- **SE-22:** Every name is pronounceable and searchable across the repository. *(Searchable identifiers)*
- **SE-23:** Every type bears a noun name; every function bears a verb or verb–noun name. *(Grammatical naming)*
- **SE-24:** Each domain concept has exactly one term in the code. *(Consistent domain terms)*
- **SE-25:** No name encodes type, scope, or visibility. *(No Hungarian prefixing)*
- **SE-26:** No numeric or string literal carrying domain meaning appears outside a named constant. *(Magic literal elimination)*
- **SE-27:** The entire repository conforms to a single set of formatting rules, enforced by tooling. *(Automated formatters)*
- **SE-28:** Vertical whitespace separates distinct ideas; visual proximity groups what changes together. *(Visual grouping)*
- **SE-29:** Every variable is declared in the narrowest scope that permits its use. *(Enforced: `pstack/PS-LET-001`)*
- **SE-30:** No condition is expressed in negative form when an equivalent positive form exists. *(Enforced: `maintainability/MAINT-BOOL-001`)*

### 3. Functions and methods
- **SE-31:** Every function has a single responsibility and a single level of abstraction. *(Single level of abstraction)*
- **SE-32:** Every function fits on one screen and is comprehensible without scrolling. *(Enforced: `clean-code/CC-FN-001`)*
- **SE-33:** Every function has at most three arguments, or a single options object if more are required. *(Enforced: `clean-code/CC-FN-002`)*
- **SE-34:** No function receives a Boolean that selects between two behaviours. *(Enforced: `senior/SR-FLAG-001`)*
- **SE-35:** Every function is either a command or a query, never both. *(Command Query Separation)*
- **SE-36:** Every side effect is declared in the function name or in its contract. *(Declared effects)*
- **SE-37:** No function mutates its arguments unless the contract so declares. *(Argument immutability)*
- **SE-38:** Every non-trivial conditional branch body is extracted to a named function. *(Branch extraction)*
- **SE-39:** Every boundary condition is encapsulated in a single place. *(Encapsulated boundary conditions)*
- **SE-40:** No function has a control-nesting depth greater than two. *(Enforced: `maintainability/MAINT-NEST-001`)*

### 4. Classes, modules, and design
- **SE-41:** Every module has exactly one reason to change. *(Single Responsibility Principle)*
- **SE-42:** Every new case of a known variation is added by extension, without modifying the module that already works. *(Open/Closed Principle)*
- **SE-43:** Every subtype is substitutable for its base type without altering the observable behaviour of the client. *(Liskov Substitution Principle)*
- **SE-44:** Every interface exposes only operations that all of its implementers use. *(Interface Segregation Principle)*
- **SE-45:** Every high-level module depends on abstractions it owns, never on infrastructure concretions. *(Enforced: `architecture/HEX-PORT-001`)*
- **SE-46:** Every module has high cohesion: its parts change for the same reason. Coupling between modules is explicit and minimal. *(Enforced: `architecture/MOD-SHARED-001`)*
- **SE-47:** Every “has-a” relation is modelled by composition; inheritance is used only when substitutability holds. *(Composition over inheritance)*
- **SE-48:** No method navigates more than one level of indirection over objects it did not create, receive, or own. *(Enforced: `senior/SR-CHAIN-001`)*
- **SE-49:** Every decision that depends on an object's state is taken by that object. *(Tell, don't ask)*
- **SE-50:** Every point of variation lies behind a stable boundary. *(Protected variation)*
- **SE-51:** Construction of the object graph is separated from its use. *(Dependency injection / composition root)*
- **SE-52:** Every dependency is received by constructor or parameter; no module resolves it from a global. *(Explicit dependencies)*
- **SE-53:** Every domain concept with value equality is immutable. *(Immutable value objects)*
- **SE-54:** No domain function returns null; absence is an explicit type. *(AST slice: `maintainability/MAINT-NULL-001`; other paths and indirect values need type/flow analysis)*
- **SE-55:** Every type has a name that a reviewer can speak aloud and understand. *(Pronounceable types)*

### 5. Architecture
- **SE-56:** Domain, application, infrastructure, and delivery occupy separate boundaries; none imports inward across a boundary. *(AST slices: `architecture/DEP-ENT-001`, `architecture/DEP-UC-001` and `architecture/DEP-IA-001`)*
- **SE-57:** The domain references neither frameworks, drivers, nor transport protocols. *(AST slice: `architecture/HEX-EDGE-001`; builtin layer checks may cover more when configured)*
- **SE-58:** Every complex system in production evolved from a simple system that already worked. *(Gall's Law)*
- **SE-59:** The boundary between modules reflects a real communication boundary of the team, or the discrepancy is documented. *(Conway's Law)*
- **SE-60:** Every module can be understood, tested, and replaced without reading the interior of its neighbours. *(AST slice: `architecture/MOD-EDGE-001`; understandability is not checked)*
- **SE-61:** Every published API preserves backward compatibility, or the break is versioned and announced. *(API contract versioning)*
- **SE-62:** Every invalid state is unrepresentable in the types of the public API. *(Parse, don't validate)*
- **SE-63:** No secret, environment URL, or feature flag resides in source code. *(AST slices: `vibe-proof/VP-SECRET-001` and `vibe-proof/VP-CLIENT-SECRET-001`; not every URL or flag is detected)*
- **SE-64:** Every backing service is interchangeable by configuration, without recompilation. *(Pluggable infrastructure)*
- **SE-65:** No application process stores session state in local memory as the source of truth. *(Stateless processes)*
- **SE-66:** Every retryable operation is idempotent. *(Enforced: `pstack/PS-IDEM-001`)*
- **SE-67:** Every call to an external system has a timeout, a bounded retry policy, and a circuit breaker. *(AST slice: `vibe-proof/VP-TIMEOUT-001`; retries and circuit breakers are not checked)*
- **SE-68:** Failure of one component does not propagate resource exhaustion to its neighbours. *(Bulkheads / fault tolerance)*
- **SE-69:** Every business operation emits a structured log, metric, or trace sufficient to diagnose it in production. *(Observability)*
- **SE-70:** The development environment executes the same boundaries and contracts as production, or the difference is isolated and tested. *(Dev/prod parity)*

### 6. Errors, robustness, and security
- **SE-71:** Every impossible state aborts immediately; no error is swallowed silently. *(Enforced: `clean-code/CC-ER-002`)*
- **SE-72:** Every failure carries sufficient context to diagnose it without reproducing the case. *(Diagnostic error context)*
- **SE-73:** The happy path of a module can be read without traversing error handling. *(Separation of errors and logic)*
- **SE-74:** Every assumption of the form “this cannot happen” is guarded by an assertion. *(Exhaustive switch & assertions)*
- **SE-75:** Every input that crosses a boundary is validated before use. *(Boundary parsing requires data flow; `pstack/PS-ZOD-001` only constrains validator placement)*
- **SE-76:** Every process, credential, and role holds only the minimum permissions its function requires. *(Principle of least privilege)*
- **SE-77:** No secret appears in the repository, in the image, or in the logs. *(AST slice: `vibe-proof/VP-SECRET-001`; images and runtime logs are outside this check)*
- **SE-78:** No query or command is constructed by concatenating external input. *(Enforced: `vibe-proof/VP-SQL-001`)*
- **SE-79:** Every ingress boundary verifies authentication and authorisation; none trusts a prior check. *(Zero trust at ingress)*
- **SE-80:** Every dependency has an update owner and a security-patch policy. *(Vulnerability management)*

### 7. Testing
- **SE-81:** Test code satisfies the same naming and structural rules as production code. *(Test code quality)*
- **SE-82:** Every test asserts a single behaviour. *(Review invariant; assertion presence cannot prove behavioural focus)*
- **SE-83:** Every test is deterministic, order-independent, and self-evaluating. *(Hermetic testing)*
- **SE-84:** Every test reads as Arrange–Act–Assert and contains no conditional logic of its own. *(AST slice: `pstack/PS-AAA-001`; helper flow and AAA structure still need review)*
- **SE-85:** Every corrected defect has a test that failed before the correction. *(Regression tests)*
- **SE-86:** Every assumption about a library or an external environment is covered by a boundary test. *(Contract testing)*
- **SE-87:** The test suite passes in full before integration; a broken test blocks the change. *(Pre-commit / CI gate)*
- **SE-88:** Every third-party adapter has tests that fix the usage contract. *(Adapter integration test)*
- **SE-89:** The majority of domain behaviours are covered by unit tests; integration and end-to-end tests cover boundaries, not internal logic. *(Test pyramid)*
- **SE-90:** No test depends on a private implementation detail. *(Public behavior testing)*

### 8. Performance, concurrency, and data
- **SE-91:** No optimisation is merged without a measurement that demonstrates the bottleneck. *(Empirical optimization)*
- **SE-92:** Every algorithm over unbounded data has known complexity and an explicit bound. *(Algorithmic complexity)*
- **SE-93:** No mutable state is shared across threads without a demonstrated synchronisation protocol. *(Thread safety)*
- **SE-94:** No concurrent code exists unless a throughput or latency requirement demands it. *(Simplicity over premature concurrency)*
- **SE-95:** Every non-deterministic failure is treated as a concurrency or timing defect until shown otherwise. *(Race condition vigilance)*
- **SE-96:** Every data transformation has explicit input, output, and error policy. *(Pure transformation pipelines)*
- **SE-97:** Every datum is immutable by default; mutation is local and visible. *(Default immutability)*
- **SE-98:** Every API that returns or accepts collections has a limit, pagination, or backpressure. *(AST slices: `vibe-proof/VP-FIND-MANY-001` and `vibe-proof/VP-SELECT-001`; other APIs need review)*

### 9. Maintenance, delivery, and the team
- **SE-99:** Every change is under version control, in a commit whose message explains the why, and does not break the build. *(Conventional commits)*
- **SE-100:** Every repeatable step of build, test, lint, and deploy is automated; no release depends on an undocumented manual step. *(Automated release engineering)*
