import type { InvoiceRepository } from "./ports/invoice-repository";

export class IssueInvoice {
  constructor(private readonly invoices: InvoiceRepository) {}

  async execute(invoiceId: string): Promise<void> {
    const invoice = await this.invoices.byId(invoiceId);
    if (invoice === null) throw new Error(`Invoice ${invoiceId} does not exist`);
    invoice.issue();
    await this.invoices.save(invoice);
  }
}
