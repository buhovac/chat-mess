import { useEffect, useRef, useState } from "react";
import { api } from "../../lib/api.js";
import { socket } from "../../lib/socket.js";
import { relativeTime } from "../../lib/relativeTime.js";
import { useAuth } from "../auth/AuthProvider.jsx";
import { PlanBadge } from "../../components/PlanBadge.jsx";

// Merge an incoming message into the list, matching on id first (the normal
// case) and falling back to clientTempId — that's what lets the ack and the
// "message:new" broadcast (which race each other for the sender) both
// resolve to the same list entry instead of rendering the bubble twice.
function upsertMessage(messages, incoming) {
  const index = messages.findIndex(
    (m) => m.id === incoming.id || (incoming.clientTempId && m.clientTempId === incoming.clientTempId),
  );
  if (index === -1) {
    return [...messages, incoming];
  }
  const next = [...messages];
  next[index] = incoming;
  return next;
}

export function MessageList({ conversationId }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setLoading(true);
    api
      .get(`/api/conversations/${conversationId}/messages`)
      .then((data) => setMessages(data.messages))
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }, [conversationId]);

  useEffect(() => {
    function handleNewMessage({ conversationId: incomingConversationId, message, clientTempId }) {
      if (incomingConversationId !== conversationId) return;
      setMessages((prev) => upsertMessage(prev, { ...message, clientTempId, pending: false }));
    }

    socket.on("message:new", handleNewMessage);
    return () => socket.off("message:new", handleNewMessage);
  }, [conversationId]);

  function handleSend() {
    const content = draft.trim();
    if (!content) return;

    const clientTempId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      {
        id: clientTempId,
        clientTempId,
        content,
        createdAt: new Date().toISOString(),
        sender: { id: user.id, displayName: user.displayName, plan: user.plan },
        pending: true,
      },
    ]);
    setDraft("");

    socket.emit("message:send", { conversationId, content, clientTempId }, (res) => {
      if (res?.ok) {
        setMessages((prev) => upsertMessage(prev, { ...res.message, clientTempId, pending: false }));
      } else {
        // Failed send: drop the optimistic bubble rather than leave a
        // permanently-pending one with no way to retry in this stage.
        setMessages((prev) => prev.filter((m) => m.clientTempId !== clientTempId));
      }
    });
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="message-panel">
      {loading && <p className="conversation-list-empty">Chargement des messages...</p>}
      {!loading && messages.length === 0 && (
        <p className="conversation-list-empty">Aucun message pour l'instant.</p>
      )}

      {!loading && messages.length > 0 && (
        <ul className="message-list">
          {messages.map((message) =>
            message.kind === "SYSTEM" ? (
              <li key={message.id} className="system-message">
                {message.content}
              </li>
            ) : (
              <li
                key={message.id}
                className={`message-bubble${message.sender?.id === user.id ? " message-bubble--own" : ""}${message.pending ? " message-bubble--pending" : ""}`}
              >
                <span className="message-sender">
                  {message.sender?.displayName ?? "Utilisateur supprimé"}
                  <PlanBadge plan={message.sender?.plan} />
                </span>
                <p className="message-content">{message.content}</p>
                <span className="message-time">{message.pending ? "Envoi..." : relativeTime(message.createdAt)}</span>
              </li>
            ),
          )}
        </ul>
      )}

      <div className="composer">
        <textarea
          className="composer-textarea"
          placeholder="Écrire un message... (Entrée pour envoyer, Maj+Entrée pour une nouvelle ligne)"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button className="composer-send-button" onClick={handleSend} disabled={!draft.trim()}>
          Envoyer
        </button>
      </div>
    </div>
  );
}
