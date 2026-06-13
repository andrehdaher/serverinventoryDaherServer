import { Router } from "express";
import { getAllDoneExchange } from "../controllers/exchange.controller";

const router = Router();

router.get("/getAll", getAllDoneExchange);

export default router;
