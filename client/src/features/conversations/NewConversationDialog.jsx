import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api.js";

export function NewConversationDialog({ onClose, onConversationReady }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [allUsers, setAllUsers] = useState([]);
  const [error, setError] = useState(null);
  const [startingWith, setStartingWith] = useState(null);

  // Un seul fetch à l'ouverture (q vide -> tout le monde sauf moi, déjà trié
  // par displayName côté serveur, borné à MAX_RESULTS). La recherche ensuite
  // filtre cette liste en mémoire : pas besoin de retaper une requête réseau
  // à chaque frappe pour une liste de cette taille.
  useEffect(() => {
    api
      .get("/api/users?q=")
      .then((data) => setAllUsers(data.users))
      .catch(() => setAllUsers([]));
  }, []);

  const results = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      return allUsers;
    }
    return allUsers.filter(
      (user) =>
        user.displayName.toLowerCase().includes(trimmed) || user.email.toLowerCase().includes(trimmed),
    );
  }, [query, allUsers]);

  async function handlePick(user) {
    setError(null);
    setStartingWith(user.id);
    try {
      const data = await api.post("/api/conversations", { type: "DIRECT", userId: user.id });
      onConversationReady(data.conversation);
      navigate(`/app/${data.conversation.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setStartingWith(null);
    }
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h3>Nouvelle conversation</h3>
        {error && <p className="auth-error">{error}</p>}
        <input
          type="text"
          autoFocus
          placeholder="Chercher un collègue..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ul className="user-search-results">
          {results.map((user) => (
            <li key={user.id}>
              <button disabled={startingWith === user.id} onClick={() => handlePick(user)}>
                <span className="user-search-name">{user.displayName}</span>
                <span className="user-search-email">{user.email}</span>
              </button>
            </li>
          ))}
          {results.length === 0 && <li className="conversation-list-empty">Aucun résultat</li>}
        </ul>
        <button className="dialog-close-button" onClick={onClose}>
          Fermer
        </button>
      </div>
    </div>
  );
}
