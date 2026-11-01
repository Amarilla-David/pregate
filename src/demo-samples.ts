const FILES = (require("./embedded.ts") as typeof import("./embedded.ts")).demoFiles();
export const DEMO_LANGUAGES = ["python", "go", "rust"] as const;
export type DemoLanguage = typeof DEMO_LANGUAGES[number];

export function demoSample(language: DemoLanguage) {
  const folder = language === "python" ? "src/shop" : language === "go" ? "internal" : "src";
  const extension = { python: "py", go: "go", rust: "rs" }[language];
  const prefix = language + "/";
  const files = Object.fromEntries(Object.entries(FILES).filter(([path]) => path.startsWith(prefix) && !path.includes("/proposed/"))
    .map(([path, text]) => [path.slice(prefix.length), text]));
  if (!Object.keys(files).length) throw new Error(`${language} demo files are not bundled.`);
  return { language, files, folder, target: `${folder}/domain/price.${extension}`, legacy: `${folder}/domain/legacy.${extension}`,
    rule: `${language}/${{ python: "PY", go: "GO", rust: "RUST" }[language]}-LAYER-001`,
    bad: FILES[`${prefix}proposed/bad.fixture`]!, repair: FILES[`${prefix}proposed/repair.fixture`]!,
    syntax: FILES[`${prefix}proposed/syntax.fixture`]!, debtRepair: FILES[`${prefix}proposed/debt-repair.fixture`]! };
}

export type DemoSample = ReturnType<typeof demoSample>;
