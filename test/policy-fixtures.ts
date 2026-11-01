import { BUILTIN } from "../src/assets.ts";
import { librarySource } from "../src/library.ts";
import type { Manifest, Preset } from "../src/types.ts";

// Existing rule/backstop fixtures isolate their selected policy. Core fitness behavior is tested
// separately, including mandatory defaults, fresh execution, failures and invalidated evidence.
// These are explicit fixture contract overrides, never a product onboarding default.
export function policyFixture(text: string): string {
  const preset = JSON.parse(text) as Preset;
  const requirements = JSON.parse(BUILTIN["methodologies/software-invariants.json"]!) as Manifest;
  preset.overrides = { ...Object.fromEntries(requirements.invariants.map((a) => [`core/${a.id}`, "off"])), ...preset.overrides };
  return JSON.stringify(preset);
}

export function policyFixtureSource(source: Preset["sources"][number]) {
  return source.kind === "builtin" ? BUILTIN : source.kind === "library" ? librarySource(source.ns, true) : null;
}
