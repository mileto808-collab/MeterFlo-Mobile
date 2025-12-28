import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export interface User {
  id: string;
  username: string;
  displayName: string;
  role: string;
}

export interface Project {
  id: number;
  name: string;
  description: string;
}

interface AuthState {
  user: User | null;
  serverUrl: string;
  projectId: number | null;
  projects: Project[];
  isLoading: boolean;
  isAuthenticated: boolean;
  needsProjectSelection: boolean;
}

interface AuthContextType extends AuthState {
  login: (serverUrl: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  selectProject: (projectId: number) => Promise<void>;
  updateServerUrl: (url: string) => Promise<void>;
  getApiUrl: (path: string) => string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEYS = {
  USER: "meterflo_user",
  SERVER_URL: "meterflo_server_url",
  PROJECT_ID: "meterflo_project_id",
  PROJECTS: "meterflo_projects",
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
    projectId: null,
    projects: [],
    isLoading: true,
    isAuthenticated: false,
    needsProjectSelection: false,
  });

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const [storedUser, storedServerUrl, storedProjectId, storedProjects] = await Promise.all([
        secureGet(STORAGE_KEYS.USER),
        secureGet(STORAGE_KEYS.SERVER_URL),
        secureGet(STORAGE_KEYS.PROJECT_ID),
        secureGet(STORAGE_KEYS.PROJECTS),
      ]);

      if (storedUser && storedServerUrl && storedProjectId) {
        setState({
          user: JSON.parse(storedUser),
          serverUrl: storedServerUrl,
          projectId: parseInt(storedProjectId, 10),
          projects: storedProjects ? JSON.parse(storedProjects) : [],
          isLoading: false,
          isAuthenticated: true,
          needsProjectSelection: false,
        });
      } else if (storedUser && storedServerUrl && storedProjects) {
        setState({
          user: JSON.parse(storedUser),
          serverUrl: storedServerUrl,
          projectId: null,
          projects: JSON.parse(storedProjects),
          isLoading: false,
          isAuthenticated: false,
          needsProjectSelection: true,
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
      
      const loginResponse = await fetch(`${normalizedUrl}/api/mobile/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });

      if (!loginResponse.ok) {
        const errorText = await loginResponse.text();
        throw new Error(errorText || "Login failed");
      }

      const loginData = await loginResponse.json();

      const user: User = {
        id: loginData.user?.id || loginData.id,
        username: loginData.user?.username || loginData.username,
        displayName: loginData.user?.displayName || loginData.displayName || loginData.username,
        role: loginData.user?.role || loginData.role || "User",
      };

      const projectsResponse = await fetch(`${normalizedUrl}/api/mobile/users/${user.id}/projects`, {
        method: "GET",
        credentials: "include",
      });

      if (!projectsResponse.ok) {
        throw new Error("Failed to fetch projects");
      }

      const projectsData = await projectsResponse.json();
      const projects: Project[] = Array.isArray(projectsData) ? projectsData : projectsData.projects || [];

      await Promise.all([
        secureSet(STORAGE_KEYS.USER, JSON.stringify(user)),
        secureSet(STORAGE_KEYS.SERVER_URL, normalizedUrl),
        secureSet(STORAGE_KEYS.PROJECTS, JSON.stringify(projects)),
      ]);

      if (projects.length === 1) {
        await secureSet(STORAGE_KEYS.PROJECT_ID, String(projects[0].id));
        setState({
          user,
          serverUrl: normalizedUrl,
          projectId: projects[0].id,
          projects,
          isLoading: false,
          isAuthenticated: true,
          needsProjectSelection: false,
        });
      } else {
        setState({
          user,
          serverUrl: normalizedUrl,
          projectId: null,
          projects,
          isLoading: false,
          isAuthenticated: false,
          needsProjectSelection: true,
        });
      }
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, []);

  const selectProject = useCallback(async (projectId: number) => {
    await secureSet(STORAGE_KEYS.PROJECT_ID, String(projectId));
    setState(prev => ({
      ...prev,
      projectId,
      isAuthenticated: true,
      needsProjectSelection: false,
    }));
  }, []);

  const logout = useCallback(async () => {
    const storedServerUrl = await secureGet(STORAGE_KEYS.SERVER_URL);
    if (storedServerUrl) {
      try {
        await fetch(`${storedServerUrl}/api/mobile/auth/logout`, {
          method: "POST",
          credentials: "include",
        });
      } catch (e) {
        console.warn("Failed to logout from server:", e);
      }
    }
    
    await Promise.all([
      secureDelete(STORAGE_KEYS.USER),
      secureDelete(STORAGE_KEYS.PROJECT_ID),
      secureDelete(STORAGE_KEYS.PROJECTS),
    ]);

    setState(prev => ({
      ...prev,
      user: null,
      projectId: null,
      projects: [],
      isAuthenticated: false,
      needsProjectSelection: false,
    }));
  }, []);

  const updateServerUrl = useCallback(async (url: string) => {
    const normalizedUrl = url.endsWith("/") ? url.slice(0, -1) : url;
    await secureSet(STORAGE_KEYS.SERVER_URL, normalizedUrl);
    setState(prev => ({ ...prev, serverUrl: normalizedUrl }));
  }, []);

  const getApiUrl = useCallback((path: string) => {
    const { serverUrl, projectId } = state;
    if (!serverUrl || !projectId) return "";
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    return `${serverUrl}/api/projects/${projectId}${cleanPath}`;
  }, [state.serverUrl, state.projectId]);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, selectProject, updateServerUrl, getApiUrl }}>
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
