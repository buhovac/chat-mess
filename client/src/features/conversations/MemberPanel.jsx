import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import { useAuth } from "../auth/AuthProvider.jsx";
import { ConfirmDialog } from "../../components/ConfirmDialog.jsx";
import { PlanBadge } from "../../components/PlanBadge.jsx";
import { Avatar } from "../../components/Avatar.jsx";
import { usePresence } from "../presence/PresenceProvider.jsx";
import * as permissions from "./permissions.js";
import { useUserSearch } from "./useUserSearch.js";

const ROLE_LABELS = { OWNER: "Propriétaire", ADMIN: "Administrateur", MEMBER: "Membre" };

export function MemberPanel({ conversation, onClose, onChanged }) {
  const { user } = useAuth();
  const { presence, ensurePresence } = usePresence();
  const [query, setQuery] = useState("");
  const { results, settled } = useUserSearch(query);
  const [busyUserId, setBusyUserId] = useState(null);
  const [error, setError] = useState(null);
  const [pendingRemoval, setPendingRemoval] = useState(null);

  const myRole = conversation.myRole;
  const memberIds = new Set(conversation.members.map((m) => m.id));
  // Filtered here rather than in the hook: only this panel needs it. Done
  // at render time, so a member added a moment ago drops out as soon as
  // the conversation reloads.
  const candidates = results.filter((u) => !memberIds.has(u.id));

  useEffect(() => {
    ensurePresence(conversation.members.map((m) => m.id));
  }, [conversation, ensurePresence]);

  async function runAction(userId, action) {
    setBusyUserId(userId);
    setError(null);
    try {
      await action();
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyUserId(null);
    }
  }

  function handleAdd(targetUser) {
    return runAction(targetUser.id, async () => {
      await api.post(`/api/conversations/${conversation.id}/members`, { userId: targetUser.id });
      setQuery("");
    });
  }

  function confirmRemove() {
    const member = pendingRemoval;
    setPendingRemoval(null);
    return runAction(member.id, () => api.del(`/api/conversations/${conversation.id}/members/${member.id}`));
  }

  function handleRoleChange(member, role) {
    return runAction(member.id, () => api.patch(`/api/conversations/${conversation.id}/members/${member.id}`, { role }));
  }

  return (
    <aside className="member-panel">
      <div className="member-panel-header">
        <h3>Membres ({conversation.memberCount})</h3>
        <button className="dialog-close-button" onClick={onClose}>
          Fermer
        </button>
      </div>

      {error && <p className="auth-error">{error}</p>}

      <ul className="member-list">
        {conversation.members.map((member) => {
          const isSelf = member.id === user.id;
          return (
            <li key={member.id} className="member-row">
              <span className="member-name">
                <span className={`presence-dot${presence[member.id] ? " presence-dot--online" : ""}`} />
                <Avatar user={member} size="sm" />
                {member.displayName}
                <PlanBadge plan={member.plan} />
                {isSelf && " (vous)"}
              </span>
              <span className="member-role">{ROLE_LABELS[member.role]}</span>
              {!isSelf && (
                <div className="member-actions">
                  {permissions.canChangeRole(myRole, member.role) && (
                    <button
                      disabled={busyUserId === member.id}
                      onClick={() => handleRoleChange(member, member.role === "ADMIN" ? "MEMBER" : "ADMIN")}
                    >
                      {member.role === "ADMIN" ? "Rétrograder" : "Promouvoir"}
                    </button>
                  )}
                  {permissions.canRemoveMember(myRole, member.role) && (
                    <button disabled={busyUserId === member.id} onClick={() => setPendingRemoval(member)}>
                      Retirer
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {permissions.canAddMember(myRole) && (
        <div className="member-add">
          <input
            type="text"
            placeholder="Ajouter un membre..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <ul className="user-search-results">
            {candidates.map((candidate) => (
              <li key={candidate.id}>
                <button disabled={busyUserId === candidate.id} onClick={() => handleAdd(candidate)}>
                  <span className="user-search-name">{candidate.displayName}</span>
                  <span className="user-search-email">{candidate.email}</span>
                </button>
              </li>
            ))}
            {/* With no query the server only sends the first 20 colleagues: if
                they're all members already, others may still exist, so
                "Aucun résultat" would be wrong. */}
            {settled && candidates.length === 0 && (
              <li className="conversation-list-empty">
                {query.trim() ? "Aucun résultat" : "Tape un nom pour chercher d'autres collègues."}
              </li>
            )}
          </ul>
        </div>
      )}

      {pendingRemoval && (
        <ConfirmDialog
          title="Retirer ce membre"
          message={`Retirer ${pendingRemoval.displayName} du groupe ?`}
          confirmLabel="Retirer"
          onConfirm={confirmRemove}
          onCancel={() => setPendingRemoval(null)}
        />
      )}
    </aside>
  );
}
