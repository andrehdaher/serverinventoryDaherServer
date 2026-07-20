export interface sell {
  id?: string;
  customerId: string;
  totalPrice: number;
  paymentStatus: "cash" | "part" | "debt";
  remainingDebt: number;
  paymentAccountId?: string;
  receivableAccountId?: string;
  salesAccountId?: string;
  currency: string;
  exchangeRate: number;
  amount_base: number;
  products: {
    category: string;
    code: string;
    id: string;
    name: string;
    payPrice: number;
    quantity: number;
    sellPrice: number;
    unit: string;
    updatedDate: string;
    warehouse: string;
    qty: number;
  }[];
  date?: string;
  partValue?: number;
  discount?: number;
  vehicleId?: string;
  vehicleName?: string;
  driverId?: string;
  driverName?: string;
  sourceWarehouse?: string;
}
