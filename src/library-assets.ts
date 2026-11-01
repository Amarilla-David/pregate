import { readLibrary } from "./disk.ts" with { type: "macro" };
import type { Files } from "./types.ts";

// Keep both literals inside factories: Bun hoists module constants out of lazy
// require initializers. A hook that never queries a library must construct neither.
export function libraryPolicy(): Files {
  return readLibrary(false);
}
export function libraryFixtures(): Files {
  return readLibrary();
}
