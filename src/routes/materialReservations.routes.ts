import express from "express";
import {
  cancelMaterialReservation,
  closeMaterialReservation,
  createMaterialReservation,
  getAllMaterialReservations,
  getMaterialReservation,
} from "../controllers/materialReservations.controller";

const router = express.Router();

router.get("/", getAllMaterialReservations);
router.get("/:id", getMaterialReservation);
router.post("/", createMaterialReservation);
router.post("/:id/close", closeMaterialReservation);
router.post("/:id/cancel", cancelMaterialReservation);

export default router;
