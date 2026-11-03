// A closed grammar for stdin JSON inspection, not a Python sandbox. Unrecognized
// scripts retain the shell guard. No project module, arbitrary call or write qualifies.
export function pythonInspection(args: { text: string; literal: boolean }[]): boolean {
  if (args.length !== 3 || args[0]?.text !== "-I" || args[1]?.text !== "-c" || !args.every(arg => arg.literal)) return false;
  const tokens = tokenize(args[2]!.text);
  if (tokens === null) return false;
  return inspectsJson(tokens);
}

function inspectionRejected(error: unknown): boolean {
  return error instanceof Error && error.message === "unsupported inspection";
}

function inspectsJson(tokens: string[]): boolean {
  try { return new JsonInspection(tokens).parse(); }
  catch (error) { if (inspectionRejected(error)) return false; throw error; }
}

function tokenize(source: string): string[] | null {
  if (source.length > 16_384) return null;
  const tokens: string[] = [];
  const token = /[ \t\r]+|\n|#[^\n]*|'(?:[^'\\\n]|\\[^\n])*'|"(?:[^"\\\n]|\\[^\n])*"|\d+(?:\.\d+)?|[A-Za-z_]\w*|[()[\]{},.:;=+-]/y;
  for (let at = 0; at < source.length;) {
    token.lastIndex = at;
    const found = token.exec(source);
    if (found === null || tokens.length >= 2048) return null;
    at = token.lastIndex;
    if (!/^[ \t\r#]/.test(found[0])) tokens.push(found[0] === "\n" ? ";" : found[0]);
  }
  return tokens;
}

const BUILTINS = ["len", "str", "int", "float", "bool", "sorted"];
const RESERVED = ["json", "sys", "print", ...BUILTINS, "True", "False", "None"];

class JsonInspection {
  private at = 0;
  private depth = 0;
  private readonly modules = new Set<string>();
  private readonly locals = new Set<string>();
  constructor(private readonly tokens: string[]) {}
  private take(value: string): boolean { return this.tokens[this.at] === value && (++this.at > 0); }
  private need(value: string): void { if (!this.take(value)) throw new Error("unsupported inspection"); }

  parse(): boolean {
    let output = false;
    while (this.at < this.tokens.length) {
      if (this.take(";")) continue;
      const head = this.tokens[this.at++];
      if (head === "import") {
        do {
          const module = this.tokens[this.at++];
          if (module !== "sys" && module !== "json") return false;
          this.modules.add(module);
        } while (this.take(","));
      } else if (head === "print") { this.call(1, 16); output = true; }
      else {
        if (head === undefined || !/^[A-Za-z]\w*$/.test(head) || RESERVED.includes(head)) return false;
        this.need("="); this.expression(); this.locals.add(head);
      }
      if (this.at < this.tokens.length && !this.take(";")) return false;
    }
    return output;
  }

  private call(minimum: number, maximum: number): void {
    this.need("("); let count = 0;
    if (!this.take(")")) {
      do { this.expression(); count++; } while (this.take(",") && this.tokens[this.at] !== ")");
      this.need(")");
    }
    if (count < minimum || count > maximum) throw new Error("unsupported inspection");
  }

  private expression(): void {
    if (++this.depth > 32) throw new Error("unsupported inspection");
    const value = this.tokens[this.at++];
    if (value === undefined) throw new Error("unsupported inspection");
    if (value === "json") this.json();
    else if (BUILTINS.includes(value)) this.call(1, 1);
    else if (value === "(") { this.expression(); this.need(")"); }
    else if (value === "[" || value === "{") this.collection(value);
    else if (!this.locals.has(value) && !/^(?:\d+(?:\.\d+)?|True|False|None)$/.test(value) && !/^['"]/.test(value)) throw new Error("unsupported inspection");
    while (this.tokens[this.at] === "[" || this.tokens[this.at] === ".") {
      if (this.take("[")) { this.expression(); this.need("]"); }
      else {
        this.need("."); const selector = this.tokens[this.at++];
        if (selector === "get") this.call(1, 2);
        else if (["keys", "values", "items"].includes(selector ?? "")) this.call(0, 0);
        else throw new Error("unsupported inspection");
      }
    }
    this.depth--;
  }

  private collection(start: string): void {
    const end = start === "[" ? "]" : "}";
    if (!this.take(end)) {
      do { this.expression(); if (start === "{") { this.need(":"); this.expression(); } } while (this.take(",") && this.tokens[this.at] !== end);
      this.need(end);
    }
  }

  private json(): void {
    if (!this.modules.has("json")) throw new Error("unsupported inspection");
    this.need("."); const method = this.tokens[this.at++]; this.need("(");
    if (method === "load" || method === "loads") {
      if (!this.modules.has("sys")) throw new Error("unsupported inspection");
      this.need("sys"); this.need("."); this.need("stdin");
      if (method === "loads") { this.need("."); this.need("read"); this.need("("); this.need(")"); }
    } else if (method === "dumps") {
      this.expression();
      const options = new Set<string>();
      while (this.take(",")) {
        const name = this.tokens[this.at++];
        if (name === undefined || options.has(name) || !["indent", "sort_keys", "ensure_ascii"].includes(name)) throw new Error("unsupported inspection");
        options.add(name); this.need("=");
        const setting = this.tokens[this.at++];
        if (setting === undefined || !(name === "indent" ? /^(?:\d+|None)$/.test(setting) : /^(?:True|False)$/.test(setting))) throw new Error("unsupported inspection");
      }
    } else throw new Error("unsupported inspection");
    this.need(")");
  }
}

// The same closed grammar for `node -e`/`-p`: locals, literals, member reads, `+`, and calls to
// require() of a literal .json path (parsed, not run), JSON.stringify, Object.keys/values/entries
// and console.log. Nothing else is called, so no write, exec or computed call qualifies.
export function nodeInspection(args: { text: string; literal: boolean }[]): boolean {
  if (args.length !== 2 || !/^(-e|-p|--eval|--print)$/.test(args[0]!.text) || !args.every(arg => arg.literal)) return false;
  if (/[\n#\\]/.test(args[1]!.text)) return false;   // no line break (ASI), private name or escape
  const tokens = tokenize(args[1]!.text);
  if (tokens === null) return false;
  try { return new NodeInspection(tokens).parse(); }
  catch (error) { if (inspectionRejected(error)) return false; throw error; }
}

const NODE_RESERVED = ["require", "JSON", "Object", "console", "const", "let", "var", "true", "false", "null", "undefined"];
const NODE_CALLS: Record<string, [string[], number, number]> = {
  JSON: [["stringify"], 1, 3], Object: [["keys", "values", "entries"], 1, 1], console: [["log", "error"], 0, 16],
};

class NodeInspection {
  private at = 0;
  private depth = 0;
  private readonly locals = new Set<string>();
  constructor(private readonly tokens: string[]) {}
  private take(value: string): boolean { return this.tokens[this.at] === value && (++this.at > 0); }
  private need(value: string): void { if (!this.take(value)) throw new Error("unsupported inspection"); }
  private next(): string {
    const token = this.tokens[this.at++];
    if (token === undefined) throw new Error("unsupported inspection");
    return token;
  }

  parse(): boolean {
    while (this.at < this.tokens.length) {
      if (this.take(";")) continue;
      if (["const", "let", "var"].includes(this.tokens[this.at] ?? "")) {
        this.at++; const name = this.next();
        if (!/^[A-Za-z_]\w*$/.test(name) || NODE_RESERVED.includes(name)) return false;
        this.need("="); this.expression(); this.locals.add(name);
      } else this.expression();
      if (this.at < this.tokens.length && !this.take(";")) return false;
    }
    return true;
  }

  private expression(): void {
    if (++this.depth > 32) throw new Error("unsupported inspection");
    this.operand();
    while (this.take("+")) this.operand();
    this.depth--;
  }

  private operand(): void {
    const value = this.next();
    const known = NODE_CALLS[value];
    if (value === "require") { this.need("("); this.jsonPath(); this.need(")"); }
    else if (known) this.call(known);
    else if (value === "(") { this.expression(); this.need(")"); }
    else if (value === "[" || value === "{") this.collection(value);
    else if (!this.locals.has(value) && !/^(?:\d+(?:\.\d+)?|true|false|null|'.*'|".*")$/.test(value)) throw new Error("unsupported inspection");
    while (this.tokens[this.at] === "[" || this.tokens[this.at] === ".") {
      if (this.take("[")) { this.expression(); this.need("]"); }
      else { this.need("."); if (!/^[A-Za-z_]\w*$/.test(this.next())) throw new Error("unsupported inspection"); }
    }
  }

  private call([methods, minimum, maximum]: [string[], number, number]): void {
    this.need("."); if (!methods.includes(this.next())) throw new Error("unsupported inspection");
    this.need("("); let count = 0;
    if (!this.take(")")) {
      do { this.expression(); count++; } while (this.take(",") && this.tokens[this.at] !== ")");
      this.need(")");
    }
    if (count < minimum || count > maximum) throw new Error("unsupported inspection");
  }

  // Node parses a .json file by its extension; a script path or a package name would run code.
  private jsonPath(): void {
    if (!/^(['"])(?:\.{1,2})?\/[^'"]*\.json\1$/.test(this.next())) throw new Error("unsupported inspection");
  }

  private collection(start: string): void {
    const end = start === "[" ? "]" : "}";
    if (this.take(end)) return;
    do {
      if (start === "{" && !/^(?:[A-Za-z_]\w*|'.*'|".*")$/.test(this.next())) throw new Error("unsupported inspection");
      if (start === "{") this.need(":");
      this.expression();
    } while (this.take(",") && this.tokens[this.at] !== end);
    this.need(end);
  }
}
