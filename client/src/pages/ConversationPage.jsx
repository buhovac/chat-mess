import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api.js";
import { socket } from "../lib/socket.js";
import { useToast } from "../components/Toast.jsx";
import { ConfirmDialog } from "../components/ConfirmDialog.jsx";
import { useAuth } from "../features/auth/AuthProvider.jsx";
import { MessageList } from "../features/messages/MessageList.jsx";
import { MemberPanel } from "../features/conversations/MemberPanel.jsx";
import { useActiveConversation } from "../features/conversations/ActiveConversationContext.jsx";
import * as permissions from "../features/conversations/permissions.js";

export default function ConversationPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const showToast = useToast();
  const { user } = useAuth();
  const { setActiveConversationId } = useActiveConversation();
  const [conversation, setConversation] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [error, setError] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null); // null | "leave" | "delete"
  const [transferTo, setTransferTo] = useState("");

  const loadConversation = useCallback(() => {
    return api
      .get(`/api/conversations/${conversationId}`)
      .then((data) => setConversation(data.conversation))
      .catch(() => setConversation(null));
  }, [conversationId]);

  useEffect(() => {
    setPanelOpen(false);
    setRenaming(false);
    setError(null);
    loadConversation();
  }, [loadConversation]);

  // Covers a conversation just created this session: the connect-time join
  // (server side) only knows about rooms that existed at handshake time.
  // Harmless no-op if the socket already joined this room.
  useEffect(() => {
    socket.emit("conversation:join", { conversationId });
  }, [conversationId]);

  // Lets NotificationListener (mounted above the router outlet) know which
  // conversation is on screen right now, so it can skip toasting for it.
  useEffect(() => {
    setActiveConversationId(conversationId);
    return () => setActiveConversationId(null);
  }, [conversationId, setActiveConversationId]);

  // Auto-read: mark read on open, whenever the tab regains focus/visibility
  // while this conversation stays open, and whenever a new message lands in
  // it while it's the one on screen — otherwise a message arriving right
  // after the initial mark-as-read would sit unread until the user leaves
  // and reopens the conversation.
  useEffect(() => {
    function markRead() {
      if (document.visibilityState !== "visible") return;
      socket.emit("conversation:read", { conversationId });
    }

    markRead();
    document.addEventListener("visibilitychange", markRead);
    window.addEventListener("focus", markRead);

    function handleNewMessage({ conversationId: incomingId }) {
      if (incomingId === conversationId) markRead();
    }
    socket.on("message:new", handleNewMessage);

    return () => {
      document.removeEventListener("visibilitychange", markRead);
      window.removeEventListener("focus", markRead);
      socket.off("message:new", handleNewMessage);
    };
  }, [conversationId]);

  // Membership/role/name changes made by someone else while this
  // conversation is open — refetch to stay in sync. "conversation:removed"
  // is the one case with no conversation left to refetch: it's this route
  // being deleted or this user being removed/leaving, so navigate away
  // with a toast instead.
  useEffect(() => {
    function handleRemoved({ conversationId: removedId }) {
      if (removedId !== conversationId) return;
      showToast("Cette conversation n'est plus disponible.");
      navigate("/app");
    }

    function handleMutated({ conversationId: eventId }) {
      if (eventId !== conversationId) return;
      loadConversation();
    }

    socket.on("conversation:removed", handleRemoved);
    socket.on("conversation:updated", handleMutated);
    socket.on("member:added", handleMutated);
    socket.on("member:removed", handleMutated);
    socket.on("member:role_changed", handleMutated);
    return () => {
      socket.off("conversation:removed", handleRemoved);
      socket.off("conversation:updated", handleMutated);
      socket.off("member:added", handleMutated);
      socket.off("member:removed", handleMutated);
      socket.off("member:role_changed", handleMutated);
    };
  }, [conversationId, loadConversation, navigate, showToast]);

  async function handleRenameSubmit(e) {
    e.preventDefault();
    const name = nameDraft.trim();
    if (name.length < 2) return;
    try {
      await api.patch(`/api/conversations/${conversationId}`, { name });
      setRenaming(false);
      loadConversation();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleLeave() {
    setConfirmAction(null);
    try {
      // An OWNER leaving while others remain must hand off ownership first —
      // the server rejects an empty transferTo with 422 in that case, which
      // is why the dialog below only lets you submit once one is picked.
      await api.post(`/api/conversations/${conversationId}/leave`, needsTransfer ? { transferTo } : {});
      navigate("/app");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete() {
    setConfirmAction(null);
    try {
      await api.del(`/api/conversations/${conversationId}`);
      navigate("/app");
    } catch (err) {
      setError(err.message);
    }
  }

  if (!conversation) {
    return <p className="conversation-list-empty">Chargement...</p>;
  }

  const isGroup = conversation.type === "GROUP";
  const myRole = conversation.myRole;
  const canEditName = isGroup && permissions.canRename(myRole);
  // Mirrors canLeave() in authorize.js: an OWNER can't do a plain leave
  // while others remain — someone else has to become OWNER first.
  const needsTransfer = isGroup && myRole === "OWNER" && conversation.memberCount > 1;
  const otherMembers = conversation.members.filter((m) => m.id !== user.id);

  return (
    <section className="conversation-view">
      <header className="conversation-header">
        {renaming ? (
          <form className="rename-form" onSubmit={handleRenameSubmit}>
            <input autoFocus value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} />
            <button type="submit">Valider</button>
            <button type="button" onClick={() => setRenaming(false)}>
              Annuler
            </button>
          </form>
        ) : (
          <h2
            className={canEditName ? "conversation-title--editable" : undefined}
            onClick={() => {
              if (!canEditName) return;
              setNameDraft(conversation.name ?? "");
              setRenaming(true);
            }}
          >
            {/* null only for a DIRECT whose other member deleted their account */}
            {conversation.name ?? "Utilisateur supprimé"}
          </h2>
        )}

        {isGroup && (
          <div className="conversation-header-actions">
            <span className="member-count">{conversation.memberCount} membres</span>
            <button onClick={() => setPanelOpen((open) => !open)}>Membres</button>
            <button
              onClick={() => {
                setTransferTo("");
                setConfirmAction("leave");
              }}
            >
              Quitter
            </button>
            {permissions.canDeleteConversation(myRole) && (
              <button className="danger-button" onClick={() => setConfirmAction("delete")}>
                Supprimer
              </button>
            )}
          </div>
        )}
      </header>

      {error && <p className="auth-error">{error}</p>}

      <div className="conversation-body">
        <MessageList conversationId={conversationId} conversation={conversation} />
        {isGroup && panelOpen && (
          <MemberPanel conversation={conversation} onClose={() => setPanelOpen(false)} onChanged={loadConversation} />
        )}
      </div>

      {confirmAction === "leave" && needsTransfer && (
        <div className="dialog-backdrop" onClick={() => setConfirmAction(null)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Quitter le groupe</h3>
            <p>
              Vous êtes propriétaire et d&apos;autres membres restent dans ce groupe : choisissez qui devient
              propriétaire avant de partir.
            </p>
            <select value={transferTo} onChange={(e) => setTransferTo(e.target.value)}>
              <option value="" disabled>
                Choisir un nouveau propriétaire...
              </option>
              {otherMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.displayName}
                </option>
              ))}
            </select>
            <div className="dialog-actions">
              <button className="dialog-close-button" onClick={() => setConfirmAction(null)}>
                Annuler
              </button>
              <button className="danger-button" disabled={!transferTo} onClick={handleLeave}>
                Quitter
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmAction === "leave" && !needsTransfer && (
        <ConfirmDialog
          title="Quitter le groupe"
          message="Quitter ce groupe ?"
          confirmLabel="Quitter"
          onConfirm={handleLeave}
          onCancel={() => setConfirmAction(null)}
        />
      )}
      {confirmAction === "delete" && (
        <ConfirmDialog
          title="Supprimer le groupe"
          message="Supprimer définitivement ce groupe ? Cette action est irréversible."
          confirmLabel="Supprimer"
          onConfirm={handleDelete}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </section>
  );
}
