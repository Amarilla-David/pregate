# senior backlog

Not binary, or winnable by a rename. Left out on purpose.

- **Deep modules as a feeling.** "This module is shallow" needs a reader. The pack only caps public method count at 8. A class that hides nine operations behind private methods still has a small public surface and can be shallow for a bad reason. The avoid text on SR-WIDE-001 says so.
- **Magic numbers.** Which number is a domain constant and which is a coincidence depends on the glossary. `0` and `1` are often legitimate.
- **prefer-const.** Deciding that a `let` is never reassigned needs data flow past closures. A syntax ban on `let` would forbid real mutation.
- **Naming.** A good name is a reading. The engine has no glossary of the repository.
- **DRY and shotgun surgery.** Duplication is a judgment about whether two copies change together. Identical tokens are often a coincidence.
- **Feature envy beyond a chain.** A method that uses another object's data once may still belong where it is. Only the three-hop chain is decidable.
- **Long parameter lists and long functions.** Core already enforces those (`CC-FN-001`, `CC-FN-002`).
- **Comments that explain why.** pstack's narration rule is the narrow version. A blanket comment ban fails D3: deleting the comment wins.
- **Kent Beck's "make the change easy, then make the easy change."** A sequence of commits, not a syntax shape.
- **Pragmatic Programmer tracer bullets, orthogonality, and broken windows.** Process and design judgment.
- **Law of Demeter as "only talk to friends."** The chain rule is the slice that does not need a type checker. Friend types are not visible in the tree.
