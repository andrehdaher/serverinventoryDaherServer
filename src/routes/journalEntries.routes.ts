import express from "express";
import {
  createJournalEntry,
  getJournalEntries,
} from "../controllers/journalEntries.controller";

const router = express.Router();

router.get("/", getJournalEntries);
router.post("/create", createJournalEntry);

export default router;
