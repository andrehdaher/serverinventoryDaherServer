
import express from 'express';
import { generateResponse } from "../controllers/ai.controller";


const router = express.Router();

router.post('/generate', generateResponse);

export default router;

