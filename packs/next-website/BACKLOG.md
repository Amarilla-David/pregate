# next-website backlog

Candidates, judgment, and engine boundaries for the Next.js Website Readiness Pack.

The `next-website` pack defines 54 project evidence gates (`NEXT-WEBSITE-001` through `NEXT-WEBSITE-054`) across 8 categories:
1. Rendering (`requirement-001` to `requirement-007`)
2. Server and Client Boundary (`requirement-008` to `requirement-015`)
3. Data and Cache (`requirement-016` to `requirement-023`)
4. Routing and Errors (`requirement-024` to `requirement-029`)
5. Security (`requirement-030` to `requirement-038`)
6. Metadata (`requirement-039` to `requirement-043`)
7. Assets and Performance (`requirement-044` to `requirement-048`)
8. Build and Access (`requirement-049` to `requirement-054`)

Currently, all 54 requirements are verified as `primitive: fitness` project evidence gates. Below is the technical backlog categorizing candidate migrations to static AST pattern rules versus inherent runtime/deployment boundaries.

## Static pattern candidates (admissible with single-file TSX AST)

- **`NEXT-WEBSITE-007` (Rules of Hooks in Next.js App Router):**
  - *Candidate:* Compose with `react/hooks/no-conditional-hook` and `react/hooks/no-async-effect`.
  - *Scope:* Top-level execution of Hooks inside App Router client components (`"use client"`).
  - *Static limitation:* Telling whether a helper function without JSX is a custom Hook depends on the `use*` naming convention.

- **`NEXT-WEBSITE-024` (Route Handlers and Pages segment conflict):**
  - *Candidate:* Placement/file-system invariant preventing `page.tsx` and `route.ts` from occupying the exact same route directory.
  - *Scope:* Directory structure analysis across `app/**`.

- **`NEXT-WEBSITE-028` (No raw `<a>` tags in place of `next/link`):**
  - *Candidate:* Direct equivalence with `nextjs/routing/no-anchor-navigation`. Can be surfaced as an AST pattern check matching `jsx_element` with `<a href="...">` instead of `<Link href="...">`.

- **`NEXT-WEBSITE-039` (Metadata export validity):**
  - *Candidate:* Direct static check ensuring `metadata` or `generateMetadata` are only exported from Server Components (pages or layouts), never from Client Components (`nextjs/rendering/no-client-metadata-export`).

- **`NEXT-WEBSITE-044` (Modern image optimization):**
  - *Candidate:* Direct static check ensuring `<img>` elements are not used for content images, composing with `nextjs/rendering/no-img-element`.

## Inherent project fitness boundaries (require build, runtime, or browser evidence)

The following requirements require runtime execution, deployment verification, external services, or bundler output, and must remain `primitive: fitness`:

- **Transitive Client Leakage (`NEXT-WEBSITE-008` to `NEXT-WEBSITE-012`):**
  - Proving that server-only modules, database secrets, or backend utilities do not leak into the client JS bundle requires inspecting bundler output (`.next/static/chunks`), not just the immediate file imports.
- **Cache Invalidation & Request Caching (`NEXT-WEBSITE-016` to `NEXT-WEBSITE-023`):**
  - Testing that writes invalidate tags (`revalidateTag`) or paths (`revalidatePath`) and that dynamic requests stream behind Suspense requires live integration tests or build-time simulation.
- **Authentication & Authorization Gating (`NEXT-WEBSITE-030` to `NEXT-WEBSITE-034`):**
  - Verifying that every Server Action and Route Handler authenticates and authorizes the caller independently of UI gates requires integration test receipts.
- **Core Web Vitals & Performance Budgets (`NEXT-WEBSITE-045` to `NEXT-WEBSITE-048`):**
  - Measuring Largest Contentful Paint (LCP), Cumulative Layout Shift (CLS), and font display performance requires synthetic browser measurement (Lighthouse, Playwright, Chrome DevTools).
- **Deployment Protection & TLS (`NEXT-WEBSITE-049` to `NEXT-WEBSITE-054`):**
  - Security headers (CSP, HSTS, X-Frame-Options), TLS configuration, and production build artifact immutability require deployment verification receipts.
