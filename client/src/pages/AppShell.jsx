import { Link, Outlet } from "react-router-dom";
import { useAuth } from "../features/auth/AuthProvider.jsx";
import { ConversationSidebar } from "../features/conversations/ConversationSidebar.jsx";
import { ActiveConversationProvider } from "../features/conversations/ActiveConversationContext.jsx";
import { PresenceProvider } from "../features/presence/PresenceProvider.jsx";
import { NotificationListener } from "../features/notifications/NotificationListener.jsx";
import { ConnectionStatusProvider, useConnectionStatus } from "../features/connection/ConnectionStatusProvider.jsx";
import { PlanBadge } from "../components/PlanBadge.jsx";
import { Avatar } from "../components/Avatar.jsx";
import { api } from "../lib/api.js";

function ConnectionPill() {
  const status = useConnectionStatus();
  if (status === "connected") return null;
  return <p className="connection-pill">Reconnexion…</p>;
}

export default function AppShell() {
  const { user, logout, refreshUser } = useAuth();

  async function togglePlan() {
    const nextPlan = user.plan === "PRO" ? "FREE" : "PRO";
    await api.post("/api/account/plan", { plan: nextPlan });
    await refreshUser();
  }

  return (
    <ConnectionStatusProvider>
      <ActiveConversationProvider>
        <PresenceProvider>
          <div className="app-shell">
            <aside className="app-sidebar">
              <h2>chat-mess</h2>
              <p className="app-sidebar-user">
                <Avatar user={user} size="sm" />
                {user.displayName}
                <PlanBadge plan={user.plan} />
              </p>
              <ConnectionPill />
              <button onClick={togglePlan}>
                {user.plan === "PRO" ? "Repasser en Free — démo" : "Passer à Premium — démo"}
              </button>
              <Link className="app-sidebar-link" to="/app/settings">
                Paramètres du compte
              </Link>
              <button onClick={logout}>Se déconnecter</button>
              <ConversationSidebar />
            </aside>
            <main className="app-main">
              <Outlet />
            </main>
            <NotificationListener />
          </div>
        </PresenceProvider>
      </ActiveConversationProvider>
    </ConnectionStatusProvider>
  );
}
