import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import { useAuth } from "../auth/AuthProvider.jsx";
import { ConfirmDialog } from "../../components/ConfirmDialog.jsx";
import * as permissions from "./permissions.js";

const DEBOUNCE_MS = 300;
const ROLE_LABELS = { OWNER: "Propriétaire", ADMIN: "Administrateur", MEMBER: "Membre" };

export function MemberPanel({ conversation, onClose, onChanged }) {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [busyUserId, setBusyUserId] = useState(null);
  const [error, setError] = useState(null);
  const [pendingRemoval, setPendingRemoval] = useState(null);

  const myRole = conversation.myRole;
  const memberIds = new Set(conversation.members.map((m) => m.id));

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      api
        .get(`/api/users?q=${encodeURIComponent(trimmed)}`)
        .then((data) => setResults(data.users.filter((u) => !memberIds.has(u.id))))
        .catch(() => setResults([]));
    }, DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- memberIds is derived fresh every render from `conversation`, re-running on it alone is enough
  }, [query, conversation]);

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
      setResults([]);
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
              <span className="member-name">{member.displayName}{isSelf && " (vous)"}</span>
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
            {results.map((candidate) => (
              <li key={candidate.id}>
                <button disabled={busyUserId === candidate.id} onClick={() => handleAdd(candidate)}>
                  <span className="user-search-name">{candidate.displayName}</span>
                  <span className="user-search-email">{candidate.email}</span>
                </button>
              </li>
            ))}
            {query.trim() && results.length === 0 && <li className="conversation-list-empty">Aucun résultat</li>}
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
