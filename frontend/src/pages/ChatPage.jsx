import { useEffect, useState } from "react";
import { useParams } from "react-router";
import useAuthUser from "../hooks/useAuthUser";
import { useQuery } from "@tanstack/react-query";
import { getStreamToken } from "../lib/api";

import {
  Channel,
  ChannelHeader,
  Chat,
  MessageInput,
  MessageList,
  Thread,
  Window,
  MessageStatus,
  SearchInput,
  SearchResults,
} from "stream-chat-react";
import { StreamChat } from "stream-chat";
import toast from "react-hot-toast";

import ChatLoader from "../components/ChatLoader";
import CallButton from "../components/CallButton";

const STREAM_API_KEY = import.meta.env.VITE_STREAM_API_KEY;

const ChatPage = () => {
  const { id: targetUserId } = useParams();

  const [chatClient, setChatClient] = useState(null);
  const [channel, setChannel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [notifications, setNotifications] = useState([]);

  const { authUser } = useAuthUser();

  const { data: tokenData } = useQuery({
    queryKey: ["streamToken"],
    queryFn: getStreamToken,
    enabled: !!authUser,
  });

  useEffect(() => {
    const initChat = async () => {
      if (!tokenData?.token || !authUser) {
        console.log("Missing token or auth user:", { token: !!tokenData?.token, authUser: !!authUser });
        return;
      }

      try {
        console.log("Initializing stream chat client...", {
          userId: authUser._id,
          targetUserId,
          apiKey: STREAM_API_KEY ? "present" : "missing"
        });

        const client = StreamChat.getInstance(STREAM_API_KEY);

        await client.connectUser(
          {
            id: authUser._id,
            name: authUser.fullName,
            image: authUser.profilePic,
          },
          tokenData.token
        );

        console.log("User connected to Stream");

        const channelId = [authUser._id, targetUserId].sort().join("-");
        console.log("Creating channel with ID:", channelId);

        const currChannel = client.channel("messaging", channelId, {
          members: [authUser._id, targetUserId],
          read: { user_id: authUser._id },
        });

        await currChannel.watch();
        console.log("Channel watched successfully");

        // Listen for typing events
        currChannel.on('typing.start', (event) => {
          if (event.user.id !== authUser._id) {
            setTypingUsers((prev) => [...prev, event.user]);
          }
        });

        currChannel.on('typing.stop', (event) => {
          setTypingUsers((prev) => prev.filter((user) => user.id !== event.user.id));
        });

        // Listen for new messages
        currChannel.on('message.new', (event) => {
          if (event.message.type === 'notification') {
            setNotifications((prev) => [...prev, event.message]);
            toast(event.message.text, {
              icon: '🔔',
              duration: 5000,
            });
          }
        });

        setChatClient(client);
        setChannel(currChannel);
      } catch (error) {
        console.error("Error initializing chat:", error);
        toast.error("Could not connect to chat. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    initChat();
  }, [tokenData, authUser, targetUserId]);

  const handleSearch = async (query) => {
    if (!query.trim() || !channel) return;

    setIsSearching(true);
    try {
      const results = await channel.search({
        query,
        limit: 20,
      });
      setSearchResults(results.results);
    } catch (error) {
      console.error("Error searching messages:", error);
      toast.error("Failed to search messages");
    } finally {
      setIsSearching(false);
    }
  };

  const handleVideoCall = () => {
    if (channel) {
      const callUrl = `${window.location.origin}/call/${channel.id}`;

      channel.sendMessage({
        text: `I've started a video call. Join me here: ${callUrl}`,
      });

      toast.success("Video call link sent successfully!");
    }
  };

  if (loading || !chatClient || !channel) return <ChatLoader />;

  return (
    <div className="h-[93vh]">
      <Chat client={chatClient}>
        <Channel channel={channel}>
          <div className="w-full relative">
            <CallButton handleVideoCall={handleVideoCall} />
            <Window>
              <ChannelHeader />
              <div className="px-4 py-2 border-b">
                <SearchInput
                  placeholder="Search messages..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    handleSearch(e.target.value);
                  }}
                />
              </div>
              {searchQuery && (
                <div className="px-4 py-2 bg-gray-50">
                  {isSearching ? (
                    <div className="text-sm text-gray-500">Searching...</div>
                  ) : searchResults.length > 0 ? (
                    <div className="space-y-2">
                      {searchResults.map((result) => (
                        <div
                          key={result.id}
                          className="p-2 hover:bg-gray-100 rounded cursor-pointer"
                          onClick={() => {
                            // Scroll to message
                            const messageElement = document.querySelector(`[data-message-id="${result.id}"]`);
                            if (messageElement) {
                              messageElement.scrollIntoView({ behavior: "smooth" });
                            }
                          }}
                        >
                          <div className="text-sm font-medium">{result.user.name}</div>
                          <div className="text-sm text-gray-600">{result.text}</div>
                          <div className="text-xs text-gray-400">
                            {new Date(result.created_at).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">No messages found</div>
                  )}
                </div>
              )}
              <MessageList MessageStatus={MessageStatus} />
              {typingUsers.length > 0 && (
                <div className="px-4 py-2 text-sm text-gray-500">
                  {typingUsers.map((user) => user.name).join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...
                </div>
              )}
              <MessageInput focus />
            </Window>
          </div>
          <Thread />
        </Channel>
      </Chat>
    </div>
  );
};

export default ChatPage;