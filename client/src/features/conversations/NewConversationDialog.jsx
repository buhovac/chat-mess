import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api.js";

const DEBOUNCE_MS = 300;

export function NewConversationDialog({ onClose, onConversationReady }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [startingWith, setStartingWith] = useState(null);

  // Query vide : la liste des collègues s'affiche dès l'ouverture. Query
  // tapée : recherche côté serveur (avec debounce), car le serveur ne renvoie
  // que 20 utilisateurs par réponse — filtrer ce lot en mémoire raterait les
  // autres. Même logique que NewGroupDialog.
  useEffect(() => {
    const trimmed = query.trim();
    // Une réponse plus lente d'une recherche précédente ne doit pas écraser
    // les résultats de la recherche en cours.
    let cancelled = false;

    const timeoutId = setTimeout(
      () => {
        api
          .get(`/api/users?q=${encodeURIComponent(trimmed)}`)
          .then((data) => {
            if (!cancelled) setResults(data.users);
          })
          .catch(() => {
            if (!cancelled) setResults([]);
          });
      },
      trimmed ? DEBOUNCE_MS : 0,
    );

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [query]);

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
          Annuler
        </button>
      </div>
    </div>
  );
}
