import { Outlet } from "react-router-dom";
import { useAuth } from "../features/auth/AuthProvider.jsx";
import { ConversationSidebar } from "../features/conversations/ConversationSidebar.jsx";
import { PlanBadge } from "../components/PlanBadge.jsx";
import { api } from "../lib/api.js";

export default function AppShell() {
  const { user, logout, refreshUser } = useAuth();

  async function togglePlan() {
    const nextPlan = user.plan === "PRO" ? "FREE" : "PRO";
    await api.post("/api/account/plan", { plan: nextPlan });
    await refreshUser();
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <h2>chat-mess</h2>
        <p>
          {user.displayName}
          <PlanBadge plan={user.plan} />
        </p>
        <button onClick={togglePlan}>
          {user.plan === "PRO" ? "Repasser en Free — démo" : "Passer à Premium — démo"}
        </button>
        <button onClick={logout}>Se déconnecter</button>
        <ConversationSidebar />
      </aside>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
