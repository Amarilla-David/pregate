# node pack

Data-only PREGATE rules for Node.js server code. Every check is a tree-sitter
pattern (`impl.kind: "pattern"`, `patterns.typescript` only). No executables,
no heuristics: a match is a violation.

Stance: the event loop stays unblocked, the process boundary stays owned by
the entry point, builtin imports are unambiguous, and legacy or eval-like APIs
stay out of new code.

## Rules

| ID | Forbids | Why | Severity |
|----|---------|-----|----------|
| `node/io/no-sync-io` | Blocking `*Sync` calls | A sync call stops every request on that process | deny |
| `node/process/no-process-exit` | Calling `process.exit()` | A library that exits kills its host without cleanup | deny |
| `node/process/no-env-assign` | Assigning `process.env.X` | A write leaks across modules and tests | deny |
| `node/modules/prefer-node-prefix` | Bare builtin imports without `node:` | A bare specifier can resolve to a package instead | deny |
| `node/security/no-exec-sync` | Sync subprocess calls | Sync calls freeze the process; shell strings inject | deny |
| `node/io/no-buffer-ctor` | `new Buffer()` | A size argument can expose uninitialized memory | deny |
| `node/security/no-vm-run` | `vm.runIn*` / `vm.compileFunction` | The vm module is not a sandbox | deny |
| `node/api/no-url-parse` | Legacy `url.parse()` | The frozen parser differs from the standard URL | deny |
| `node/modules/no-process-binding` | `process.binding()` | Internal bindings are unstable | deny |
| `node/process/no-uncaught-exception-empty` | Empty `uncaughtException` handlers | They suppress the default crash without recovery | deny |
| `node/security/no-tls-reject-unauthorized-false` | `rejectUnauthorized: false` | It disables peer certificate verification | deny |
| `node/security/no-shell-true` | Shell-enabled `spawn`/`execFile` | The shell interprets arguments as commands | deny |
| `node/modules/no-module-compile` | `module._compile` / `require.extensions` | Loader internals have unstable contracts | deny |
| `node/security/no-exec-interpolation` | `exec` with a template or concatenated command string | The shell parses the spliced value as commands | deny |
| `node/security/no-create-cipher` | `crypto.createCipher` / `createDecipher` | Removed in Node.js 22; weak key derivation | deny |

## Methodologies

- `node/runtime` — NODE-SYNC-001, NODE-EXIT-001, NODE-ENV-001, NODE-PREFIX-001, NODE-BUF-001, NODE-URL-001
- `node/security` — NODE-EXEC-001, NODE-VM-001, NODE-EXEC-002, NODE-CIPHER-001
- `node/internals` — NODE-BIND-001, NODE-UNCAUGHT-001, NODE-TLS-001, NODE-SHELL-001, NODE-COMPILE-001

<!-- BEGIN generated reference -->

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

## Exact rule contract

Category: **library**. Version: `1.2.1`. 16 distinct check IDs.

Methodologies: `node/internals` (complete), `node/runtime` (complete), `node/security` (complete).

[Every rule's severity, defaults, provenance, repair guidance and limits](REFERENCE.md). The reviewed preset determines effective policy; these defaults are not a claim of complete framework compliance.
<!-- END generated reference -->
