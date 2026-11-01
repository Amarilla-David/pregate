# consumer-saas backlog

Candidates, judgment, and engine boundaries for the `consumer-saas` readiness pack.

The `consumer-saas` pack defines 39 project evidence gates (`CONSUMER-SAAS-001` through `CONSUMER-SAAS-039`) in `consumer-saas/readiness`, spanning 6 product areas:
1. Accounts & Authentication (`CONSUMER-SAAS-001` to `CONSUMER-SAAS-007`)
2. Privacy & Data Rights (`CONSUMER-SAAS-008` to `CONSUMER-SAAS-014`)
3. Security & Abuse Prevention (`CONSUMER-SAAS-015` to `CONSUMER-SAAS-022`)
4. Billing, Subscriptions & Payments (`CONSUMER-SAAS-023` to `CONSUMER-SAAS-029`)
5. Reliability, Support & Communication (`CONSUMER-SAAS-030` to `CONSUMER-SAAS-034`)
6. Legal, Compliance & Accessibility (`CONSUMER-SAAS-035` to `CONSUMER-SAAS-039`)

All 39 requirements are evaluated as `primitive: fitness` project verification gates. Below is the technical backlog separating composable static slices from runtime, billing, and legal evidence boundaries.

## Composable static slices in companion packs

- **Session & Cookie Security (`CONSUMER-SAAS-001`–`CONSUMER-SAAS-007`, `CONSUMER-SAAS-015`):**
  - *Companion static checks:* `express/security/no-insecure-cookie-options` (`EX-COOKIE-001`), `authjs/session/no-sensitive-in-jwt` (`AUTH-JWT-001`), `supabase/client/no-server-get-session` (`SB-AUTH-002`), and `vibe-proof/security/hardcoded-secret` (`VP-SEC-001`).
- **Tenant & Account Data Scoping (`CONSUMER-SAAS-016`, `CONSUMER-SAAS-017`):**
  - *Companion static checks:* `prisma/writes/no-empty-where-delete` (`PRISMA-DEL-001`), `drizzle/queries/no-unbounded-delete` (`DRZ-DEL-002`), `drizzle/queries/no-unbounded-update` (`DRZ-UPD-002`), and `mongodb/queries/no-empty-deletemany` (`MONGO-DEL-001`).

## Inherent project fitness boundaries (require integration tests, payment sandboxes, or legal review)

- **Account Deletion, Export & Retention (`CONSUMER-SAAS-008`–`CONSUMER-SAAS-014`):**
  - Proving that account deletion cascades across primary tables, search indexes, and third-party processors while honoring billing retention exceptions requires end-to-end integration tests.
- **Webhook Idempotency, Proration & Dunning (`CONSUMER-SAAS-023`–`CONSUMER-SAAS-029`):**
  - Verifying Stripe/payment webhook signature verification, replay idempotency, subscription state transitions, and grace-period access requires behavioral test receipts.
- **Transactional Email Deliverability & Rate Limiting (`CONSUMER-SAAS-018`–`CONSUMER-SAAS-022`, `CONSUMER-SAAS-030`–`CONSUMER-SAAS-034`):**
  - SPF/DKIM/DMARC alignment, bounce suppression, and abuse rate-limiting require environment and integration verification.
- **Terms, Privacy Disclosures & Accessibility (`CONSUMER-SAAS-035`–`CONSUMER-SAAS-039`):**
  - Jurisdiction-specific terms, refund policies, and WCAG accessibility conformance require human review and browser/a11y audit receipts.
