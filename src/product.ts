export const REPO = "pedroknigge/pregate";
export const ENGINE_VERSION = /^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$/;
// A bare call with no input is a person, not a hook: registered hooks always name their event.
export const NO_COMMAND = "pregate: no command. Run pregate in a terminal for the guide, or pregate --help.\n";
// Blank as the launcher sees it (C-locale [:space:]): U+00A0 or U+FEFF alone is input, so it still denies.
export const blank = (text: string): boolean => /^[\t\n\v\f\r ]*$/.test(text);

// Semantic version order: negative when a is older than b, 0 when equal, positive when newer.
export function compareVersions(a: string, b: string): number {
  const [baseA, preA] = a.split("-"), [baseB, preB] = b.split("-");
  const numbersA = baseA!.split(".").map(Number), numbersB = baseB!.split(".").map(Number);
  for (let i = 0; i < 3; i++) if (numbersA[i] !== numbersB[i]) return numbersA[i]! - numbersB[i]!;
  if (preA === preB) return 0;
  if (preA === undefined || preB === undefined) return preA === undefined ? 1 : -1;
  const partsA = preA.split("."), partsB = preB.split(".");
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const left = partsA[i], right = partsB[i];
    if (left === right) continue;
    if (left === undefined || right === undefined) return left === undefined ? -1 : 1;
    const numericA = /^\d+$/.test(left), numericB = /^\d+$/.test(right);
    if (numericA && numericB) return Number(left) - Number(right);
    if (numericA !== numericB) return numericA ? -1 : 1;
    return left < right ? -1 : 1;
  }
  return 0;
}
