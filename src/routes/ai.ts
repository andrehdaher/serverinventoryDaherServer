
import express from 'express';
import {
  allData,
  generateResponse,
  getLatestResponse,
} from "../controllers/ai.controller";


const router = express.Router();

router.post('/generate', generateResponse);
router.get('/latest', getLatestResponse);
router.get('/allData', allData);
export default router;

