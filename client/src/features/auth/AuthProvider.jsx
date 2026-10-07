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

  // The server re-signs the cookie with the new name; refetching /me is
  // what makes it show up everywhere in the UI.
  const updateProfile = useCallback(async (payload) => {
    const data = await api.patch("/api/account/profile", payload);
    setUser(data.user);
  }, []);

  // The server kicks every live socket of this user (it revokes all older
  // sessions), and a server-side kick is never auto-reconnected by
  // socket.io-client — so reconnect explicitly, with the fresh cookie the
  // response just set. Disconnecting first makes this deterministic even
  // if the kick packet hasn't arrived yet.
  const changePassword = useCallback(async (payload) => {
    await api.post("/api/account/password", payload);
    socket.disconnect();
    socket.connect();
  }, []);

  // Cookie already cleared and sockets already kicked by the server; this
  // just drops the local session (the effect above disconnects the socket).
  const deleteAccount = useCallback(async (payload) => {
    await api.del("/api/account", payload);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, register, login, logout, refreshUser, updateProfile, changePassword, deleteAccount }}
    >
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
