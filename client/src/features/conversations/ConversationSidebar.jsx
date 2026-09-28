import { useCallback, useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { api } from "../../lib/api.js";
import { socket } from "../../lib/socket.js";
import { relativeTime } from "../../lib/relativeTime.js";
import { NewConversationDialog } from "./NewConversationDialog.jsx";
import { NewGroupDialog } from "./NewGroupDialog.jsx";
import { PlanBadge } from "../../components/PlanBadge.jsx";
import { useAuth } from "../auth/AuthProvider.jsx";
import { usePresence } from "../presence/PresenceProvider.jsx";

const BASE_TITLE = document.title;

export function ConversationSidebar() {
  const { user } = useAuth();
  const { presence, ensurePresence } = usePresence();
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
    const events = [
      "message:new",
      "conversation:new",
      "conversation:updated",
      "conversation:removed",
      "conversation:read",
      // Fires on the initial connect AND every reconnect after a drop —
      // state (unread counts, presence) may have drifted while offline, so
      // a plain refetch is simpler than trying to reconcile what was missed.
      "connect",
    ];
    for (const event of events) socket.on(event, loadConversations);
    return () => {
      for (const event of events) socket.off(event, loadConversations);
    };
  }, [loadConversations]);

  // Unread total drives the tab title (e.g. "(3) P1 — Messagerie") so it's
  // visible even when this tab isn't focused.
  useEffect(() => {
    const total = conversations.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);
    document.title = total > 0 ? `(${total}) ${BASE_TITLE}` : BASE_TITLE;
  }, [conversations]);

  // Presence dots only make sense for DIRECT peers here (group members are
  // shown in MemberPanel instead) — fetch initial state once conversations
  // are known, live updates come from PresenceProvider's own socket listener.
  useEffect(() => {
    const peerIds = conversations
      .filter((c) => c.type === "DIRECT")
      .map((c) => c.members.find((m) => m.id !== user.id)?.id)
      .filter(Boolean);
    if (peerIds.length > 0) ensurePresence(peerIds);
  }, [conversations, user.id, ensurePresence]);

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
        {conversations.map((conversation) => {
          const peer = conversation.type === "DIRECT" ? conversation.members.find((m) => m.id !== user.id) : null;
          return (
            <li key={conversation.id}>
              <NavLink
                to={`/app/${conversation.id}`}
                className={({ isActive }) => `conversation-item${isActive ? " conversation-item--active" : ""}`}
              >
                <span className="conversation-item-name">
                  {peer && (
                    <span className={`presence-dot${presence[peer.id] ? " presence-dot--online" : ""}`} />
                  )}
                  {conversation.name}
                  {peer && <PlanBadge plan={peer.plan} />}
                  {conversation.type === "GROUP" && <span className="conversation-item-count"> · {conversation.memberCount}</span>}
                  {conversation.unreadCount > 0 && <span className="unread-badge">{conversation.unreadCount}</span>}
                </span>
                {conversation.lastMessage && (
                  <span className="conversation-item-preview">
                    {conversation.lastMessage.content} · {relativeTime(conversation.lastMessage.createdAt)}
                  </span>
                )}
              </NavLink>
            </li>
          );
        })}
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
