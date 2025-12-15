import React, { createContext, useContext, useState, useEffect } from "react";
import type { User } from "@shared/schema";
import { api } from "./api";

interface AuthContextType {
  user: Omit<User, "password"> | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<Omit<User, "password">>;
  register: (username: string, email: string, password: string, role: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Omit<User, "password"> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { user } = await api.getCurrentUser();
      setUser(user);
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    const { user } = await api.login(username, password);
    setUser(user);
    return user;
  };

  const register = async (username: string, email: string, password: string, role: string, name?: string) => {
    const { user } = await api.register(username, email, password, role, name);
    setUser(user);
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
