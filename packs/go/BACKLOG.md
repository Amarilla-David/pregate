# go backlog (candidates — never warn without proof)

These Go topics cannot be decided from local single-file syntax without cross-package type information, concurrency models, or project-specific architecture contracts. They stay here as candidates.

- **Goroutine leaks.** Spawning `go worker()` without waiting on a `sync.WaitGroup`, channel, or context is standard for background daemons, but leaks memory in short-lived requests. Distinguishing permanent daemons from leaked tasks requires lifetime context.
- **Mutex lock/unlock pairing.** Verifying that every `mu.Lock()` has a corresponding `defer mu.Unlock()` or explicit path unlock requires CFG analysis across early returns and error exits.
- **Interface pollution.** Go best practices recommend accepting interfaces and returning structs. Verifying whether a 1-method interface is premature abstraction or a necessary dependency port requires multi-package usage analysis.
- **Shadowed variables with `:=`.** The `:=` operator can silently shadow an outer variable (e.g. `err := ...` inside an if block). Deciding whether shadowing is intentional scoping or a bug requires scope and data-flow awareness.
- **Error check immediately after call.** In Go, checking `if err != nil` immediately is idiomatic, but returning `nil, err` or wrapping `fmt.Errorf("%w", err)` varies by domain layer.
