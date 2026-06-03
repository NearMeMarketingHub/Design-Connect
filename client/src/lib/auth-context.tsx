import React, { createContext, useContext, useState, useEffect } from "react";
import type { User } from "@shared/schema";
import { api } from "./api";

export type PortalType = 'client' | 'contractor' | 'admin';

interface AuthContextType {
  user: Omit<User, "password"> | null;
  viewAsAdmin: Omit<User, "password"> | null;
  loading: boolean;
  currentPortal: PortalType | null;
  login: (username: string, password: string, portal: PortalType) => Promise<Omit<User, "password">>;
  register: (username: string, email: string, password: string, role: string, name?: string, companyName?: string, companyType?: string, phone?: string, contractorType?: string) => Promise<{ pendingApproval?: boolean; message?: string }>;
  logout: () => Promise<void>;
  setPortal: (portal: PortalType) => void;
  refetch: () => Promise<void>;
  exitViewAs: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Omit<User, "password"> | null>(null);
  const [viewAsAdmin, setViewAsAdmin] = useState<Omit<User, "password"> | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPortal, setCurrentPortal] = useState<PortalType | null>(() => {
    const stored = sessionStorage.getItem('currentPortal');
    return stored as PortalType | null;
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const result = await api.getCurrentUser();
      const fetchedUser = result.user || null;
      const fetchedViewAsAdmin = result.viewAsAdmin || null;

      // If user is an unapproved company_owner or contractor (and not in view-as mode), treat as not authenticated
      const isContractorPortalRole = fetchedUser?.role === 'contractor' || fetchedUser?.role === 'company_owner';
      if (fetchedUser && isContractorPortalRole && !fetchedUser.isApproved && !fetchedViewAsAdmin) {
        setUser(null);
        setViewAsAdmin(null);
        await api.logout().catch(() => {});
      } else {
        setUser(fetchedUser);
        setViewAsAdmin(fetchedViewAsAdmin);
      }
    } catch (error) {
      setUser(null);
      setViewAsAdmin(null);
    } finally {
      setLoading(false);
    }
  };

  const setPortal = (portal: PortalType) => {
    setCurrentPortal(portal);
    sessionStorage.setItem('currentPortal', portal);
  };

  const login = async (username: string, password: string, portal: PortalType) => {
    const { user } = await api.login(username, password, portal);
    setUser(user);
    setPortal(portal);
    return user;
  };

  const register = async (username: string, email: string, password: string, role: string, name?: string, companyName?: string, companyType?: string, phone?: string, contractorType?: string) => {
    const result = await api.register(username, email, password, role, name, companyName, companyType, phone, contractorType);
    if (!result.pendingApproval) {
      setUser(result.user);
    }
    return { pendingApproval: result.pendingApproval, message: result.message };
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
    setViewAsAdmin(null);
    setCurrentPortal(null);
    sessionStorage.removeItem('currentPortal');
  };

  const refetch = async () => {
    await checkAuth();
  };

  const exitViewAs = async () => {
    await fetch("/api/admin/view-as/exit", { method: "POST", credentials: "include" });
    await checkAuth();
  };

  return (
    <AuthContext.Provider value={{ user, viewAsAdmin, loading, currentPortal, login, register, logout, setPortal, refetch, exitViewAs }}>
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
