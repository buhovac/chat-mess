import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api.js";
import { useUserSearch } from "./useUserSearch.js";

const MIN_OTHER_MEMBERS = 2;

export function NewGroupDialog({ onClose, onConversationReady }) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const { results, settled } = useUserSearch(query);
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  // Field hints only appear after a click on "Créer le groupe", not while
  // the user is still filling the form in.
  const [attempted, setAttempted] = useState(false);

  const nameTooShort = name.trim().length < 2;
  const tooFewMembers = selected.length < MIN_OTHER_MEMBERS;

  function toggleMember(user) {
    setSelected((prev) =>
      prev.some((u) => u.id === user.id) ? prev.filter((u) => u.id !== user.id) : [...prev, user],
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    // Checked on click instead of disabling the button: a disabled button
    // can't tell the user what is missing. The server validates it again.
    if (nameTooShort || tooFewMembers) {
      setAttempted(true);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const data = await api.post("/api/conversations", {
        type: "GROUP",
        name: name.trim(),
        memberIds: selected.map((u) => u.id),
      });
      onConversationReady(data.conversation);
      navigate(`/app/${data.conversation.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="dialog-backdrop dialog-backdrop--top" onClick={onClose}>
      <form className="dialog" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h3>Nouveau groupe</h3>
        {error && <p className="auth-error">{error}</p>}

        <input
          type="text"
          autoFocus
          placeholder="Nom du groupe"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {attempted && nameTooShort && <p className="auth-error">Donne un nom au groupe (au moins 2 caractères).</p>}

        {selected.length > 0 && (
          <ul className="selected-members">
            {selected.map((user) => (
              <li key={user.id} className="selected-member-chip">
                {user.displayName}
                <button type="button" onClick={() => toggleMember(user)} aria-label={`Retirer ${user.displayName}`}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <input
          type="text"
          placeholder="Ajouter des collègues (au moins 2)..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {attempted && tooFewMembers && <p className="auth-error">Sélectionne au moins 2 collègues.</p>}
        <ul className="user-search-results">
          {results.map((user) => (
            <li key={user.id}>
              <button
                type="button"
                className={selected.some((u) => u.id === user.id) ? "user-search-result--selected" : ""}
                onClick={() => toggleMember(user)}
              >
                <span className="user-search-name">{user.displayName}</span>
                <span className="user-search-email">{user.email}</span>
              </button>
            </li>
          ))}
          {settled && results.length === 0 && <li className="conversation-list-empty">Aucun résultat</li>}
        </ul>

        <div className="dialog-actions">
          <button type="button" className="dialog-close-button dialog-close-button--left" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="new-conversation-button" disabled={submitting}>
            Créer le groupe
          </button>
        </div>
      </form>
    </div>
  );
}
