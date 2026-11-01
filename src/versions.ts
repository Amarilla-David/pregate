import core from "../catalog/source.json" with { type: "json" };
import pkg from "../package.json" with { type: "json" };

export const VERSIONS = { engine: pkg.version, core: core.version };
