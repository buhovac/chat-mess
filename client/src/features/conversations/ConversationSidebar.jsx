import { useCallback, useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { api } from "../../lib/api.js";
import { socket } from "../../lib/socket.js";
import { relativeTime } from "../../lib/relativeTime.js";
import { NewConversationDialog } from "./NewConversationDialog.jsx";

export function ConversationSidebar() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const loadConversations = useCallback(() => {
    return api
      .get("/api/conversations")
      .then((data) => setConversations(data.conversations))
      .catch(() => setConversations([]));
  }, []);

  useEffect(() => {
    loadConversations().finally(() => setLoading(false));
  }, [loadConversations]);

  // Global listener (not scoped to the open conversation): keeps the
  // sidebar preview live even for conversations the user isn't currently
  // viewing. A refetch is simpler and plenty fast enough than hand-merging
  // the changed conversation into local state.
  useEffect(() => {
    socket.on("message:new", loadConversations);
    return () => socket.off("message:new", loadConversations);
  }, [loadConversations]);

  function handleConversationReady(conversation) {
    setDialogOpen(false);
    loadConversations();
    return conversation;
  }

  return (
    <nav className="conversation-sidebar">
      <button className="new-conversation-button" onClick={() => setDialogOpen(true)}>
        Nouvelle conversation
      </button>

      {loading && <p className="conversation-list-empty">Chargement...</p>}
      {!loading && conversations.length === 0 && (
        <p className="conversation-list-empty">Aucune conversation pour l'instant.</p>
      )}

      <ul className="conversation-list">
        {conversations.map((conversation) => (
          <li key={conversation.id}>
            <NavLink
              to={`/app/${conversation.id}`}
              className={({ isActive }) => `conversation-item${isActive ? " conversation-item--active" : ""}`}
            >
              <span className="conversation-item-name">{conversation.name}</span>
              {conversation.lastMessage && (
                <span className="conversation-item-preview">
                  {conversation.lastMessage.content} · {relativeTime(conversation.lastMessage.createdAt)}
                </span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>

      {dialogOpen && (
        <NewConversationDialog onClose={() => setDialogOpen(false)} onConversationReady={handleConversationReady} />
      )}
    </nav>
  );
}
