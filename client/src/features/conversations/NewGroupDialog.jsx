import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api.js";

const DEBOUNCE_MS = 300;
const MIN_OTHER_MEMBERS = 2;

export function NewGroupDialog({ onClose, onConversationReady }) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      api
        .get(`/api/users?q=${encodeURIComponent(trimmed)}`)
        .then((data) => setResults(data.users))
        .catch(() => setResults([]));
    }, DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [query]);

  function toggleMember(user) {
    setSelected((prev) =>
      prev.some((u) => u.id === user.id) ? prev.filter((u) => u.id !== user.id) : [...prev, user],
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
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

  const canSubmit = name.trim().length >= 2 && selected.length >= MIN_OTHER_MEMBERS && !submitting;

  return (
    <div className="dialog-backdrop" onClick={onClose}>
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
          {query.trim() && results.length === 0 && <li className="conversation-list-empty">Aucun résultat</li>}
        </ul>

        <div className="dialog-actions">
          <button type="button" className="dialog-close-button" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="new-conversation-button" disabled={!canSubmit}>
            Créer le groupe
          </button>
        </div>
      </form>
    </div>
  );
}
