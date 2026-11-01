// `import x from "./f.wasm" with { type: "file" }` gives the path of the file embedded by Bun.
declare module "*.wasm" {
  const path: string;
  export default path;
}
