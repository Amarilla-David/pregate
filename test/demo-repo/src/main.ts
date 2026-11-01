import { IssueInvoice } from "./application/issue-invoice.use-case";
import { Invoice } from "./domain/invoice";
import { Money } from "./domain/values/money";
import { InMemoryInvoiceRepository } from "./infra/in-memory-invoice-repository";

async function main(): Promise<void> {
  const invoices = new InMemoryInvoiceRepository();
  const invoice = new Invoice("INV-1", "ACME", "USD");
  invoice.addLine({ description: "Consulting", amount: new Money(120_00, "USD") });
  await invoices.save(invoice);
  await new IssueInvoice(invoices).execute("INV-1");
  console.log(`INV-1 issued for ${invoice.total().cents} cents to ${invoice.billedTo()}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
