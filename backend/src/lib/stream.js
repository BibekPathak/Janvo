import { StreamChat } from "stream-chat";
import "dotenv/config";

const apiKey = process.env.STREAM_API_KEY;
const apiSecret = process.env.STREAM_API_SECRET;

if (!apiKey || !apiSecret) {
  console.error("Stream API key or Secret is missing");
}

const streamClient = StreamChat.getInstance(apiKey, apiSecret);

export const generateStreamToken = (userId) => {
  try {
    // Ensure userId is a string
    const stringUserId = userId.toString();
    return streamClient.createToken(stringUserId);
  } catch (error) {
    console.error("Error generating Stream token:", error);
    return null;
  }
};

export const upsertStreamUser = async (userId, name, image) => {
  try {
    // Ensure userId is a string
    const stringUserId = userId.toString();
    
    // Create or update user in Stream
    await streamClient.upsertUser({
      id: stringUserId,
      name: name,
      image: image,
    });
    
    return true;
  } catch (error) {
    console.error("Error upserting Stream user:", error);
    throw error;
  }
};