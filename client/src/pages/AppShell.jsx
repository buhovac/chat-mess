import { Link, Outlet, useMatch } from "react-router-dom";
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

// Inline SVG instead of an icon library: one icon doesn't justify a
// dependency. aria-hidden because the link's text already says what it is.
function GearIcon() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export default function AppShell() {
  const { user, logout, refreshUser } = useAuth();
  // On small screens only one column fits: the list on "/app" exactly, the
  // routed page (conversation, settings) on anything deeper. The URL is the
  // state, so the browser's own back button works too. CSS ignores these
  // modifiers above 768px.
  const showsList = useMatch({ path: "/app", end: true }) !== null;

  async function togglePlan() {
    const nextPlan = user.plan === "PRO" ? "FREE" : "PRO";
    await api.post("/api/account/plan", { plan: nextPlan });
    await refreshUser();
  }

  return (
    <ConnectionStatusProvider>
      <ActiveConversationProvider>
        <PresenceProvider>
          <div className={`app-shell ${showsList ? "app-shell--list" : "app-shell--detail"}`}>
            <aside className="app-sidebar">
              <h2>Relai</h2>
              <div className="sidebar-identity">
                <p className="app-sidebar-user">
                  <Avatar user={user} size="sm" />
                  {user.displayName}
                  <PlanBadge plan={user.plan} />
                </p>
                <button className="sidebar-demo-link" onClick={togglePlan}>
                  {user.plan === "PRO" ? "Repasser en Free — démo" : "Passer à Premium — démo"}
                </button>
              </div>
              <ConnectionPill />
              {/* The account group is handed to ConversationSidebar so it
                  renders between that component's own "new" buttons and its
                  list — DOM order then matches the visual order, which keeps
                  keyboard tabbing in the order the eye reads. */}
              <ConversationSidebar
                accountSection={
                  <div className="sidebar-account">
                    <Link className="sidebar-nav-row" to="/app/settings">
                      <GearIcon />
                      Paramètres du compte
                    </Link>
                    <button className="sidebar-ghost-button" onClick={logout}>
                      Se déconnecter
                    </button>
                  </div>
                }
              />
            </aside>
            <main className="app-main">
              <Link className="app-back-link" to="/app">
                ← Conversations
              </Link>
              <Outlet />
            </main>
            <NotificationListener />
          </div>
        </PresenceProvider>
      </ActiveConversationProvider>
    </ConnectionStatusProvider>
  );
}
