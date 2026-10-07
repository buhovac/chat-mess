import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import AppShell from "./pages/AppShell.jsx";
import ConversationPage from "./pages/ConversationPage.jsx";
import AccountSettings from "./pages/AccountSettings.jsx";
import { ProtectedRoute } from "./components/ProtectedRoute.jsx";

function NoConversationSelected() {
  return <p className="conversation-list-empty">Choisis une conversation à gauche pour commencer.</p>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<NoConversationSelected />} />
        {/* Declared before ":conversationId" for readability only — React
            Router ranks static segments above dynamic ones regardless. */}
        <Route path="settings" element={<AccountSettings />} />
        <Route path=":conversationId" element={<ConversationPage />} />
      </Route>
    </Routes>
  );
}
