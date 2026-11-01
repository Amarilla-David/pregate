# presets backlog

Scope, calibration boundaries, and non-goals for `packs/presets/` and `catalog/presets/`.

Presets (`packs/presets/*.json` and `catalog/presets/*.json`) are declarative contract recipes (`schema/preset.v1.json`), not rule packs. They compose bundled or local sources, select methodologies, declare `resolve` winners for shared dimensions, and set initial `enforcement` (`shadow` or `enforce`) and `overrides`.

## What presets can and cannot decide

- **Layer topology is project-specific (`layers` and `compositionRoots`):**
  - Starter presets (`hexagonal-backend`, `backend-clean-ddd`, `python-starter`, `go-starter`, `rust-starter`, `mixed-starter`) provide representative directory globs (`src/domain/**`, `src/application/**`, `src/adapters/**`). Consuming repositories must align `layers` and `compositionRoots` with their actual directory layout via `pregate guide --preview` or `pregate scan --plan`.
- **Shadow calibration before blocking enforcement:**
  - Language and framework starters (`react-spa`, `nextjs-fullstack`, `node-api`, `vue-spa`, `python-starter`, `go-starter`, `rust-starter`, `mixed-starter`) default to `"enforcement": "shadow"` for optional rules while builtin `core/pregate-integrity` and `core/software-invariants` remain enforced. Promoting advisory or shadow rules to `enforce` requires auditing existing findings in the target repository (`pregate audit`).
- **Project fitness bindings are never pre-populated by a preset:**
  - Core software invariants (`CORE-INV-001`–`CORE-INV-064`) and optional readiness packs (`enterprise-ready`, `consumer-saas`, `next-website`, `vercel`, `agent-practices`, `design-invariants`) require repository-specific test commands and `verificationHash` receipts bound via `pregate fitness bind`. A preset recipe cannot supply another repository's test commands or hashes.
- **Cross-stack preset combinations:**
  - Additional stack combinations (for example `sveltekit + drizzle`, `nestjs + prisma`, `nuxt + supabase`, or `angular + firebase`) are composed on demand by `pregate scan --plan` and `pregate guide --preview` from `package.json` dependencies rather than multiplying static preset files for every permutation.
