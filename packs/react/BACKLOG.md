# react backlog

Judgment, or checks the syntax tree cannot decide without guessing intent.

- **Exhaustive deps.** Whether an effect lists every value it reads needs dataflow: a bare identifier inside the callback is not proof it comes from outside, and a ref or a stable setter needs no entry. Candidate.
- **Setter bindings and convergent render updates.** REACT-RENDER-001 is off. A `setX` name can be an ordinary function, and React documents guarded current-component updates to track previous renders. Resolving the Hook binding and proving the guard converges requires facts this matcher lacks.
- **useMemo with a single argument.** Calling `useMemo(fn)` with no dependency array is usually a mistake, but whether the author meant "recompute always" or "compute once" is intent the tree cannot read. Judgment.
- **Inline-literal props.** An inline object or arrow prop (`style={{...}}`, `onChange={() => ...}`) reallocates every render, but whether that cost matters depends on the child (memoized or not). Flagging all of them is noise. Judgment.
- **Server/client boundaries.** Which components must be server components and which need `"use client"` lives in the nextjs pack, where the router contract is known. This pack stays router-agnostic.
