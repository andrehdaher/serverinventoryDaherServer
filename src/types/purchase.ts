
export interface purchase {
    id: string,
    supplierId: string,
    name: string,
    code: string,
    warehouse: string,
    quantity: number,
    payPrice: number,
    totalPrice: number,
    products?: {
        id?: string,
        name: string,
        code: string,
        category: string,
        warehouse: string,
        quantity: number,
        payPrice: number,
        sellPrice: number,
        unit: string,
        lineTotal?: number,
    }[],
    currency: string,
    exchangeRate: number,
    amount_base: number,
    paymentStatus: string,
    remainingDebt: number,
        inventoryAccountId: string,
payableAccountId: string,
paymentAccountId?: string,
    date: string,



}
