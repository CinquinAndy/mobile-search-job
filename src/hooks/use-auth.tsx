"use client";

import type { AuthRecord } from "pocketbase";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  isAuthenticated as checkIsAuthenticated,
  getCurrentUser,
  type LoginCredentials,
  login as pbLogin,
  logout as pbLogout,
  register as pbRegister,
  type RegisterData,
  refreshAuth,
} from "@/services/pocketbase.client";

interface AuthContextType {
  user: AuthRecord | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const currentUser = getCurrentUser();
        if (currentUser) {
          const refreshedUser = await refreshAuth();
          setUser(refreshedUser);
        }
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    setIsLoading(true);
    try {
      const record = await pbLogin(credentials);
      setUser(record);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    setIsLoading(true);
    try {
      const record = await pbRegister(data);
      setUser(record);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    pbLogout();
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    const refreshedUser = await refreshAuth();
    setUser(refreshedUser);
  }, []);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: checkIsAuthenticated(),
    login,
    register,
    logout,
    refresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
