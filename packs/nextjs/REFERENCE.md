# nextjs pack reference

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

Version: `1.2.0`. Category: **library**.

These are manifest defaults. All core rules activate automatically and enforce unless explicitly disabled in the reviewed preset. Optional packs activate only when selected. `pregate preset show` gives the effective contract. A manifest's `complete` label refers to that manifest, not full library or methodology compliance.

## nextjs/rendering

Manifest version: `1.1.0`. Status: **complete**.

### nextjs/NEXT-HEAD-001

Check: [`nextjs/rendering/no-next-head-import@1.0.1`](checks/rendering/no-next-head-import/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nextjs.no-next-head-import`. Minimum severity: `none`.

next/head belongs to the Pages Router and is valid there; in app/ files the metadata export owns the document head.

Default parameters: `{}`.

**Repair:** Export a metadata object from the page or layout. Keep next/head only in files that still run under the Pages Router.

**Scope and limits:** Only the exact next/head literal in an import/export source or first literal require/import argument is forbidden in app paths. next/headers, ordinary text and import option values are allowed. Computed specifiers and aliased runtime loaders are outside this syntax slice.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Next.js App Router migration guide",
  "locator": "next/head versus metadata API",
  "paraphrase": "The App Router declares head data with the metadata export. next/head is the Pages Router component and does not run under app."
}
```

### nextjs/NEXT-IMG-001

Check: [`nextjs/rendering/no-img-element@1.0.0`](checks/rendering/no-img-element/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nextjs.no-img-element`. Minimum severity: `none`.

A raw img skips resizing and lazy loading, shipping full-weight files and causing layout shift the Image component prevents.

Default parameters: `{}`.

**Repair:** Replace the element with Image from next/image and give it a width, height, or fill plus an alt description.

**Scope and limits:** An img assembled outside the returned expression (a variable, an array, a prop default) sits outside the returned text this rule reads. The open-plus-close pair is still an img.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Next.js image optimization docs",
  "locator": "next/image responsive sizing",
  "paraphrase": "Images go through the Image component so the framework can resize, lazy-load, and serve modern formats per viewport."
}
```

### nextjs/NEXT-FONT-001

Check: [`nextjs/rendering/no-google-font-link@1.0.0`](checks/rendering/no-google-font-link/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nextjs.no-google-font-link`. Minimum severity: `none`.

A googleapis link tag moves font loading back to a render-blocking remote request, undoing the self-hosting and shift guarantees.

Default parameters: `{}`.

**Repair:** Load the family with next/font and apply the generated class name or variable. Remove the link tag entirely.

**Scope and limits:** Preconnecting to the font host while keeping the stylesheet link still loads the font remotely.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Next.js font optimization docs",
  "locator": "next/font self-hosting",
  "paraphrase": "Fonts load through next/font so builds self-host the files. Remote stylesheet links reintroduce render-blocking requests and layout shift."
}
```

### nextjs/NEXT-CACHE-001

Check: [`nextjs/data/no-fetch-without-cache@1.0.0`](checks/data/no-fetch-without-cache/check.json). Default severity: **off**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nextjs.no-fetch-without-cache`. Minimum severity: `none`.

The default is a legitimate choice, so missing cache options cannot be a universal violation.

Default parameters: `{}`.

**Repair:** Pass cache or next.revalidate in the fetch options. Choose force-cache, no-store, or an interval on purpose.

**Scope and limits:** Passing an empty options object or an unrelated option like signal does not declare a cache policy.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Next.js data fetching docs, caching and revalidating",
  "locator": "fetch cache and next.revalidate options",
  "paraphrase": "A fetch without cache options uses the documented default auto no cache behavior; explicit options are optional."
}
```

### nextjs/NEXT-CONFLICT-001

Check: [`nextjs/data/no-conflicting-fetch-cache@1.0.0`](checks/data/no-conflicting-fetch-cache/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nextjs.conflicting-fetch-cache`. Minimum severity: `none`.

The developer requested incompatible cache lifetimes, so neither option governs the fetch as expected.

Default parameters: `{}`.

**Repair:** Keep cache: 'no-store' for uncached responses, or remove it and set next.revalidate to a positive interval.

**Scope and limits:** Swapping the order of the options does not change their conflict. An unrelated body object is not the fetch options object.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Next.js App Router API reference, fetch",
  "locator": "options.next.revalidate and options.cache",
  "paraphrase": "Conflicting cache options such as no-store together with a positive revalidation interval are both ignored."
}
```

### nextjs/NEXT-DIRECTIVE-001

Check: [`nextjs/rendering/no-misplaced-directive@1.0.0`](checks/rendering/no-misplaced-directive/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nextjs.no-misplaced-directive`. Minimum severity: `none`.

A directive anywhere else is an ordinary string. The file silently stays a Server Component, or the function never becomes a Server Action, and hooks or browser APIs then fail at build or run time.

Default parameters: `{}`.

**Repair:** Move the directive to the first line of the file, above every import, in single or double quotes. For an inline Server Action, put 'use server' as the first statement of the async function body.

**Scope and limits:** Comments and other quoted string statements before the directive are not flagged. 'use server' as the first statement of a function body is allowed. Strings that merely contain the words, in variables or JSX, are not directives and are not flagged.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Next.js API reference, use client, https://nextjs.org/docs/app/api-reference/directives/use-client; React reference, use server, https://react.dev/reference/rsc/use-server",
  "locator": "use client usage; use server caveats",
  "paraphrase": "'use client' goes at the top of the file, before imports, and cannot be placed inside a function. 'use server' must be at the very beginning of its file or function, above other code (comments are fine), in single or double quotes, not backticks."
}
```

### nextjs/NEXT-META-001

Check: [`nextjs/rendering/no-client-metadata-export@1.0.0`](checks/rendering/no-client-metadata-export/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nextjs.no-client-metadata-export`. Minimum severity: `none`.

Next.js rejects a metadata export from a 'use client' page or layout at build time, so the page loses its title and description or the build fails.

Default parameters: `{}`.

**Repair:** Remove 'use client' from the page or layout and move the interactive part into a child client component. Keep metadata or generateMetadata on the server file.

**Scope and limits:** Only exported metadata or generateMetadata in page and layout files under app/ or src/app/ whose leading directive is 'use client' are flagged, including export { x as metadata }. A local metadata constant that is not exported, and server files that mention the directive in a comment, are allowed.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Next.js API reference, generateMetadata, https://nextjs.org/docs/app/api-reference/functions/generate-metadata",
  "locator": "Metadata object and generateMetadata function, good to know",
  "paraphrase": "The metadata object and generateMetadata function exports are only supported in Server Components."
}
```

### nextjs/NEXT-ASYNC-001

Check: [`nextjs/data/no-sync-request-api@1.0.0`](checks/data/no-sync-request-api/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nextjs.no-sync-request-api`. Minimum severity: `none`.

On Next.js 16 the call returns a Promise, so .get or .isEnabled reads undefined or throws; on 15 it logs a deprecation warning on every request.

Default parameters: `{}`.

**Repair:** Await the call first, for example const store = await cookies(); store.get('theme'). In a component that cannot be async, unwrap the Promise with React's use().

**Scope and limits:** Only a member read directly on cookies(), headers() or draftMode() imported from next/headers, including renamed imports, is flagged. Awaited calls, use(...), .then/.catch/.finally and same-named functions from other modules pass. A result stored in a variable first is not traced. Warn only: Next.js 14 projects use the synchronous API correctly.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Next.js API reference, cookies, https://nextjs.org/docs/app/api-reference/functions/cookies; Next.js 16 upgrade guide, https://nextjs.org/docs/app/guides/upgrading/version-16",
  "locator": "cookies good to know; Async Request APIs (breaking change)",
  "paraphrase": "cookies, headers and draftMode are async and must be awaited or unwrapped with React's use. Next.js 15 kept temporary synchronous access with a warning; Next.js 16 removes it."
}
```

## nextjs/routing

Manifest version: `1.2.0`. Status: **complete**.

### nextjs/NEXT-LINK-001

Check: [`nextjs/routing/no-anchor-navigation@1.0.1`](checks/routing/no-anchor-navigation/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nextjs.no-anchor-navigation`. Minimum severity: `none`.

A plain anchor to an internal route forces a full document reload and skips prefetching, losing the client-side navigation the router exists for.

Default parameters: `{}`.

**Repair:** Replace the anchor with Link from next/link. Keep anchors for external URLs only.

**Scope and limits:** This advisory policy checks actual anchor nodes with literal root-relative href attributes, including expression-wrapped strings, anywhere in JSX. It ignores CMS HTML strings, unrelated attributes, external and protocol-relative URLs. Full reloads and downloads can be intentional; do not promote this suggestion without the project's navigation contract.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Next.js App Router docs, linking and navigating",
  "locator": "next/link client-side transitions",
  "paraphrase": "Internal navigation uses the Link component so the router can prefetch and transition client-side instead of reloading the page."
}
```

### nextjs/NEXT-DOC-001

Check: [`nextjs/routing/no-next-document-in-app@1.0.0`](checks/routing/no-next-document-in-app/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nextjs.no-next-document-in-app`. Minimum severity: `none`.

A Document import inside app/ silently does nothing while suggesting the Pages Router still controls the shell, so document changes never apply.

Default parameters: `{}`.

**Repair:** Move document-level markup into the app root layout and declare head data with the metadata export.

**Scope and limits:** Re-exporting next/document from a shared module so app files keep importing it indirectly.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Next.js App Router migration guide",
  "locator": "pages _document versus app root layout",
  "paraphrase": "The App Router owns the document through the root layout. next/document belongs to the Pages Router and has no effect under app."
}
```

### nextjs/NEXT-ROUTE-001

Check: [`nextjs/routing/no-router-push-concat@1.0.1`](checks/routing/no-router-push-concat/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nextjs.no-router-push-concat`. Minimum severity: `none`.

This optional readability policy observes concatenated destinations on recognized Next routers. Valid href strings remain valid; the syntax does not prove an unsafe destination or a typed-route failure.

Default parameters: `{}`.

**Repair:** Use a template or the project's tested route helper when this improves clarity. Validate untrusted destinations under the project's routing contract; interpolation alone is not a security fix.

**Scope and limits:** Checks cover imported Router and directly imported useRouter calls or same-block const receivers. Array.push, arbitrary injected push methods, indirect aliases, cross-scope bindings and dynamic receiver ownership are not inferred. Keep project routing safety in a reviewed assertion rather than enforcing a preferred spelling.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Next.js App Router docs, programmatic navigation",
  "locator": "typed route hrefs",
  "paraphrase": "Next routers accept href strings. A template or route helper can make the destination easier to read; concatenation alone is not a correctness violation."
}
```

### nextjs/NEXT-REVAL-001

Check: [`nextjs/data/no-revalidate-false@1.0.0`](checks/data/no-revalidate-false/check.json). Default severity: **off**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nextjs.no-revalidate-false`. Minimum severity: `none`.

The syntax does not reveal the intended cache lifetime, so an unconditional block is unjustified.

Default parameters: `{}`.

**Repair:** Set an explicit interval in seconds, or declare the segment dynamic on purpose instead of disabling revalidation.

**Scope and limits:** A comment next to false does not make the opt-out explicit. Name the caching intent in code.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Next.js data fetching docs, time-based revalidation",
  "locator": "revalidate segment option",
  "paraphrase": "A false revalidation value is an explicit supported choice for an indefinitely cached resource; it does not by itself prove an error."
}
```

### nextjs/NEXT-NAV-001

Check: [`nextjs/routing/no-pages-router-in-app@1.0.0`](checks/routing/no-pages-router-in-app/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nextjs.no-pages-router-in-app`. Minimum severity: `none`.

next/router needs the Pages Router context, which app/ does not provide, so the component throws when it renders.

Default parameters: `{}`.

**Repair:** Import useRouter from next/navigation. Read the path with usePathname and the query with useSearchParams. Shared components that must run under both routers can use next/compat/router.

**Scope and limits:** Only the exact next/router literal in a value import, re-export, require or import() inside app/ or src/app/ is flagged. Type-only imports, next/compat/router, next/navigation and files under pages/ are allowed. Components outside app/ that the App Router renders are not traced.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Next.js App Router API reference, useRouter, https://nextjs.org/docs/app/api-reference/functions/use-router",
  "locator": "useRouter; error page next-router-not-mounted",
  "paraphrase": "In the App Router, useRouter must come from next/navigation, not next/router. Using the Pages Router hook under app throws 'NextRouter was not mounted'."
}
```

### nextjs/NEXT-SERVER-EXPORT-001

Check: [`nextjs/routing/no-export-in-client-component@1.0.0`](checks/routing/no-export-in-client-component/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nextjs.server-exports-in-client`. Minimum severity: `none`.

Exporting server route segment options or generateStaticParams from a file marked 'use client' either fails the Next.js build or is silently ignored.

Default parameters: `{}`.

**Repair:** Keep the route segment config and generateStaticParams in the Server Component page or layout, and move interactive UI into a child Client Component.

**Scope and limits:** Direct variable exports, function exports, and export list specifiers for dynamic, revalidate, runtime, preferredRegion, maxDuration, and generateStaticParams in 'use client' files are matched. Local unexported variables pass.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Next.js App Router documentation, Route Segment Config (https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config)",
  "locator": "Route Segment Config options and Server Components",
  "paraphrase": "Route segment configuration exports (dynamic, revalidate, runtime, preferredRegion, maxDuration) and generateStaticParams only apply in Server Components and cannot be exported from a Client Component."
}
```
