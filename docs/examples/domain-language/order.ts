export type Order =
  | { readonly state: "draft"; readonly lines: readonly string[] }
  | { readonly state: "placed"; readonly lines: readonly [string, ...string[]] }
  | { readonly state: "cancelled"; readonly reason: string };

export type OrderCommand =
  | { readonly kind: "place-order" }
  | { readonly kind: "cancel-order"; readonly reason: string };

function validReason(reason: string): boolean {
  return reason.trim().length > 0 && reason.length <= 200;
}

export function draftOrder(lines: readonly string[]): Order {
  if (lines.some(line => line.trim().length === 0)) throw new Error("An order line must have a name");
  return { state: "draft", lines: [...lines] };
}

export function parseOrderCommand(input: unknown): OrderCommand {
  if (typeof input !== "object" || input === null || Array.isArray(input)
    || !Object.hasOwn(input, "kind") || !("kind" in input)) throw new Error("Invalid order command");
  if (input.kind === "place-order" && Object.keys(input).length === 1) return { kind: "place-order" };
  if (input.kind === "cancel-order" && Object.keys(input).length === 2 && Object.hasOwn(input, "reason") && "reason" in input
    && typeof input.reason === "string" && validReason(input.reason)) return { kind: "cancel-order", reason: input.reason };
  throw new Error("Invalid order command");
}

export function applyOrderCommand(order: Order, command: OrderCommand): Order {
  switch (command.kind) {
    case "place-order": {
      if (order.state !== "draft") throw new Error("Only a draft order can be placed");
      const first = order.lines[0];
      if (first === undefined) throw new Error("A placed order must have a line");
      return { state: "placed", lines: [first, ...order.lines.slice(1)] };
    }
    case "cancel-order": {
      if (order.state === "cancelled") throw new Error("An order cannot be cancelled twice");
      if (!validReason(command.reason)) throw new Error("Cancellation requires a bounded reason");
      return { state: "cancelled", reason: command.reason };
    }
    default:
      command satisfies never;
      throw new Error("Unknown order command");
  }
}
