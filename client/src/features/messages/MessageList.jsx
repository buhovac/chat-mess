import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import { relativeTime } from "../../lib/relativeTime.js";
import { useAuth } from "../auth/AuthProvider.jsx";

// Static fetch + render for this stage — no live updates, no composer.
// Those arrive with Socket.IO in the next stage.
export function MessageList({ conversationId }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/api/conversations/${conversationId}/messages`)
      .then((data) => setMessages(data.messages))
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }, [conversationId]);

  if (loading) {
    return <p className="conversation-list-empty">Chargement des messages...</p>;
  }

  if (messages.length === 0) {
    return <p className="conversation-list-empty">Aucun message pour l'instant.</p>;
  }

  return (
    <ul className="message-list">
      {messages.map((message) => (
        <li
          key={message.id}
          className={`message-bubble${message.sender?.id === user.id ? " message-bubble--own" : ""}`}
        >
          <span className="message-sender">{message.sender?.displayName ?? "Utilisateur supprimé"}</span>
          <p className="message-content">{message.content}</p>
          <span className="message-time">{relativeTime(message.createdAt)}</span>
        </li>
      ))}
    </ul>
  );
}
