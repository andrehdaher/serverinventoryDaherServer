
export interface Product {
  id?: string;
  name: string;
  code: string;
  category?: string;
  payPrice?: number;
  sellPrice?: number;
  unit?: string;
  quantity: number;
  alertQuantity?: number;
  warehouse: string;
  updatedDate?: string;
}
