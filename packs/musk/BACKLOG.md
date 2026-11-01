# musk backlog

Heuristics and practices from Elon Musk's 5-step engineering algorithm that cannot be decided deterministically from an isolated AST syntax tree:

- **10% Deletion Target Rate**: The rule that "if you are not adding things back 10% of the time, you are not deleting enough" requires temporal repository telemetry across git commit history and PR reverts, rather than a single file snapshot.
- **Questioning the Requirement Originator**: Verifying whether a requirement makes sense or should be challenged requires human dialogue between engineers and stakeholders.
- **Validating Whether a Subsystem Should Exist**: The fatal error of "optimizing a thing that should not exist" at the macro scale (e.g. building an elaborate caching layer for a report that nobody reads) is a product and business domain judgment.
- **Cycle Time Profiling & Wall-Clock Measurement**: Profiling execution bottlenecks, slow build steps, cold starts, and database query latency requires runtime telemetry, APM traces, and benchmarking rather than static AST inspection.
- **Continuous Integration Pipeline Automation**: Measuring test coverage completeness, pipeline flakiness, and CD deployment automation belongs to deployment infrastructure and workflow definitions.
