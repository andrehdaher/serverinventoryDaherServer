import express from "express";
import {
  checkoutMyInvoiceDraft,
  clearMyInvoiceDraft,
  getMyInvoiceDraft,
  updateMyInvoiceDraft,
} from "../controllers/invoiceDraft.controller";

const router = express.Router();

router.get("/me", getMyInvoiceDraft);
router.put("/me", updateMyInvoiceDraft);
router.delete("/me", clearMyInvoiceDraft);
router.post("/me/checkout", checkoutMyInvoiceDraft);

export default router;
