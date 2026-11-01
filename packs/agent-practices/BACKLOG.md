# agent-practices backlog

Candidates, judgment, and engine boundaries for the `agent-practices` pack.

The `agent-practices` pack defines 22 project evidence obligations (`PRACTICE-001` through `PRACTICE-022`) across 4 preview methodologies:
1. `agent-practices/launch-safety` (`PRACTICE-001` to `PRACTICE-006`)
2. `agent-practices/security-review` (`PRACTICE-007` to `PRACTICE-012`)
3. `agent-practices/domain-ownership` (`PRACTICE-013` to `PRACTICE-016`)
4. `agent-practices/behavior-testing` (`PRACTICE-017` to `PRACTICE-022`)

All 22 requirements are enforced as `primitive: fitness` project verification gates. Below is the technical backlog separating static AST composition candidates from inherent legal, operational, and runtime boundaries.

## Static pattern composition candidates

- **`PRACTICE-002` (Self-hosted font privacy):**
  - *Candidate:* Compose with `nextjs/rendering/no-google-fonts-link` (`NEXT-FONT-001`) in Next.js TSX codebases to catch `<link href="https://fonts.googleapis.com/...">` at pre-write time.
  - *Static limitation:* CSS `@import` statements, third-party widget stylesheets, and runtime font loaders require stylesheet or network inspection beyond TSX AST matching.

- **`PRACTICE-013` & `PRACTICE-016` (Domain rule ownership and presentation boundaries):**
  - *Candidate:* Compose with `architecture/dependencies/layer-direction`, `architecture/layered/no-presentation-to-persistence` (`LAYER-CLOSE-001`), and `architecture/layered/no-transaction-in-presentation` (`LAYER-TX-001`).
  - *Static limitation:* Determining whether two modules duplicate the same domain business rule requires semantic understanding of the domain model.

- **`PRACTICE-020` & `PRACTICE-022` (Behavioral testing and assertion quality):**
  - *Candidate:* Compose with `testing/testing/no-focused-tests` (`TDD-FOCUS-001`), `testing/testing/no-try-catch-in-test` (`TEST-NOCATCH-001`), and `mattpocock/tests/no-internal-module-mock` (`MP-MOCK-001`).
  - *Static limitation:* Proving that an E2E test exercises a real user flow against realistic fixtures requires test execution receipts.

## Inherent project fitness boundaries (require human review, runtime, or legal verification)

- **Child-Data Safeguards, Subscriptions, Email & DMCA (`PRACTICE-001`, `PRACTICE-003`–`PRACTICE-006`):**
  - Age-gating applicability, session-replay field masking (`rr-block` / `data-private`), one-click unsubscribe headers (`List-Unsubscribe-Post`), subscription cancellation flows, and DMCA agent registration depend on product jurisdiction, vendor configuration, and live integration tests.
- **Security Triage, Sandboxed PoC & Patch Verification (`PRACTICE-007`–`PRACTICE-012`):**
  - Threat modeling, vulnerability triage, isolated PoC reproduction, and regression proof for security patches require human-reviewed security verifiers and execution receipts.
