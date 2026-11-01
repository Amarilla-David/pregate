# rust backlog (candidates — never warn without proof)

These Rust topics are not decidable as single-file AST patterns without borrow checker facts, cargo target configuration, or domain performance requirements.

- **Unsafe block justification.** Every `unsafe` block should have a `// SAFETY:` comment explaining the invariant. However, assessing whether the safety explanation is sound requires formal verification, not syntax matching.
- **unwrap() and expect() in application code.** In libraries, `unwrap()` panics and is discouraged; in CLI applications, tests, or proved invariant conditions (e.g., regex compilation of a hardcoded constant), `expect()` is idiomatic. Distinguishing target types needs Cargo profile context.
- **Unnecessary clone().** Calling `.clone()` can be an intentional defensive copy, an atomic reference bump (`Arc::clone`), or inefficient allocation. Deciding whether a reference would suffice requires borrow-checker lifetimes.
- **Box<dyn Error> vs concrete error types.** Dynamic error objects are standard in `main()` and CLI applications, while libraries should expose enum error types. Determining module role requires architecture layer context.
- **Async trait lifetime ergonomics.** Static AST cannot determine if a trait method returning a `Future` outlives its captured references without compiler type diagnostics.
