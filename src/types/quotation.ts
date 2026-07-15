export type QuotationStatus =
  | "draft"
  | "sent"
  | "accepted"
  | "rejected"
  | "converted";

export interface QuotationProduct {
  id: string;
  productId?: string;
  name: string;
  code: string;
  category?: string;
  warehouse: string;
  quantity?: number;
  reservedQuantity?: number;
  qty: number;
  payPrice?: number;
  sellPrice: number;
  unit?: string;
  updatedDate?: string;
  alertQuantity?: number;
}

export interface Quotation {
  id?: string;
  number: string;
  customerId?: string;
  customerName: string;
  customerNumber?: string;
  products: QuotationProduct[];
  subtotal: number;
  discount: number;
  totalPrice: number;
  currency: string;
  exchangeRate: number;
  status: QuotationStatus;
  validUntil?: string;
  note?: string;
  convertedSellId?: string;
  date?: string;
  createdAt?: string;
  updatedAt?: string;
}
