import express from 'express';
import { protectRoute } from '../middleware/auth.middleware.js';
import { acceptFriendRequest, getFriendRequests, getMyFriends, getOutgoingFriendReqs, getRecommandedUsers, sendFriendRequest, getLatestChats } from '../controllers/user.controller.js';

const router = express.Router();

router.use(protectRoute);

router.get('/', getRecommandedUsers);
router.get('/friends', getMyFriends);

router.post('/friend-request/:id', sendFriendRequest);
router.put('/friend-request/:id/accept', acceptFriendRequest);

router.get('/friend-requests', getFriendRequests);
router.get('/outgoing-friend-requests', getOutgoingFriendReqs);

router.get('/latest-chats', getLatestChats);

export default router;