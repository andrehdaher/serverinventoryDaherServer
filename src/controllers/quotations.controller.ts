import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { get, ref, remove, set, update } from "firebase/database";
import { database } from "../firebaseConfig";
import {
  Quotation,
  QuotationProduct,
  QuotationStatus,
} from "../types/quotation";

const toNumber = (value: unknown, fallback = 0) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const nowIso = () => new Date().toISOString();

const stripUndefined = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map(stripUndefined) as T;
  }

  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).reduce(
      (cleaned, [key, entryValue]) => {
        if (entryValue !== undefined) {
          cleaned[key] = stripUndefined(entryValue);
        }

        return cleaned;
      },
      {} as Record<string, unknown>,
    ) as T;
  }

  return value;
};

const normalizeStatus = (status: unknown): QuotationStatus => {
  const nextStatus = String(status || "draft");

  if (
    ["draft", "sent", "accepted", "rejected", "converted"].includes(
      nextStatus,
    )
  ) {
    return nextStatus as QuotationStatus;
  }

  return "draft";
};

const normalizeProduct = (product: any): QuotationProduct => ({
  id: String(product?.id || product?.productId || ""),
  productId: product?.productId ? String(product.productId) : undefined,
  name: String(product?.name || product?.productName || ""),
  code: String(product?.code || product?.productCode || ""),
  category: product?.category ? String(product.category) : undefined,
  warehouse: String(product?.warehouse || ""),
  quantity:
    product?.quantity === undefined ? undefined : toNumber(product.quantity),
  reservedQuantity:
    product?.reservedQuantity === undefined
      ? undefined
      : toNumber(product.reservedQuantity),
  qty: toNumber(product?.qty, 1),
  payPrice: product?.payPrice === undefined ? undefined : toNumber(product.payPrice),
  sellPrice: toNumber(product?.sellPrice),
  unit: product?.unit ? String(product.unit) : undefined,
  updatedDate: product?.updatedDate ? String(product.updatedDate) : undefined,
  alertQuantity:
    product?.alertQuantity === undefined
      ? undefined
      : toNumber(product.alertQuantity),
});

const buildQuotationNumber = () => `Q-${Date.now()}`;

const normalizeQuotation = (
  rawQuotation: Partial<Quotation>,
  previous?: Quotation | null,
): Quotation => {
  const products = Array.isArray(rawQuotation.products)
    ? rawQuotation.products.map(normalizeProduct)
    : previous?.products || [];
  const subtotal = products.reduce(
    (sum, product) => sum + toNumber(product.qty) * toNumber(product.sellPrice),
    0,
  );
  const discount = Math.max(toNumber(rawQuotation.discount ?? previous?.discount), 0);
  const totalPrice = Math.max(Number((subtotal - discount).toFixed(3)), 0);
  const now = nowIso();

  return stripUndefined({
    ...previous,
    ...rawQuotation,
    number:
      rawQuotation.number || previous?.number || buildQuotationNumber(),
    customerId:
      rawQuotation.customerId === undefined
        ? previous?.customerId
        : String(rawQuotation.customerId || ""),
    customerName: String(
      rawQuotation.customerName || previous?.customerName || "",
    ),
    customerNumber:
      rawQuotation.customerNumber === undefined
        ? previous?.customerNumber
        : String(rawQuotation.customerNumber || ""),
    products,
    subtotal,
    discount,
    totalPrice,
    currency: String(rawQuotation.currency || previous?.currency || "USD"),
    exchangeRate: toNumber(
      rawQuotation.exchangeRate ?? previous?.exchangeRate,
      1,
    ),
    status: normalizeStatus(rawQuotation.status || previous?.status),
    validUntil:
      rawQuotation.validUntil === undefined
        ? previous?.validUntil
        : String(rawQuotation.validUntil || ""),
    note:
      rawQuotation.note === undefined
        ? previous?.note
        : String(rawQuotation.note || ""),
    convertedSellId:
      rawQuotation.convertedSellId === undefined
        ? previous?.convertedSellId
        : String(rawQuotation.convertedSellId || ""),
    date: previous?.date || now,
    createdAt: previous?.createdAt || now,
    updatedAt: now,
  });
};

export const getAllQuotations = async (_req: Request, res: Response) => {
  try {
    const snapshot = await get(ref(database, "quotations"));
    const quotations = snapshot.exists()
      ? (Object.values(snapshot.val()) as Quotation[])
      : [];

    res.json(
      quotations.sort(
        (a, b) =>
          new Date(b.updatedAt || b.date || 0).getTime() -
          new Date(a.updatedAt || a.date || 0).getTime(),
      ),
    );
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getQuotationById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const snapshot = await get(ref(database, `quotations/${id}`));

    if (!snapshot.exists()) {
      return res.status(404).json({ message: "Quotation not found" });
    }

    res.json(snapshot.val());
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const createQuotation = async (req: Request, res: Response) => {
  try {
    const id = uuidv4();
    const quotation = normalizeQuotation(req.body || {});

    if (!quotation.customerName) {
      return res.status(400).json({ message: "Customer name is required" });
    }

    if (!quotation.products.length) {
      return res
        .status(400)
        .json({ message: "Quotation must include at least one product" });
    }

    const quotationToSave: Quotation = {
      ...quotation,
      id,
    };

    await set(ref(database, `quotations/${id}`), quotationToSave);
    res.status(201).json(quotationToSave);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const updateQuotation = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const quotationRef = ref(database, `quotations/${id}`);
    const snapshot = await get(quotationRef);

    if (!snapshot.exists()) {
      return res.status(404).json({ message: "Quotation not found" });
    }

    const updatedQuotation = normalizeQuotation(
      req.body || {},
      snapshot.val() as Quotation,
    );

    await set(quotationRef, { ...updatedQuotation, id });
    res.json({ ...updatedQuotation, id });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteQuotation = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await remove(ref(database, `quotations/${id}`));
    res.json({ message: "Quotation deleted" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const markQuotationConverted = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { sellId } = req.body || {};
    const quotationRef = ref(database, `quotations/${id}`);
    const snapshot = await get(quotationRef);

    if (!snapshot.exists()) {
      return res.status(404).json({ message: "Quotation not found" });
    }

    await update(quotationRef, {
      status: "converted",
      convertedSellId: sellId || "",
      updatedAt: nowIso(),
    });

    const updatedSnapshot = await get(quotationRef);
    res.json(updatedSnapshot.val());
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};
