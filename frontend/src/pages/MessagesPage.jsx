import { useQuery } from "@tanstack/react-query";
import { getLatestChats } from "../lib/api"; // Assuming you have an API function to fetch latest chats
import { useNavigate } from "react-router";
import useAuthUser from "../hooks/useAuthUser";
import { formatDistanceToNow } from "date-fns";

const MessagesPage = () => {
  const navigate = useNavigate();
  const { authUser } = useAuthUser();
  const { data: chats = [], isLoading } = useQuery({
    queryKey: ["latestChats"],
    queryFn: getLatestChats,
  });

  const handleChatClick = (chatId) => {
    // Extract the friend's ID from the chat ID
    // Chat ID format is "userId1-userId2" where IDs are sorted alphabetically
    const [id1, id2] = chatId.split("-");
    const friendId = id1 === authUser._id ? id2 : id1;
    navigate(`/chat/${friendId}`);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="container mx-auto space-y-10">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-6">Latest Messages</h2>
        {isLoading ? (
          <div className="flex justify-center py-12">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : chats.length === 0 ? (
          <div className="card bg-base-200 p-6 text-center">
            <h3 className="font-semibold text-lg mb-2">No messages yet</h3>
            <p className="text-base-content opacity-70">
              Start a conversation with your friends!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {chats.map((chat) => (
              <div
                key={chat._id}
                className="card bg-base-200 p-4 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleChatClick(chat._id)}
              >
                <div className="flex items-center gap-3">
                  <div className="avatar size-10 relative">
                    <img src={chat.friend.profilePic} alt={chat.friend.fullName} />
                    <span 
                      className={`absolute bottom-0 right-0 size-3 rounded-full border-2 border-base-200 ${
                        chat.friend.isOnline ? "bg-success" : "bg-base-content opacity-50"
                      }`}
                      title={chat.friend.isOnline ? "Online" : "Offline"}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h3 className="font-semibold">{chat.friend.fullName}</h3>
                      <span className="text-xs opacity-70">
                        {chat.lastMessageAt ? formatDistanceToNow(new Date(chat.lastMessageAt), { addSuffix: true }) : ""}
                      </span>
                    </div>
                    <p className="text-sm opacity-70 truncate">{chat.lastMessage}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessagesPage; 