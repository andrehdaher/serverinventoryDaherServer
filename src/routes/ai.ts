
import express from 'express';
import {
  allData,
  getLatestResponse,
  getSnapshot,
  saveAiReport,
} from "../controllers/ai.controller";
import { askAI } from "../controllers/aiAsk.controller";


const router = express.Router();

router.post('/ask', askAI);
router.post('/save', saveAiReport);
router.put('/save', saveAiReport);
router.put('/snapshot/save', saveAiReport);
router.get("/snapshot/get", getSnapshot);
router.get('/latest', getLatestResponse);
router.get('/allData', allData);
router.post('/snapshot', saveAiReport);
export default router;
