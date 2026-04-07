
import express from 'express';
import {
  allData,
  getLatestResponse,
  getPreviousSnapshot,
  saveSnapshot,
} from "../controllers/ai.controller";


const router = express.Router();

router.put('/snapshot/save', saveSnapshot);
router.get("/snapshot/previous", getPreviousSnapshot);

router.get('/latest', getLatestResponse);
router.get('/allData', allData);
export default router;

