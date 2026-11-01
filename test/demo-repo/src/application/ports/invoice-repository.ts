import type { Invoice } from "../../domain/invoice";

export interface InvoiceRepository {
  byId(id: string): Promise<Invoice | null>;
  save(invoice: Invoice): Promise<void>;
}
