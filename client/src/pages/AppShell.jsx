import { Outlet } from "react-router-dom";
import { useAuth } from "../features/auth/AuthProvider.jsx";
import { ConversationSidebar } from "../features/conversations/ConversationSidebar.jsx";

export default function AppShell() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <h2>chat-mess</h2>
        <p>{user.displayName}</p>
        <button onClick={logout}>Se déconnecter</button>
        <ConversationSidebar />
      </aside>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
