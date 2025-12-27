import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

interface User {
  id: string;
  username: string;
  name: string;
  role: string;
}

interface AuthState {
  user: User | null;
  serverUrl: string;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  login: (serverUrl: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateServerUrl: (url: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEYS = {
  USER: "meterflo_user",
  SERVER_URL: "meterflo_server_url",
  AUTH_TOKEN: "meterflo_auth_token",
};

async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function secureSet(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function secureDelete(key: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    serverUrl: "",
    isLoading: true,
    isAuthenticated: false,
  });

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const [storedUser, storedServerUrl] = await Promise.all([
        secureGet(STORAGE_KEYS.USER),
        secureGet(STORAGE_KEYS.SERVER_URL),
      ]);

      if (storedUser && storedServerUrl) {
        setState({
          user: JSON.parse(storedUser),
          serverUrl: storedServerUrl,
          isLoading: false,
          isAuthenticated: true,
        });
      } else {
        setState(prev => ({
          ...prev,
          serverUrl: storedServerUrl || "",
          isLoading: false,
        }));
      }
    } catch (error) {
      console.error("Failed to load stored auth:", error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const login = useCallback(async (serverUrl: string, username: string, password: string) => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const normalizedUrl = serverUrl.endsWith("/") ? serverUrl.slice(0, -1) : serverUrl;
      
      const response = await fetch(`${normalizedUrl}/api/mobile/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Login failed");
      }

      const data = await response.json();
      const user: User = {
        id: data.user.id,
        username: data.user.username,
        name: data.user.name || data.user.username,
        role: data.user.role || "User",
      };

      await Promise.all([
        secureSet(STORAGE_KEYS.USER, JSON.stringify(user)),
        secureSet(STORAGE_KEYS.SERVER_URL, normalizedUrl),
        data.token ? secureSet(STORAGE_KEYS.AUTH_TOKEN, data.token) : Promise.resolve(),
      ]);

      setState({
        user,
        serverUrl: normalizedUrl,
        isLoading: false,
        isAuthenticated: true,
      });
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    await Promise.all([
      secureDelete(STORAGE_KEYS.USER),
      secureDelete(STORAGE_KEYS.AUTH_TOKEN),
    ]);

    setState(prev => ({
      ...prev,
      user: null,
      isAuthenticated: false,
    }));
  }, []);

  const updateServerUrl = useCallback(async (url: string) => {
    const normalizedUrl = url.endsWith("/") ? url.slice(0, -1) : url;
    await secureSet(STORAGE_KEYS.SERVER_URL, normalizedUrl);
    setState(prev => ({ ...prev, serverUrl: normalizedUrl }));
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, updateServerUrl }}>
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
