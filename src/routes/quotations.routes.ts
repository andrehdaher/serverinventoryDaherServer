import express from "express";
import {
  createQuotation,
  deleteQuotation,
  getAllQuotations,
  getQuotationById,
  markQuotationConverted,
  updateQuotation,
} from "../controllers/quotations.controller";

const router = express.Router();

router.get("/", getAllQuotations);
router.get("/:id", getQuotationById);
router.post("/", createQuotation);
router.put("/:id", updateQuotation);
router.delete("/:id", deleteQuotation);
router.post("/:id/converted", markQuotationConverted);

export default router;
