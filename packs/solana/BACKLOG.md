# solana backlog

Judgment, Rust programs, or checks the TS syntax tree cannot decide. Most need the
Rust language pack first; the rest need preset knowledge (allowlists, cluster, budget).

## Value and provenance limits

The closed pattern vocabulary inspects syntax in one file. It cannot evaluate
arbitrary expressions, resolve imported values, or prove interprocedural data flow.
The following plausible evasions therefore keep these rules at **warn** by default.
They are backlog cases, not pass fixtures or claimed trap coverage.

| Rule | Uncaught flow | Missing capability |
| --- | --- | --- |
| SOL-RPC-001 | `createSolanaRpc(getRpcUrl(profile))`, where an imported configuration helper returns a public host. | Constant evaluation and configuration provenance. |
| SOL-RPC-002 | `selectCluster(profile)`, where an imported helper selects mainnet. | Value propagation and cluster policy. |
| SOL-TX-001 | An imported `version` is a computed string used as `maxSupportedTransactionVersion`. | Imported-value evaluation or type information. |
| SOL-TX-002 | `import { verify } from "./rpc"; verify(sig)`, where the module exports a bound `confirmTransaction` method. | Cross-file method binding and argument flow. |
| SOL-SEC-001 | `Keypair.fromSecretKey(chooseKey(process.env.PROFILE))`, where the imported selector returns committed bytes. | An environment read does not prove the returned bytes came from it. |
| SOL-SEC-002 | `report(wallet.secretKey)`, where `report(payload)` calls `console.log(payload)`. | Parameter taint and wrapper call graphs; a sensitive-looking label alone also does not prove a leak. |
| SOL-SEC-003 | `save(localStorage, wallet.secretKey)`, where `save(store, payload)` calls `store.setItem("session", payload)`. | Receiver aliases and sensitive-value taint through parameters. |

Current coverage catches explicit literals, supported concatenations/templates and
literal array joins, same-block const aliases, renamed/destructured/bound confirm
methods, and visible computed version strings. Alias matching stops at the nearest
block to avoid treating a shadowed parameter as the outer console or storage alias.
This does not prove wrapper behavior, key custody, blockhash freshness, or devnet use.
Computed module loaders also fall outside the kit rules' literal-import contract;
use the core dynamic-loader invariant in configured layers when that matters.

## Program and product rules

- **Anchor account validation.** `Account<'info, T>`, `Signer<'info>`, `has_one`/`constraint`, seeds + canonical bump, distinct PDA prefixes: all Rust, invisible to this engine.
- **init/close discipline.** Explicit payer + space, `close = destination`, no manual closes, `realloc::zero`: Rust-side.
- **Checked arithmetic.** `checked_*`, `overflow-checks = true`, multiply-before-divide, `try_from` casts: needs Rust arithmetic facts, not TS shapes.
- **CPI safety.** `reload()` after modifying CPIs, verified program addresses, duplicate-mutable checks, hand-validated `remaining_accounts`: cross-instruction Rust flow.
- **No unsafe / no unwrap.** Rust-only lints; TS has no equivalent shape here.
- **Oracle policy.** Allowlisted feed + program ID per cluster, `max_age` staleness, confidence-interval caps, exponent normalisation: needs the preset to name the feeds first.
- **Token identity.** Mint + token program per cluster, Token-2022 extension allowlist: needs the preset's mint registry; symbol comparison alone is too weak to ban.
- **Slippage / expected_price.** A threshold without the trade's size and venue is a guess, not an invariant.
- **Codama codegen.** "Do not hand-write clients" is only decidable with the repo's generated-client path declared; until then it is review judgment.
- **Simulate-before-send and fee-payer display.** Presence of a simulate call does not prove it gated the send; product flow, not syntax.
- **Kit import rules, next versioned revision.** SOL-KIT-003 (v1.1.0) now matches both `@coral-xyz/anchor` and `@project-serum/anchor`; SOL-KIT-001 to 003 still match any package-name string inside an `export` declaration (an exported map keyed by the package name), not only the module source. SOL-KIT-004 restricts the match to the import/export source and `import()`/`require()` arguments; the older checks should follow when their version is bumped. solana.com now also documents a class-based `@solana/web3.js` v3, which a blanket SOL-KIT-001 ban would misfire on.
- **Demo discipline.** Public RPC, mainnet deploys, own-token issuance, personal data onchain: partly covered (SOL-RPC-001/002); the rest is human process.
- **PDA bump provenance (`SOL-PDA-001` limit).** `SOL-PDA-001` warns on `createProgramAddress` and `createProgramAddressSync`. When a program intentionally caches a verified canonical bump seed off-chain and passes it into `createProgramAddressSync`, syntax alone cannot verify that the seed came from a prior `findProgramAddressSync` call.
