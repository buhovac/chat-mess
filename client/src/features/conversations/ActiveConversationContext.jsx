import { createContext, useContext, useState } from "react";

const ActiveConversationContext = createContext(null);

// Tracks which conversation is currently open so NotificationListener
// (mounted once in AppShell, above the router outlet) can skip toasting
// messages that arrive in the conversation already on screen.
export function ActiveConversationProvider({ children }) {
  const [activeConversationId, setActiveConversationId] = useState(null);

  return (
    <ActiveConversationContext.Provider value={{ activeConversationId, setActiveConversationId }}>
      {children}
    </ActiveConversationContext.Provider>
  );
}

export function useActiveConversation() {
  const ctx = useContext(ActiveConversationContext);
  if (!ctx) {
    throw new Error("useActiveConversation must be used within an ActiveConversationProvider");
  }
  return ctx;
}
