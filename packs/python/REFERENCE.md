# python pack reference

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

Version: `1.2.0`. Category: **language**.

These are manifest defaults. All core rules activate automatically and enforce unless explicitly disabled in the reviewed preset. Optional packs activate only when selected. `pregate preset show` gives the effective contract. A manifest's `complete` label refers to that manifest, not full library or methodology compliance.

## python/architecture

Manifest version: `1.0.0`. Status: **complete**.

### python/PY-LAYER-001

Check: [`python/dependencies/layer-direction@1.0.0`](checks/dependencies/layer-direction/check.json). Default severity: **deny**.

Implementation: `layer-edge`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `python`. Cardinality: `singleton`. Dimension: `python.deps.layers`. Minimum severity: `none`.

The import reaches a layer this core is not allowed to depend on.

Default parameters: `{"paths":["@layers:core"]}`.

**Repair:** Depend on a declared port and wire the adapter at the application boundary.

**Scope and limits:** Do not hide an adapter behind a package initializer, alias or local module replacement.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "PREGATE language starter policies",
  "locator": "python deps.layers, revision 1",
  "paraphrase": "The import reaches a layer this core is not allowed to depend on."
}
```

## python/effects

Manifest version: `1.0.0`. Status: **complete**.

### python/PY-IO-001

Check: [`python/dependencies/no-core-io-imports@1.0.0`](checks/dependencies/no-core-io-imports/check.json). Default severity: **deny**.

Implementation: `banned-import`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `python`. Cardinality: `multi`. Dimension: `python.deps.packages`. Minimum severity: `none`.

The core imports a selected I/O package.

Default parameters: `{"paths":["@layers:core"],"packages":["sqlite3","subprocess","socket","requests"]}`.

**Repair:** Move this effect behind an injected port and implement the operation in an adapter.

**Scope and limits:** This checks literal imports, not all runtime effects; do not rename the package or obscure the loading call.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{
  "packages": {
    "type": "array",
    "items": {
      "type": "string"
    }
  }
}
```

Source metadata:

```json
{
  "work": "PREGATE language starter policies",
  "locator": "python deps.packages, revision 1",
  "paraphrase": "The core imports a selected I/O package."
}
```

## python/quality

Manifest version: `1.2.0`. Status: **complete**.

### python/PY-FN-001

Check: [`python/complexity/fn-max-lines@1.0.0`](checks/complexity/fn-max-lines/check.json). Default severity: **deny**.

Implementation: `metric`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `python`. Cardinality: `singleton`. Dimension: `python.fn.lines`. Minimum severity: `none`.

Function size exceeds the selected limit.

Default parameters: `{"max":50}`.

**Repair:** Extract a cohesive operation and preserve behavior with relevant tests.

**Scope and limits:** Do not compress statements onto one line or split a single state machine into arbitrary fragments.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{
  "max": {
    "type": "integer",
    "minimum": 0
  }
}
```

Source metadata:

```json
{
  "work": "PREGATE language starter policies",
  "locator": "python fn.lines, revision 1",
  "paraphrase": "Function size exceeds the selected limit."
}
```

### python/PY-FN-002

Check: [`python/complexity/fn-max-params@1.0.0`](checks/complexity/fn-max-params/check.json). Default severity: **deny**.

Implementation: `metric`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `python`. Cardinality: `singleton`. Dimension: `python.fn.params`. Minimum severity: `none`.

Function parameter count exceeds the selected limit.

Default parameters: `{"max":4}`.

**Repair:** Review whether the inputs describe a cohesive domain object.

**Scope and limits:** Do not hide unrelated inputs in a generic options map; Python self/cls and variadic parameters count, Go receivers do not.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{
  "max": {
    "type": "integer",
    "minimum": 0
  }
}
```

Source metadata:

```json
{
  "work": "PREGATE language starter policies",
  "locator": "python fn.params, revision 1",
  "paraphrase": "Function parameter count exceeds the selected limit."
}
```

### python/PY-NEST-001

Check: [`python/control/max-nesting@1.0.0`](checks/control/max-nesting/check.json). Default severity: **deny**.

Implementation: `metric`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `python`. Cardinality: `singleton`. Dimension: `python.control.nesting`. Minimum severity: `none`.

Control-flow nesting exceeds the selected limit.

Default parameters: `{"max":2}`.

**Repair:** Use an early return or name a cohesive inner operation.

**Scope and limits:** Do not hide nesting in loops, switch/match branches or exception handlers.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{
  "max": {
    "type": "integer",
    "minimum": 0
  }
}
```

Source metadata:

```json
{
  "work": "PREGATE language starter policies",
  "locator": "python control.nesting, revision 1",
  "paraphrase": "Control-flow nesting exceeds the selected limit."
}
```

### python/PY-CLASS-001

Check: [`python/complexity/class-max-public-methods@1.0.0`](checks/complexity/class-max-public-methods/check.json). Default severity: **deny**.

Implementation: `metric`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `python`. Cardinality: `singleton`. Dimension: `python.class.public-methods`. Minimum severity: `none`.

Declared public-method count exceeds the selected limit.

Default parameters: `{"max":10}`.

**Repair:** Separate cohesive responsibilities while preserving the public API.

**Scope and limits:** Do not rename public methods to private to hide the count; decorated definitions count as declarations.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{
  "max": {
    "type": "integer",
    "minimum": 0
  }
}
```

Source metadata:

```json
{
  "work": "PREGATE language starter policies",
  "locator": "python class.publicMethods, revision 1",
  "paraphrase": "Declared public-method count exceeds the selected limit."
}
```

### python/PY-EXCEPT-001

Check: [`python/errors/no-bare-except@1.0.0`](checks/errors/no-bare-except/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `python`. Cardinality: `singleton`. Dimension: `python.errors.bare-except`. Minimum severity: `none`.

A bare except also catches process-control exceptions.

Default parameters: `{}`.

**Repair:** Name the intended exception classes or document a deliberately broad boundary.

**Scope and limits:** Do not swallow KeyboardInterrupt/SystemExit during ordinary error handling.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "PREGATE language starter policies",
  "locator": "python errors.bare-except, revision 1",
  "paraphrase": "A bare except also catches process-control exceptions."
}
```

### python/PY-DEFAULT-001

Check: [`python/state/no-mutable-default@1.0.0`](checks/state/no-mutable-default/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `python`. Cardinality: `singleton`. Dimension: `python.state.mutable-default`. Minimum severity: `none`.

Every call that relies on the default reads and changes the same list, dict or set, so state leaks from one call into the next.

Default parameters: `{}`.

**Repair:** Default to None and create the value in the body: items = [] if items is None else items. Use field(default_factory=list) in a dataclass.

**Scope and limits:** Do not hide the shared value behind list(), dict(), set() or a collections constructor. A deliberate shared cache keeps the FAQ's underscore name, such as _cache={}.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Python documentation, The Python Tutorial and Programming FAQ",
  "locator": "https://docs.python.org/3/tutorial/controlflow.html#default-argument-values (Important warning); https://docs.python.org/3/faq/programming.html#why-are-default-values-shared-between-objects",
  "paraphrase": "A default value is evaluated only once, so a mutable default such as a list or dict is shared by every call. Use None and create the value inside the function."
}
```

### python/PY-IS-001

Check: [`python/comparison/no-is-literal@1.0.0`](checks/comparison/no-is-literal/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `python`. Cardinality: `singleton`. Dimension: `python.comparison.is-literal`. Minimum severity: `none`.

is compares object identity. Whether two equal numbers or strings are the same object is an interpreter detail, so the check can flip between runs, versions or values.

Default parameters: `{}`.

**Repair:** Compare values with == or != . Keep is only for None, True, False and sentinel objects.

**Scope and limits:** Do not wrap the literal in parentheses, negate it or move it to the left side; those are still literals.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Python documentation, What's New In Python 3.8",
  "locator": "https://docs.python.org/3/whatsnew/3.8.html#changes-in-python-behavior (SyntaxWarning for is with a literal)",
  "paraphrase": "Identity checks with is and is not against string or number literals can work by accident in CPython but are not guaranteed by the language; use == and != instead."
}
```

### python/PY-STAR-001

Check: [`python/dependencies/no-wildcard-import@1.0.0`](checks/dependencies/no-wildcard-import/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `python`. Cardinality: `singleton`. Dimension: `python.deps.wildcard`. Minimum severity: `none`.

A wildcard import hides where a name comes from and lets a later change in the imported module silently shadow local names.

Default parameters: `{}`.

**Repair:** Import the names the module uses, or import the module and qualify its names.

**Scope and limits:** Package __init__.py files that republish submodules are not checked. An accelerator-module fallback elsewhere needs a reviewed exclusion, not a copied name list.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "PEP 8, Style Guide for Python Code",
  "locator": "https://peps.python.org/pep-0008/#imports (wildcard imports)",
  "paraphrase": "Wildcard imports should be avoided because they make it unclear which names are present in the namespace. Republishing an internal interface as a public API is the defensible exception."
}
```

### python/PY-ASSERT-001

Check: [`python/errors/no-assert-tuple@1.0.0`](checks/errors/no-assert-tuple/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `python`. Cardinality: `singleton`. Dimension: `python.errors.assert-tuple`. Minimum severity: `none`.

A non-empty tuple is always truthy in Python. assert (x > 0, 'must be positive') never fails, disabling the assertion completely.

Default parameters: `{}`.

**Repair:** Remove parentheses: write assert x > 0, 'must be positive'.

**Scope and limits:** Do not enclose assert condition and error message inside parentheses or leave a trailing comma in assert (x,).

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Python Reference Manual & Flake8-Bugbear",
  "locator": "B011 / assert statement syntax",
  "paraphrase": "assert (a, b) is an assertion of a tuple, which always evaluates to True."
}
```

### python/PY-RAISE-001

Check: [`python/errors/no-raise-notimplemented@1.0.0`](checks/errors/no-raise-notimplemented/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `python`. Cardinality: `singleton`. Dimension: `python.errors.raise-notimplemented`. Minimum severity: `none`.

NotImplemented is not an Exception class. Raising it raises a TypeError at runtime when caught by an except clause expecting Exception.

Default parameters: `{}`.

**Repair:** Use raise NotImplementedError() instead of raise NotImplemented.

**Scope and limits:** Do not raise NotImplemented or NotImplemented() in abstract methods or stubs.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Python Reference Manual: Built-in Constants",
  "locator": "NotImplemented",
  "paraphrase": "NotImplemented is a constant returned by rich comparisons; it should never be raised."
}
```
