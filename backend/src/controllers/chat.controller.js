import { generateStreamToken, upsertStreamUser } from "../lib/stream.js";
import User from "../models/user.js";

export const getStreamToken = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Ensure user exists in Stream
    await upsertStreamUser(user._id, user.fullName, user.profilePic);

    const token = generateStreamToken(user._id);
    if (!token) {
      throw new Error("Failed to generate token");
    }

    res.status(200).json({ token });
  } catch (error) {
    console.error("Error generating Stream token:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const sendNotification = async (req, res) => {
  try {
    const { recipientId, message, type } = req.body;
    const sender = await User.findById(req.user.id);
    
    if (!sender) {
      return res.status(404).json({ message: "Sender not found" });
    }

    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ message: "Recipient not found" });
    }

    // Create notification in Stream
    const channelId = [sender._id, recipientId].sort().join("-");
    const channel = streamClient.channel("messaging", channelId);

    await channel.create();
    await channel.addMembers([sender._id, recipientId]);

    // Send notification message
    await channel.sendMessage({
      text: message,
      type: type || "notification",
      user: {
        id: sender._id,
        name: sender.fullName,
        image: sender.profilePic,
      },
    });

    res.status(200).json({ message: "Notification sent successfully" });
  } catch (error) {
    console.error("Error sending notification:", error);
    res.status(500).json({ message: "Failed to send notification" });
  }
};