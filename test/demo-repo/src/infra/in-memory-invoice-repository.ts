import type { InvoiceRepository } from "../application/ports/invoice-repository";
import type { Invoice } from "../domain/invoice";

export class InMemoryInvoiceRepository implements InvoiceRepository {
  private readonly invoices = new Map<string, Invoice>();

  async byId(id: string): Promise<Invoice | null> {
    return this.invoices.get(id) ?? null;
  }

  async save(invoice: Invoice): Promise<void> {
    this.invoices.set(invoice.id, invoice);
  }
}
