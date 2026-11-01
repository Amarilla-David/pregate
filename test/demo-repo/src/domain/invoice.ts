import { Money } from "./values/money";

export interface InvoiceLine {
  readonly description: string;
  readonly amount: Money;
}

export class Invoice {
  private readonly lines: InvoiceLine[] = [];
  private status: "draft" | "issued" = "draft";

  constructor(readonly id: string, private customer: string, readonly currency: string) {}

  addLine(line: InvoiceLine): void {
    if (this.status === "issued") throw new Error("An issued invoice cannot change");
    if (line.amount.currency !== this.currency) throw new Error("Line currency differs from the invoice");
    this.lines.push(line);
  }

  issue(): void {
    if (this.lines.length === 0) throw new Error("An empty invoice cannot be issued");
    this.status = "issued";
  }

  isIssued(): boolean {
    return this.status === "issued";
  }

  billedTo(): string {
    return this.customer;
  }

  total(): Money {
    return this.lines.reduce((sum, line) => sum.add(line.amount), Money.zero(this.currency));
  }
}
