# python backlog (candidates — never warn without proof)

These Python topics are not decidable as single-file static AST patterns without full type information, runtime environment context, or project architectural intent. They stay here as candidates and MUST NOT become warn-level checks without a decidable shape plus fixtures.

- **Type annotation coverage.** Verifying complete PEP 484 type coverage across modules requires the runtime mypy/pyright checker to resolve imported symbols and third-party stubs. The AST alone cannot differentiate untyped dynamic duck typing from omission.
- **Global mutable state.** `global VAR` reassignment can be deliberate in module initializers, caches, or CLI scripts. Differentiating a thread-unsafe race from safe initialization requires knowing the concurrency model.
- **Catching Exception vs BaseException.** Catching `Exception` is often the intended idiom at process or thread boundaries (to avoid catching `KeyboardInterrupt` and `SystemExit`), but inside libraries it can mask domain bugs. Deciding intent requires domain context.
- **Logging vs printing.** Calling `print()` in simple CLI scripts is normal; in libraries it bypasses log levels. Without knowing whether a module is a CLI entry point or an internal library layer, a syntax pattern is insufficient.
- **Context manager usage for open().** Using `open()` without `with` can be safe if closed in a `try..finally` or passed to a wrapper that takes ownership of the file descriptor. Verifying file closure requires data flow analysis.
- **Starlette / FastAPI async vs sync route handling.** Calling blocking I/O functions in an `async def` endpoint freezes the asyncio event loop, whereas in a `def` endpoint FastAPI runs it on an external thread pool. Determining whether an invoked function performs blocking I/O requires whole-call-graph inspection.
