import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "../../lib/api.js";

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

  return (
    <AuthContext.Provider value={{ user, loading, register, login, logout }}>
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
