import { expect, test } from "bun:test";
import { applyOrderCommand, draftOrder, parseOrderCommand } from "./order.ts";

test("the domain vocabulary maps to explicit operations and observable outcomes", () => {
  const draft = draftOrder(["item"]);
  const placed = applyOrderCommand(draft, parseOrderCommand({ kind: "place-order" }));
  expect(placed).toEqual({ state: "placed", lines: ["item"] });
  expect(draft).toEqual({ state: "draft", lines: ["item"] });
  expect(applyOrderCommand(placed, parseOrderCommand({ kind: "cancel-order", reason: "Customer request" })))
    .toEqual({ state: "cancelled", reason: "Customer request" });
});

test.each([null, [], "place-order", {}, { kind: "update", patch: { state: "placed" } }, { kind: "place-order", bypass: true },
  { kind: "cancel-order" }, { kind: "cancel-order", reason: " " }, { kind: "cancel-order", reason: 1 },
  { kind: "cancel-order", reason: "x".repeat(201) }, { kind: "cancel-order", reason: "Reason", extra: true },
  Object.assign(Object.create({ kind: "place-order" }), { extra: true }),
  Object.assign(Object.create({ reason: "Reason" }), { kind: "cancel-order", extra: true }),
  Object.assign([], { kind: "place-order" })].map(input => ({ input })))
  ("the boundary rejects unknown or ambiguous command input: %j", ({ input }) => {
    expect(() => parseOrderCommand(input)).toThrow("Invalid order command");
  });

test("the domain also guards transitions when a caller bypasses boundary parsing", () => {
  const draft = draftOrder(["item"]);
  const placed = applyOrderCommand(draft, { kind: "place-order" });
  const cancelled = applyOrderCommand(placed, { kind: "cancel-order", reason: "Customer request" });
  expect(() => applyOrderCommand(draftOrder([]), { kind: "place-order" })).toThrow("must have a line");
  expect(() => applyOrderCommand(placed, { kind: "place-order" })).toThrow("Only a draft");
  expect(() => applyOrderCommand(cancelled, { kind: "place-order" })).toThrow("Only a draft");
  expect(() => applyOrderCommand(cancelled, { kind: "cancel-order", reason: "Again" })).toThrow("twice");
  expect(() => applyOrderCommand(draft, { kind: "cancel-order", reason: " " })).toThrow("bounded reason");
  expect(() => draftOrder([""])).toThrow("must have a name");
});

test("construction takes ownership of data instead of sharing the caller's mutable array", () => {
  const lines = ["item"];
  const draft = draftOrder(lines);
  lines.push("unexpected");
  expect(draft).toEqual({ state: "draft", lines: ["item"] });
});
