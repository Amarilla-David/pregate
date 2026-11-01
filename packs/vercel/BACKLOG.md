# vercel backlog

Candidates, judgment, and engine boundaries for the Vercel Platform Pack.

The `vercel` pack defines 15 project evidence gates (`VERCEL-001` through `VERCEL-015`) across 6 methodologies:
1. Configuration (`VERCEL-001`, `VERCEL-002`)
2. Environment (`VERCEL-003`, `VERCEL-004`)
3. Protection (`VERCEL-005`, `VERCEL-006`)
4. Cron (`VERCEL-007`, `VERCEL-008`, `VERCEL-009`)
5. Functions (`VERCEL-010`, `VERCEL-011`, `VERCEL-012`)
6. Recovery (`VERCEL-013`, `VERCEL-014`, `VERCEL-015`)

Currently, all 15 requirements are implemented as `primitive: fitness` project verification gates. Below is the technical backlog separating potential static configuration checks from live deployment/infrastructure verification boundaries.

## Static pattern and configuration candidates

- **`VERCEL-001` (Single configuration format):**
  - *Candidate:* Filesystem check ensuring that at most one of `vercel.json` or project setting format is present in the repository root.
  - *Scope:* Root directory inventory.

- **`VERCEL-007` (Cron schedule syntax):**
  - *Candidate:* JSON validation rule over `vercel.json` verifying that all `crons` entries specify valid 5-part cron expressions and path strings beginning with `/`.
  - *Engine capability:* Needs JSON file parsing or structural regex over `vercel.json`.

- **`VERCEL-008` (Cron authorization header in route handlers):**
  - *Candidate:* Static AST pattern over route handlers matching paths defined in `crons` verifying that `request.headers.get("authorization")` or `CRON_SECRET` is checked.
  - *Scope:* `app/api/**/route.ts` or `pages/api/**/*.ts`.

- **`VERCEL-010` (Serverless Function runtime version):**
  - *Candidate:* AST pattern checking `export const runtime = ...` to prevent deprecated or retired runtime specifiers (e.g., legacy Node versions or deprecated Edge runtime flags where Node.js is required).

- **`VERCEL-011` / `VERCEL-012` (Function duration and memory caps):**
  - *Candidate:* Static validation of `export const maxDuration = ...` against Vercel plan limits (Hobby max 60s, Pro max 300s / 900s).

## Inherent platform fitness boundaries (require deployment evidence)

The following requirements require live Vercel infrastructure, production headers, or deployment API receipts and must remain `primitive: fitness`:

- **Environment Encryption & Sensitive Scopes (`VERCEL-003`, `VERCEL-004`):**
  - Verifying that production secrets are not exposed to Preview environments without restricted branch protection requires querying the Vercel API or reviewing project settings receipts.
- **Deployment Protection & SSO/Password Bypass (`VERCEL-005`, `VERCEL-006`):**
  - Verifying that Preview and Production deployments enforce SSO, password protection, or Vercel Authentication cannot be proven from Git source; it requires live deployment response headers or Vercel API verification.
- **Cron Delivery & Operational Idempotency (`VERCEL-009`):**
  - Proving that scheduled tasks tolerate retries and execute idempotently requires service integration receipts.
- **Instant Rollback & Skew Protection (`VERCEL-013`, `VERCEL-014`):**
  - Verifying that database migrations and static assets tolerate rollback to a prior immutable deployment requires architectural review and deployment health check receipts.
- **Health Check Endpoints (`VERCEL-015`):**
  - Confirming the readiness of a `/api/health` endpoint under live traffic requires integration test receipts.
