# enterprise-ready backlog

Candidates, companion static rules, and engine boundaries for the `enterprise-ready` pack.

The `enterprise-ready` pack defines 57 project evidence gates (`ENTERPRISE-READY-001` through `ENTERPRISE-READY-057`) in `enterprise-ready/readiness`, covering:
1. Product Assortment & Multi-Tenancy (`ENTERPRISE-READY-001`–`ENTERPRISE-READY-006`)
2. Role-Based Access Control & Authorization (`ENTERPRISE-READY-007`–`ENTERPRISE-READY-012`)
3. Enterprise Authentication, SSO & SAML/OIDC (`ENTERPRISE-READY-013`–`ENTERPRISE-READY-019`)
4. Directory Sync & SCIM Provisioning (`ENTERPRISE-READY-020`–`ENTERPRISE-READY-025`)
5. Audit Logging & Tamper Evidence (`ENTERPRISE-READY-026`–`ENTERPRISE-READY-032`)
6. Reporting, Search & Data Exports (`ENTERPRISE-READY-033`–`ENTERPRISE-READY-037`)
7. Deployment, Change Management & Rollback (`ENTERPRISE-READY-038`–`ENTERPRISE-READY-043`)
8. Team Collaboration, Integrations & Webhooks (`ENTERPRISE-READY-044`–`ENTERPRISE-READY-049`)
9. Security, Encryption & GDPR/Compliance (`ENTERPRISE-READY-050`–`ENTERPRISE-READY-057`)

All 57 requirements are evaluated as `primitive: fitness` project verification gates. Below is the technical backlog separating composable static checks from runtime, infrastructure, and integration verification boundaries.

## Composable static slices in companion packs

- **Tenant Isolation & Unbounded Write Guards (`ENTERPRISE-READY-003`, `ENTERPRISE-READY-004`):**
  - *Companion static checks:* `prisma/writes/no-empty-where-delete` (`PRISMA-DEL-001`), `drizzle/queries/no-unbounded-delete` (`DRZ-DEL-002`), `drizzle/queries/no-unbounded-update` (`DRZ-UPD-002`), `drizzle/queries/limit-select` (`DRZ-LIM-001`), and `mongodb/queries/no-empty-deletemany` (`MONGO-DEL-001`).
- **Transport, Cookie & Secret Hardening (`ENTERPRISE-READY-013`, `ENTERPRISE-READY-050`–`ENTERPRISE-READY-054`):**
  - *Companion static checks:* `vibe-proof/security/hardcoded-secret` (`VP-SEC-001`), `vibe-proof/security/no-http-url` (`VP-TLS-001`), `express/security/no-insecure-cookie-options` (`EX-COOKIE-001`), and `authjs/session/no-sensitive-in-jwt` (`AUTH-JWT-001`).

## Inherent project fitness boundaries

- **SAML/OIDC Federation & SCIM Deprovisioning (`ENTERPRISE-READY-013`–`ENTERPRISE-READY-025`):**
  - Validating IdP-initiated/SP-initiated flows, signature verification against tenant metadata, and immediate session revocation on SCIM user deactivation requires integration tests.
- **Immutable Audit Logs (`ENTERPRISE-READY-026`–`ENTERPRISE-READY-032`):**
  - Proving that every privileged actor/action/resource/outcome is recorded to append-only storage with retention guarantees requires runtime contract tests.
- **Zero-Downtime Migrations & Rollback (`ENTERPRISE-READY-038`–`ENTERPRISE-READY-043`):**
  - Backward-compatible expand/contract schema migrations and release rollback procedures require CI/CD and database migration verifiers.
