
import express from 'express';
import { generateResponse, test  } from "../controllers/ai.controller";


const router = express.Router();

router.post('/generate', generateResponse);
router.get('/test' , test)

export default router;

