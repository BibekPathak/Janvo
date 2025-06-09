import express from 'express';
import { getStreamToken, sendNotification } from '../controllers/chat.controller.js';
import { protectRoute } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/token', protectRoute, getStreamToken);
router.post("/notify", protectRoute, sendNotification);

export default router;