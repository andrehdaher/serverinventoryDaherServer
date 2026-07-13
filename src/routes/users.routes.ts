import express from "express";
import {
  createUser,
  deleteUser,
  getAllUsers,
  updateUser,
} from "../controllers/users.controller";

const router = express.Router();

router.get("/", getAllUsers);
router.post("/", createUser);
router.put("/:id", updateUser);
router.delete("/:id", deleteUser);

export default router;
