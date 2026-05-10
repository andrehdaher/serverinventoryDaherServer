
import express from 'express';
import {
  allData,
  getLatestResponse,
  getSnapshot,
  saveSnapshot,
} from "../controllers/ai.controller";
import { askAI } from "../controllers/aiAsk.controller";


const router = express.Router();

router.post('/ask', askAI);
router.put('/snapshot/save', saveSnapshot);
router.get("/snapshot/get", getSnapshot);
router.get('/latest', getLatestResponse);
router.get('/allData', allData);
export default router;
