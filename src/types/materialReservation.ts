export type MaterialReservationStatus = "reserved" | "closed" | "cancelled";

export interface MaterialReservationItem {
  id: string;
  productId: string;
  name: string;
  code: string;
  category?: string;
  warehouse: string;
  unit?: string;
  payPrice?: number;
  sellPrice: number;
  reservedQty: number;
  usedQty?: number;
  returnedQty?: number;
  lineTotal?: number;
}

export interface MaterialReservation {
  id: string;
  customerId: string;
  technicianId?: string;
  technicianName: string;
  status: MaterialReservationStatus;
  items: MaterialReservationItem[];
  note?: string;
  sellId?: string;
  totalReservedQty: number;
  totalUsedQty?: number;
  totalReturnedQty?: number;
  totalPrice?: number;
  discount?: number;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  cancelledAt?: string;
  createdBy?: string;
  updatedBy?: string;
}
