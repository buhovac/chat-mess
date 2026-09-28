import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { socket } from "../../lib/socket.js";
import { useToast } from "../../components/Toast.jsx";
import { useAuth } from "../auth/AuthProvider.jsx";
import { useActiveConversation } from "../conversations/ActiveConversationContext.jsx";

const PREVIEW_MAX_LENGTH = 80;

function preview(content) {
  return content.length > PREVIEW_MAX_LENGTH ? `${content.slice(0, PREVIEW_MAX_LENGTH)}…` : content;
}

// Mounted once in AppShell (outside the router outlet), so it keeps
// listening no matter which conversation route is open. MessageList's own
// "message:new" listener only cares about the conversation it renders —
// this one is the opposite: every OTHER conversation.
export function NotificationListener() {
  const navigate = useNavigate();
  const showToast = useToast();
  const { user } = useAuth();
  const { activeConversationId } = useActiveConversation();

  useEffect(() => {
    function handleNewMessage({ conversationId, message }) {
      if (message.kind !== "TEXT") return;
      if (message.sender?.id === user.id) return;
      if (conversationId === activeConversationId) return;

      showToast({
        text: `${message.sender?.displayName ?? "Utilisateur supprimé"} : ${preview(message.content)}`,
        onClick: () => navigate(`/app/${conversationId}`),
      });
    }

    socket.on("message:new", handleNewMessage);
    return () => socket.off("message:new", handleNewMessage);
  }, [activeConversationId, navigate, showToast, user.id]);

  return null;
}
