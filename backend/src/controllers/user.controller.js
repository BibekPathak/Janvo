import FriendRequest from "../models/FriendRequest.js";
import User from "../models/user.js";
import { StreamChat } from "stream-chat";
import dotenv from "dotenv";
dotenv.config();

const streamClient = StreamChat.getInstance(process.env.STREAM_API_KEY, process.env.STREAM_API_SECRET);

export async function getRecommandedUsers(req, res) {
    try {
        const currentUser = req.user;
        const currentUserId = currentUser._id;

        const recommandedUsers= await User.find({
            $and: [
                { _id: { $ne: currentUserId } }, // Exclude current user
                { _id: { $nin: currentUser.friends } }, // Exclude friends
                {isOnboarded: true}
            ]
        })
        res.status(200).json(recommandedUsers);
    } catch (error) {
        console.error('Error fetching recommended users:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
}

export async function getMyFriends(req, res) {
    try {
        const user= await User.findById(req.user.id).select("friends").populate("friends", "fullName profilePic nativeLanguage learningLanguage");
        res.status(200).json(user.friends)
    } catch (error) {
        console.error('Error in getMyFriends controller:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
}

export async function sendFriendRequest(req, res) {
    try {
        const myId= req.user.id;
        const { id: recipientId } = req.params;

        if (myId === recipientId) {
            return res.status(400).json({ message: "You cannot send a friend request to yourself." });
        }

        const recipient = await User.findById(recipientId);
        if (!recipient) {
            return res.status(404).json({ message: "Recipient not found." });
        }

        // Check if the recipient is already a friend
        if (recipient.friends.includes(myId)) {
            return res.status(400).json({ message: "You are already friends with this user." });
        }

        // Check if a friend request already exists
        const existingRequest = await FriendRequest.findOne({
            $or: [
                { sender: myId, recipient: recipientId },
                { sender: recipientId, recipient: myId }
            ]
        });

        if (existingRequest) {
            return res.status(400).json({ message: "Friend request already exists." });
        }

        // Create a new friend request
        const newRequest = await FriendRequest.create({
            sender: myId,
            recipient: recipientId
        });

        res.status(201).json(newRequest);
    } catch (error) {
        console.error('Error in sendFriendRequest controller:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
}

export async function acceptFriendRequest(req, res) {
  try {
    const { id: requestId } = req.params;

    const friendRequest = await FriendRequest.findById(requestId);

    if (!friendRequest) {
      return res.status(404).json({ message: "Friend request not found" });
    }

    // Verify the current user is the recipient
    if (friendRequest.recipient.toString() !== req.user.id) {
      return res.status(403).json({ message: "You are not authorized to accept this request" });
    }

    friendRequest.status = "accepted";
    await friendRequest.save();

    // add each user to the other's friends array
    // $addToSet: adds elements to an array only if they do not already exist.
    await User.findByIdAndUpdate(friendRequest.sender, {
      $addToSet: { friends: friendRequest.recipient },
    });

    await User.findByIdAndUpdate(friendRequest.recipient, {
      $addToSet: { friends: friendRequest.sender },
    });

    res.status(200).json({ message: "Friend request accepted" });
  } catch (error) {
    console.log("Error in acceptFriendRequest controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function getFriendRequests(req, res) {
  try {
    const incomingReqs = await FriendRequest.find({
      recipient: req.user.id,
      status: "pending",
    }).populate("sender", "fullName profilePic nativeLanguage learningLanguage");

    const acceptedReqs = await FriendRequest.find({
      sender: req.user.id,
      status: "accepted",
    }).populate("recipient", "fullName profilePic");

    res.status(200).json({ incomingReqs, acceptedReqs });
  } catch (error) {
    console.log("Error in getPendingFriendRequests controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function getOutgoingFriendReqs(req, res) {
  try {
    const outgoingRequests = await FriendRequest.find({
      sender: req.user.id,
      status: "pending",
    }).populate("recipient", "fullName profilePic nativeLanguage learningLanguage");

    res.status(200).json(outgoingRequests);
  } catch (error) {
    console.log("Error in getOutgoingFriendReqs controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function getLatestChats(req, res) {
  try {
    const userId = req.user.id.toString();
    // Query channels where the user is a member
    const filters = { type: "messaging", members: { $in: [userId] } };
    const sort = [{ last_message_at: -1 }];
    const channels = await streamClient.queryChannels(filters, sort, { limit: 20 });

    // Get online users from Stream using presence
    const onlineUsers = await streamClient.queryUsers({
      presence: true,
      limit: 100
    });
    
    // Create a map of user IDs to their online status
    const onlineStatusMap = new Map();
    onlineUsers.users.forEach(user => {
      onlineStatusMap.set(user.id, user.online);
    });

    // For each channel, find the friend (other member), get their info, and the last message
    const chatSummaries = await Promise.all(
      channels.map(async (channel) => {
        const otherMemberId = channel.state.members
          ? Object.keys(channel.state.members).find((id) => id !== userId)
          : channel.data.members.find((id) => id !== userId);
        if (!otherMemberId) return null;
        const friend = await User.findById(otherMemberId).select("fullName profilePic");
        const lastMessage = channel.state.messages.length > 0
          ? channel.state.messages[channel.state.messages.length - 1].text
          : "";
        return {
          _id: channel.id,
          friend: friend ? {
            _id: friend._id,
            fullName: friend.fullName,
            profilePic: friend.profilePic,
            isOnline: onlineStatusMap.get(friend._id.toString()) || false,
          } : null,
          lastMessage,
          lastMessageAt: channel.state.last_message_at || channel.last_message_at,
        };
      })
    );
    res.status(200).json(chatSummaries.filter(Boolean));
  } catch (error) {
    console.error("Error in getLatestChats controller:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}