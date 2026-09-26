import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "../../lib/api.js";
import { socket } from "../../lib/socket.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/api/auth/me")
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  // The socket handshake reads the same httpOnly cookie as the REST calls,
  // so it can only succeed once `user` is known — connect/disconnect here
  // keeps it in lockstep with auth state (initial load, login, logout).
  // Always disconnect first: socket.connect() is a no-op while already
  // connected, so switching straight from one logged-in user to another
  // (e.g. re-login over a stale session, no explicit logout in between)
  // would otherwise leave the socket authenticated as the *previous* user.
  useEffect(() => {
    socket.disconnect();
    if (user) {
      socket.connect();
    }
  }, [user]);

  const register = useCallback(async (payload) => {
    const data = await api.post("/api/auth/register", payload);
    setUser(data.user);
  }, []);

  const login = useCallback(async (payload) => {
    const data = await api.post("/api/auth/login", payload);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    await api.post("/api/auth/logout", {});
    setUser(null);
  }, []);

  // Refetches the current user — used after an in-place change (e.g. the
  // demo plan switcher) that doesn't go through login/register.
  const refreshUser = useCallback(async () => {
    const data = await api.get("/api/auth/me");
    setUser(data.user);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, register, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
