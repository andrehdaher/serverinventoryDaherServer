import { Router } from "express";
import {
  createExchangeInternal,
  getAllExchange,
} from "../controllers/exchange.controller";

const router = Router();

router.get("/getAll", getAllExchange);
router.post("/createExchangeInternal", createExchangeInternal);

export default router;
