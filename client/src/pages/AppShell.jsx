import { useAuth } from "../features/auth/AuthProvider.jsx";

export default function AppShell() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <h2>chat-mess</h2>
        <p>{user.displayName}</p>
        <button onClick={logout}>Se déconnecter</button>
      </aside>
      <main className="app-main">
        <p>Conversations arrivent à l'étape suivante.</p>
      </main>
    </div>
  );
}
