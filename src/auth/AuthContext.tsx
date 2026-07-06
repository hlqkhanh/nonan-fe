import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { User } from "../types/sharebill";
import { clearToken, getMe, getToken, login as apiLogin, signup as apiSignup } from "../data/api";

type AuthStatus = "loading" | "authed" | "anon";

type AuthContextValue = {
  user: User | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    async function boot() {
      if (!getToken()) {
        setStatus("anon");
        return;
      }
      try {
        setUser(await getMe());
        setStatus("authed");
      } catch {
        setUser(null);
        setStatus("anon");
      }
    }

    function handleUnauthorized() {
      setUser(null);
      setStatus("anon");
    }

    void boot();
    window.addEventListener("sharebill:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("sharebill:unauthorized", handleUnauthorized);
  }, []);

  async function login(email: string, password: string) {
    setUser(await apiLogin(email, password));
    setStatus("authed");
  }

  async function signup(email: string, password: string, displayName: string) {
    setUser(await apiSignup(email, password, displayName));
    setStatus("authed");
  }

  function logout() {
    clearToken();
    setUser(null);
    setStatus("anon");
  }

  function updateUser(nextUser: User) {
    setUser(nextUser);
  }

  return (
    <AuthContext.Provider value={{ user, status, login, signup, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
