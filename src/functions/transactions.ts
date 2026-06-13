import {
  updateCustomerBalanceInternal,
  updateCustomerInternal,
} from "../controllers/customer.controller";
import { createPaymentInternal } from "../controllers/payments.controller";
import {
  createOrUpdateProductInternal,
  getProductByIdInternal,
  updateQuantityOnSell,
} from "../controllers/products.controller";
import {
  createPurchaseInternal,
  getPurchaseByIdInternal,
  updatePurchaseInternal,
} from "../controllers/purchases.controller";
import { createReturnInternal } from "../controllers/returns.controller";
import {
  getReturnableProductFromSellInternal,
  createSellInternal,
  returnProductsFromSellInternal,
} from "../controllers/sells.controller";
import {
  updateSupplierBalanceInternal,
  updateSupplierInternal,
} from "../controllers/suppliers.controller";
import { createTransferInternal } from "../controllers/transfer.controller";
import { updateAccountBalanceInternal } from "../controllers/account.controller";
import { createJournalEntryInternal } from "../controllers/journalEntries.controller";
import { Payment } from "../types/payment";
import { Product } from "../types/product";
import { purchase } from "../types/purchase";
import { sell } from "../types/sell";

type LedgerEntry = {
  accountId?: string;
  entryType: "debit" | "credit";
  amount?: number;
};

const postLedgerEntries = async (entries: LedgerEntry[]) => {
  for (const entry of entries) {
    const amount = Number(entry.amount || 0);

    if (!entry.accountId || amount <= 0) {
      continue;
    }

    await updateAccountBalanceInternal({
      accountId: entry.accountId,
      entryType: entry.entryType,
      amount,
    });
  }
};

const toJournalLines = (entries: LedgerEntry[], note: string) => {
  return entries
    .filter((entry) => entry.accountId && Number(entry.amount || 0) > 0)
    .map((entry) => ({
      accountId: entry.accountId as string,
      debit: entry.entryType === "debit" ? Number(entry.amount || 0) : 0,
      credit: entry.entryType === "credit" ? Number(entry.amount || 0) : 0,
      note,
    }));
};

export const handlePurchase = async ({
  newPurchase,
  newProduct,
}: {
  newPurchase: purchase;
  newProduct: Product;
}) => {
  const purchaseData = await createPurchaseInternal(newPurchase);

  await createOrUpdateProductInternal(newProduct);
  await updateSupplierInternal(purchaseData.supplierId, purchaseData);

  const paidAmount = purchaseData.totalPrice - purchaseData.remainingDebt;

  await postLedgerEntries([
    {
      accountId: purchaseData.inventoryAccountId,
      entryType: "debit",
      amount: purchaseData.totalPrice,
    },
    {
      accountId: purchaseData.paymentAccountId,
      entryType: "credit",
      amount: paidAmount,
    },
    {
      accountId: purchaseData.payableAccountId,
      entryType: "credit",
      amount: purchaseData.remainingDebt,
    },
  ]);

  await createJournalEntryInternal({
    date: purchaseData.date,
    description: `قيد شراء ${purchaseData.name || purchaseData.code}`,
    referenceType: "purchase",
    referenceId: purchaseData.id,
    lines: toJournalLines(
      [
        {
          accountId: purchaseData.inventoryAccountId,
          entryType: "debit",
          amount: purchaseData.totalPrice,
        },
        {
          accountId: purchaseData.paymentAccountId,
          entryType: "credit",
          amount: paidAmount,
        },
        {
          accountId: purchaseData.payableAccountId,
          entryType: "credit",
          amount: purchaseData.remainingDebt,
        },
      ],
      `قيد شراء ${purchaseData.name || purchaseData.code}`
    ),
  });

  if (paidAmount > 0) {
    await createPaymentInternal({
      type: "expense",
      supplierId: purchaseData.supplierId,
      paymentAccountId: purchaseData.paymentAccountId,
      payableAccountId: purchaseData.payableAccountId,
      amount: -paidAmount,
      note:
        purchaseData.remainingDebt === 0
          ? `${newProduct.name} دفع كامل ثمن شراء`
          : `${newProduct.name} دفعة من ثمن شراء`,
      currency: newPurchase.currency,
      exchangeRate: newPurchase.exchangeRate,
      amount_base: -(newPurchase.exchangeRate * paidAmount),
    });
  }

  return purchaseData;
};

export const handleBulkPurchase = async ({
  newPurchase,
}: {
  newPurchase: purchase;
}) => {
  const products = Array.isArray(newPurchase.products)
    ? newPurchase.products
    : [];

  if (!products.length) {
    throw new Error("Purchase invoice must include at least one product");
  }

  const totalPrice = products.reduce(
    (sum, product) =>
      sum +
      Number(product.lineTotal || Number(product.payPrice || 0) * Number(product.quantity || 0)),
    0
  );

  const purchaseData = await createPurchaseInternal({
    ...newPurchase,
    name: newPurchase.name || `Purchase invoice (${products.length})`,
    code: newPurchase.code || `PINV-${Date.now()}`,
    warehouse:
      newPurchase.warehouse ||
      Array.from(new Set(products.map((product) => product.warehouse))).join(", "),
    quantity:
      newPurchase.quantity ||
      products.reduce((sum, product) => sum + Number(product.quantity || 0), 0),
    payPrice: newPurchase.payPrice || 0,
    totalPrice,
    amount_base: newPurchase.amount_base || totalPrice * Number(newPurchase.exchangeRate || 1),
    products: products.map((product) => ({
      ...product,
      lineTotal:
        product.lineTotal ||
        Number(product.payPrice || 0) * Number(product.quantity || 0),
    })),
  });

  for (const product of products) {
    await createOrUpdateProductInternal({
      id: product.id || "",
      name: product.name,
      code: product.code,
      category: product.category,
      warehouse: product.warehouse,
      payPrice: Number(product.payPrice || 0),
      sellPrice: Number(product.sellPrice || 0),
      unit: product.unit,
      quantity: Number(product.quantity || 0),
      alertQuantity:
        product.alertQuantity === undefined
          ? undefined
          : Number(product.alertQuantity || 0),
      updatedDate: "",
    });
  }

  await updateSupplierInternal(purchaseData.supplierId, purchaseData);

  const paidAmount = purchaseData.totalPrice - purchaseData.remainingDebt;
  const note = `Ù‚ÙŠØ¯ ÙØ§ØªÙˆØ±Ø© Ø´Ø±Ø§Ø¡ ${purchaseData.code}`;

  await postLedgerEntries([
    {
      accountId: purchaseData.inventoryAccountId,
      entryType: "debit",
      amount: purchaseData.totalPrice,
    },
    {
      accountId: purchaseData.paymentAccountId,
      entryType: "credit",
      amount: paidAmount,
    },
    {
      accountId: purchaseData.payableAccountId,
      entryType: "credit",
      amount: purchaseData.remainingDebt,
    },
  ]);

  await createJournalEntryInternal({
    date: purchaseData.date,
    description: note,
    referenceType: "purchase",
    referenceId: purchaseData.id,
    lines: toJournalLines(
      [
        {
          accountId: purchaseData.inventoryAccountId,
          entryType: "debit",
          amount: purchaseData.totalPrice,
        },
        {
          accountId: purchaseData.paymentAccountId,
          entryType: "credit",
          amount: paidAmount,
        },
        {
          accountId: purchaseData.payableAccountId,
          entryType: "credit",
          amount: purchaseData.remainingDebt,
        },
      ],
      note
    ),
  });

  if (paidAmount > 0) {
    await createPaymentInternal({
      type: "expense",
      supplierId: purchaseData.supplierId,
      paymentAccountId: purchaseData.paymentAccountId,
      payableAccountId: purchaseData.payableAccountId,
      amount: -paidAmount,
      note:
        purchaseData.remainingDebt === 0
          ? "Ø¯ÙØ¹ ÙƒØ§Ù…Ù„ Ø«Ù…Ù† ÙØ§ØªÙˆØ±Ø© Ø´Ø±Ø§Ø¡"
          : "Ø¯ÙØ¹Ø© Ù…Ù† Ø«Ù…Ù† ÙØ§ØªÙˆØ±Ø© Ø´Ø±Ø§Ø¡",
      currency: newPurchase.currency,
      exchangeRate: newPurchase.exchangeRate,
      amount_base: -(newPurchase.exchangeRate * paidAmount),
    });
  }

  return purchaseData;
};

export const handleSell = async ({ newSell }: { newSell: sell }) => {
  try {
    const sellData = await createSellInternal(newSell);
    const paidAmount = sellData.totalPrice - sellData.remainingDebt;

    for (const product of newSell.products) {
      await updateQuantityOnSell(product.id, product.warehouse, product.qty);
    }

    await updateCustomerInternal(sellData.customerId, sellData);

    await postLedgerEntries([
      {
        accountId: sellData.paymentAccountId,
        entryType: "debit",
        amount: paidAmount,
      },
      {
        accountId: sellData.receivableAccountId,
        entryType: "debit",
        amount: sellData.remainingDebt,
      },
      {
        accountId: sellData.salesAccountId,
        entryType: "credit",
        amount: sellData.totalPrice,
      },
    ]);

    await createJournalEntryInternal({
      date: sellData.date,
      description: `قيد بيع ${sellData.products?.[0]?.name || sellData.id}`,
      referenceType: "sell",
      referenceId: sellData.id,
      lines: toJournalLines(
        [
          {
            accountId: sellData.paymentAccountId,
            entryType: "debit",
            amount: paidAmount,
          },
          {
            accountId: sellData.receivableAccountId,
            entryType: "debit",
            amount: sellData.remainingDebt,
          },
          {
            accountId: sellData.salesAccountId,
            entryType: "credit",
            amount: sellData.totalPrice,
          },
        ],
        `قيد بيع ${sellData.products?.[0]?.name || sellData.id}`
      ),
    });

    if (sellData.remainingDebt === 0) {
      await createPaymentInternal({
        type: "income",
        customerId: sellData.customerId,
        paymentAccountId: sellData.paymentAccountId,
        receivableAccountId: sellData.receivableAccountId,
        salesAccountId: sellData.salesAccountId,
        amount: sellData.totalPrice,
        note: "دفع كامل ثمن بيع",
        currency: sellData.currency,
        exchangeRate: sellData.exchangeRate,
        amount_base: sellData.exchangeRate * sellData.totalPrice,
      });
    } else if (sellData.remainingDebt < sellData.totalPrice) {
      await createPaymentInternal({
        type: "income",
        customerId: sellData.customerId,
        paymentAccountId: sellData.paymentAccountId,
        receivableAccountId: sellData.receivableAccountId,
        salesAccountId: sellData.salesAccountId,
        amount: paidAmount,
        note: "دفعة من ثمن بيع",
        currency: sellData.currency,
        exchangeRate: sellData.exchangeRate,
        amount_base:
          sellData.partValue || sellData.exchangeRate * paidAmount,
      });
    }

    return sellData;
  } catch (err) {
    console.log(err);
  }
};

export const customerPayment = async (paymentData: Payment) => {
  const data = await createPaymentInternal(paymentData);

  if (data.customerId) {
    await updateCustomerInternal(data.customerId, undefined, paymentData);
  }

  await postLedgerEntries([
    {
      accountId: data.paymentAccountId,
      entryType: "debit",
      amount: Math.abs(data.amount),
    },
    {
      accountId: data.receivableAccountId,
      entryType: "credit",
      amount: Math.abs(data.amount),
    },
  ]);

  await createJournalEntryInternal({
    date: data.date,
    description: data.note || "قيد دفعة عميل",
    referenceType: "payment",
    referenceId: data.id,
    lines: toJournalLines(
      [
        {
          accountId: data.paymentAccountId,
          entryType: "debit",
          amount: Math.abs(data.amount),
        },
        {
          accountId: data.receivableAccountId,
          entryType: "credit",
          amount: Math.abs(data.amount),
        },
      ],
      data.note || "قيد دفعة عميل"
    ),
  });

  return data;
};

export const supplierPayment = async (paymentData: Payment) => {
  const data = await createPaymentInternal(paymentData);

  if (data.supplierId) {
    await updateSupplierInternal(data.supplierId, undefined, paymentData);
  }

  await postLedgerEntries([
    {
      accountId: data.payableAccountId,
      entryType: "debit",
      amount: Math.abs(data.amount),
    },
    {
      accountId: data.paymentAccountId,
      entryType: "credit",
      amount: Math.abs(data.amount),
    },
  ]);

  await createJournalEntryInternal({
    date: data.date,
    description: data.note || "قيد دفعة مورد",
    referenceType: "payment",
    referenceId: data.id,
    lines: toJournalLines(
      [
        {
          accountId: data.payableAccountId,
          entryType: "debit",
          amount: Math.abs(data.amount),
        },
        {
          accountId: data.paymentAccountId,
          entryType: "credit",
          amount: Math.abs(data.amount),
        },
      ],
      data.note || "قيد دفعة مورد"
    ),
  });

  return data;
};

export const handleSupplierReturn = async (newReturn: {
  productCode: string;
  supplierId: string;
  warehouse: string;
  qty: number;
  returnValue: number;
  referenceId: string;
  partValue: number;
  productId: string;
  returnType: "debt" | "cash" | "part";
  reason: string;
  inventoryAccountId?: string;
  payableAccountId?: string;
  paymentAccountId?: string;
}) => {
  try {
    const returnQty = Math.abs(Number(newReturn.qty || 0));

    if (!returnQty) {
      throw new Error("كمية الإرجاع غير صحيحة");
    }

    await createReturnInternal({
      ...newReturn,
      qty: returnQty,
      type: "purchase-return",
    });

    const paymentAmount =
      newReturn.returnType === "cash"
        ? newReturn.returnValue
        : newReturn.returnType === "part"
        ? newReturn.partValue
        : 0;

    await createPaymentInternal({
      type: "return",
      supplierId: newReturn.supplierId,
      paymentAccountId: newReturn.paymentAccountId,
      payableAccountId: newReturn.payableAccountId,
      amount: paymentAmount,
      note: `اعادة منتجات للمورد (${newReturn.productCode})`,
      currency: "USD",
      exchangeRate: 0,
      amount_base: 0,
    });

    let balanceChange = 0;
    if (newReturn.returnType === "debt") {
      balanceChange = -newReturn.returnValue;
    } else if (newReturn.returnType === "part") {
      balanceChange = -(newReturn.returnValue - newReturn.partValue);
    }

    await updateSupplierBalanceInternal(newReturn.supplierId, balanceChange);

    await postLedgerEntries([
      {
        accountId: newReturn.paymentAccountId,
        entryType: "debit",
        amount: paymentAmount,
      },
      {
        accountId: newReturn.payableAccountId,
        entryType: "debit",
        amount: Math.max(newReturn.returnValue - paymentAmount, 0),
      },
      {
        accountId: newReturn.inventoryAccountId,
        entryType: "credit",
        amount: newReturn.returnValue,
      },
    ]);

    const purchaseData = await getPurchaseByIdInternal(newReturn.referenceId);
    const updatedQuantity = Math.max(
      Number(purchaseData?.quantity || 0) - returnQty,
      0
    );

    await updatePurchaseInternal(newReturn.referenceId, {
      quantity: updatedQuantity,
    });

    return { success: true, message: "تمت عملية الإرجاع بنجاح" };
  } catch (error) {
    console.error("خطأ في عملية إرجاع المورد:", error);
    return { success: false, message: "فشلت عملية الإرجاع", error };
  }
};

export const handleCustomerReturn = async (newReturn: {
  productCode: string;
  customerId: string;
  warehouse: string;
  qty: number;
  returnValue: number;
  referenceId: string;
  productId: string;
  returnType: "debt" | "cash" | "part";
  partValue: number;
  reason: string;
  paymentAccountId?: string;
  receivableAccountId?: string;
  salesAccountId?: string;
}) => {
  const returnQty = Math.abs(Number(newReturn.qty || 0));
  if (!returnQty) {
    throw new Error("كمية الإرجاع غير صحيحة");
  }

  const returnableProduct = await getReturnableProductFromSellInternal(
    newReturn.referenceId,
    newReturn.productCode,
    newReturn.warehouse
  );

  if (!returnableProduct) {
    throw new Error("المنتج غير موجود في فاتورة البيع");
  }

  if (returnQty > returnableProduct.qty) {
    throw new Error("كمية الإرجاع أكبر من الكمية المتبقية في الفاتورة");
  }

  const returnValue = returnQty * returnableProduct.sellPrice;
  const refundedCash =
    newReturn.returnType === "cash"
      ? returnValue
      : newReturn.returnType === "part"
      ? newReturn.partValue
      : 0;

  await createReturnInternal({
    ...newReturn,
    qty: returnQty,
    returnValue,
    type: "sale-return",
  });

  await createPaymentInternal({
    type: "return",
    customerId: newReturn.customerId,
    paymentAccountId: newReturn.paymentAccountId,
    receivableAccountId: newReturn.receivableAccountId,
    salesAccountId: newReturn.salesAccountId,
    amount:
      -(newReturn.returnType === "cash"
        ? returnValue
        : newReturn.returnType === "part"
        ? newReturn.partValue
        : 0),
    note: `اعادة منتجات من الزبون (${newReturn.productCode} عدد ${newReturn.qty})`,
    currency: "USD",
    exchangeRate: 0,
    amount_base: 0,
  });

  await postLedgerEntries([
    {
      accountId: newReturn.salesAccountId,
      entryType: "debit",
      amount: returnValue,
    },
    {
      accountId: newReturn.paymentAccountId,
      entryType: "credit",
      amount: refundedCash,
    },
    {
      accountId: newReturn.receivableAccountId,
      entryType: "credit",
      amount: Math.max(returnValue - refundedCash, 0),
    },
  ]);

  if (newReturn.returnType === "debt") {
    const updatedCustomer = await updateCustomerBalanceInternal(
      newReturn.customerId,
      returnValue
    );
    if (!updatedCustomer) {
      throw new Error("الزبون غير موجود لتحديث الرصيد");
    }
  } else if (newReturn.returnType === "part") {
    const updatedCustomer = await updateCustomerBalanceInternal(
      newReturn.customerId,
      returnValue - newReturn.partValue
    );
    if (!updatedCustomer) {
      throw new Error("الزبون غير موجود لتحديث الرصيد");
    }
  } else {
    const updatedCustomer = await updateCustomerBalanceInternal(
      newReturn.customerId,
      0
    );
    if (!updatedCustomer) {
      throw new Error("الزبون غير موجود لتحديث الرصيد");
    }
  }

  await returnProductsFromSellInternal(newReturn.referenceId, [
    {
      code: newReturn.productCode,
      warehouse: newReturn.warehouse,
      qty: returnQty,
    },
  ]);

  return { success: true, message: "تمت عملية الإرجاع بنجاح" };
};

export const warehouseTransfer = async (transferData: {
  productId: string;
  oldWarehouse: string;
  newWarehouse: string;
  exchangeRate: number;
  amount_base: number;
  amount: number;
  currency: string;
  quantity: number;
  note: string;
  newSellPrice?: number;
  paymentStatus?: "cash" | "debt" | "part";
  partValue?: number;
  expenseAccountId?: string;
  paymentAccountId?: string;
  payableAccountId?: string;
}) => {
  try {
    const product = await getProductByIdInternal(transferData.productId);

    if (product?.message) {
      return product.message;
    }

    const currentStock = Number(product.product.quantity || 0);
    const stockAfter = currentStock - transferData.quantity;

    if (stockAfter < 0) {
      throw new Error("الكمية غير كافية في المستودع");
    }

    await createTransferInternal({
      productId: transferData.productId,
      code: product.product.code,
      name: product.product.name,
      oldWarehouse: transferData.oldWarehouse,
      newWarehouse: transferData.newWarehouse,
      quantity: transferData.quantity,
      amount: transferData.amount,
      currency: transferData.currency,
      stockBefore: currentStock,
      stockAfter,
      performedBy: "admin",
      referenceId: `TR-${Date.now()}`,
      note: transferData.note,
    });

    await updateQuantityOnSell(
      transferData.productId,
      transferData.oldWarehouse,
      transferData.quantity
    );

    await createOrUpdateProductInternal({
      ...product.product,
      warehouse: transferData.newWarehouse,
      quantity: transferData.quantity,
      sellPrice: transferData.newSellPrice || product.product.sellPrice,
    });

    if (transferData.amount > 0) {
      const paymentStatus = transferData.paymentStatus || "cash";
      const paidAmount =
        paymentStatus === "cash"
          ? transferData.amount
          : paymentStatus === "part"
          ? Number(transferData.partValue || 0)
          : 0;
      const payableAmount = Math.max(transferData.amount - paidAmount, 0);

      if (paidAmount > 0) {
        await createPaymentInternal({
        type: "expense",
        supplierId: "transfer",
        expenseAccountId: transferData.expenseAccountId,
        paymentAccountId: transferData.paymentAccountId,
        currency: transferData.currency,
        exchangeRate: transferData.exchangeRate,
        amount_base:
          transferData.currency === "USD"
            ? -paidAmount
            : -(paidAmount * transferData.exchangeRate),
        amount: Number(-paidAmount),
        note:
          `نقل ${product.product.name} // ${transferData.note}` ||
          `Transfer: ${product.product.name || transferData.productId}`,
        });
      }

      await postLedgerEntries([
        {
          accountId: transferData.expenseAccountId,
          entryType: "debit",
          amount: transferData.amount,
        },
        {
          accountId: transferData.paymentAccountId,
          entryType: "credit",
          amount: paidAmount,
        },
        {
          accountId: transferData.payableAccountId,
          entryType: "credit",
          amount: payableAmount,
        },
      ]);
    }
  } catch (err) {
    console.log(err);
    return err;
  }
};
