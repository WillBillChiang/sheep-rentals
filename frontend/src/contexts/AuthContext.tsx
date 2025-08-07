import React, { createContext, useContext, useEffect, useState } from "react";
import { authApi } from "../services/api";
import { User, AuthTokens } from "../types";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: any) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Check for existing tokens on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const accessToken = localStorage.getItem("accessToken");
        const refreshToken = localStorage.getItem("refreshToken");

        if (accessToken && refreshToken) {
          // Set the token in the API client
          authApi.setToken(accessToken);

          // Try to get user info
          try {
            const userData = await authApi.getCurrentUser();
            setUser(userData);
          } catch (error) {
            // Token might be expired, try to refresh
            try {
              await refreshToken();
            } catch (refreshError) {
              // Refresh failed, clear tokens
              localStorage.removeItem("accessToken");
              localStorage.removeItem("refreshToken");
              authApi.clearToken();
            }
          }
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
        // Clear any invalid tokens
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        authApi.clearToken();
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await authApi.login(email, password);
      const { accessToken, refreshToken } = response.data;

      // Store tokens
      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("refreshToken", refreshToken);

      // Set token in API client
      authApi.setToken(accessToken);

      // Get user data
      const userData = await authApi.getCurrentUser();
      setUser(userData);
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  };

  const register = async (userData: any) => {
    try {
      await authApi.register(userData);
    } catch (error) {
      console.error("Registration error:", error);
      throw error;
    }
  };

  const logout = () => {
    // Clear tokens
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");

    // Clear API token
    authApi.clearToken();

    // Clear user state
    setUser(null);
  };

  const refreshToken = async () => {
    try {
      const refreshToken = localStorage.getItem("refreshToken");
      if (!refreshToken) {
        throw new Error("No refresh token available");
      }

      const response = await authApi.refreshToken(refreshToken);
      const { accessToken } = response.data;

      // Update stored token
      localStorage.setItem("accessToken", accessToken);

      // Update API client token
      authApi.setToken(accessToken);
    } catch (error) {
      console.error("Token refresh error:", error);
      // Clear tokens on refresh failure
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      authApi.clearToken();
      setUser(null);
      throw error;
    }
  };

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      setUser({ ...user, ...userData });
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    register,
    logout,
    refreshToken,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
