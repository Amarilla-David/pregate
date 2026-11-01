# firebase backlog

Judgment, rules languages, or checks the TS syntax tree cannot decide. The engine
parses only TS/JS, so everything below needs a new language pack, preset
knowledge, or cross-file flow before it becomes an invariant.

## Rules-language candidates (need a Security Rules pack)

- **Firestore Security Rules.** `allow read/write` expressions, `request.auth != null` guards, per-collection match blocks: the `.rules` language is invisible to this engine.
- **Storage Rules.** `allow read/write` with `request.resource.size` caps and content-type checks: same language gap.
- **Realtime Database rules.** `.read`/`.write`/`.validate` JSON rules: not TS/JS.
- **App Check enforcement.** Whether `onRequest`/`onCall` handlers actually call `requireAppCheck` or verify App Check tokens: server-side policy, not a call shape.
- **FCM token lifecycle.** Token registration, rotation, and unregistration against app installs: flow across client and server, not one statement.
- **Emulator configuration.** Whether tests and development point at the Firestore/Auth/Functions emulators: environment wiring, not syntax.
- **Multi-project aliasing.** `.firebaserc` aliases and per-target deploys (`firebase use`, `firebase deploy --only`): config files outside TS/JS.

## Value and provenance limits (stay warn/manual even in TS)

The closed pattern vocabulary inspects syntax in one file. It cannot evaluate
arbitrary expressions, resolve imported values, or prove interprocedural data flow.

| Rule | Uncaught flow | Missing capability |
| --- | --- | --- |
| FB-READ-001 | `getDocs(buildQuery(col))`, where an imported helper adds `limit`. | Cross-file return-value analysis. |
| FB-WRITE-001 | `setDoc(ref, data, opts)`, where `opts` is an imported `{ merge: true }`. Only the `merge` word exempts; `mergeFields` alone still fails. | Imported-value evaluation; a data field literally named `merge*` also exempts the call. |
| FB-QUERY-001 | `doc(db, joinPath("orders", id))`, where a helper joins segments. | Call-graph return analysis. |
| FB-BATCH-001 | Batch committed in a later statement (documented trap: fails closed). | Multi-statement flow. |
| FB-ADMIN-001 | `firebase-admin` imported in files outside the client globs but still bundled for web (custom bundler roots). | Bundler entry-point knowledge; extend `files` in the preset. |
| FB-AUTH-001 | `const u = auth.currentUser; use(u.uid)` without a null check between the lines. | Null-flow across statements. |
| FB-FUNCTION-001 | `cors` applied by a wrapping framework or in an outer middleware file. | Cross-file middleware provenance. |
| FB-STORAGE-001 | `list(ref, { maxResults: hugeNumber })`, a bounded call with an absurd page. | Numeric policy; needs the preset to name the cap. |

## Deliberate non-rules

- **`apiKey` in code is NOT flagged.** Firebase API keys are public identifiers, not secrets. Flagging them would be wrong; real secrets (private keys, service-account JSON, `FIREBASE_*_SECRET` env names) stay covered by the vibe-proof client-secret rules.
- **`measurementId`/analytics IDs are NOT flagged.** Same reason: identifiers, not credentials.
- **Cross-function app initialization guards (`FB-INIT-001` limit).** `FB-INIT-001` verifies that a function calling `initializeApp()` also references `getApps()` or `getApp()`. If the guard lives in a caller function that delegates to an internal `init()` helper, single-function syntax inspection cannot see the outer guard.
- **Helper-wrapped transaction reads (`FB-TX-ORDER-001` limit).** `FB-TX-ORDER-001` catches `tx.get()` statements that follow `tx.set/update/delete()` in the same `runTransaction` block. Reads delegated to a helper function called after a write require interprocedural ordering analysis.
