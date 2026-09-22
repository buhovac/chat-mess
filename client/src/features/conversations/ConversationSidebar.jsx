import { useCallback, useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { api } from "../../lib/api.js";
import { socket } from "../../lib/socket.js";
import { relativeTime } from "../../lib/relativeTime.js";
import { NewConversationDialog } from "./NewConversationDialog.jsx";
import { NewGroupDialog } from "./NewGroupDialog.jsx";

export function ConversationSidebar() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(null); // null | "direct" | "group"

  const loadConversations = useCallback(() => {
    return api
      .get("/api/conversations")
      .then((data) => setConversations(data.conversations))
      .catch(() => setConversations([]));
  }, []);

  useEffect(() => {
    loadConversations().finally(() => setLoading(false));
  }, [loadConversations]);

  // Global listeners (not scoped to the open conversation): keeps the
  // sidebar preview live even for conversations the user isn't currently
  // viewing. A refetch is simpler and plenty fast enough than hand-merging
  // the changed conversation into local state — this covers new messages,
  // a group being created/renamed, and being added to or removed from one.
  useEffect(() => {
    const events = ["message:new", "conversation:new", "conversation:updated", "conversation:removed"];
    for (const event of events) socket.on(event, loadConversations);
    return () => {
      for (const event of events) socket.off(event, loadConversations);
    };
  }, [loadConversations]);

  function handleConversationReady(conversation) {
    setOpenDialog(null);
    loadConversations();
    return conversation;
  }

  return (
    <nav className="conversation-sidebar">
      <div className="sidebar-new-buttons">
        <button className="new-conversation-button" onClick={() => setOpenDialog("direct")}>
          Nouvelle conversation
        </button>
        <button className="new-conversation-button" onClick={() => setOpenDialog("group")}>
          Nouveau groupe
        </button>
      </div>

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
              <span className="conversation-item-name">
                {conversation.name}
                {conversation.type === "GROUP" && <span className="conversation-item-count"> · {conversation.memberCount}</span>}
              </span>
              {conversation.lastMessage && (
                <span className="conversation-item-preview">
                  {conversation.lastMessage.content} · {relativeTime(conversation.lastMessage.createdAt)}
                </span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>

      {openDialog === "direct" && (
        <NewConversationDialog onClose={() => setOpenDialog(null)} onConversationReady={handleConversationReady} />
      )}
      {openDialog === "group" && (
        <NewGroupDialog onClose={() => setOpenDialog(null)} onConversationReady={handleConversationReady} />
      )}
    </nav>
  );
}
