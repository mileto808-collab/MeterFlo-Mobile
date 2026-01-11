import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";
import NetInfo from "@react-native-community/netinfo";

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
  isOfflineSession: boolean;
  updateUrl: string | null;
  mobileApiKey: string;
}

interface AuthContextType extends AuthState {
  login: (serverUrl: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  selectProject: (projectId: number) => Promise<void>;
  updateServerUrl: (url: string) => Promise<void>;
  getApiUrl: (path: string) => string;
  revalidateSession: () => Promise<boolean>;
  getUpdateUrl: () => Promise<string | null>;
  setMobileApiKey: (key: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEYS = {
  USER: "meterflo_user",
  SERVER_URL: "meterflo_server_url",
  PROJECT_ID: "meterflo_project_id",
  PROJECTS: "meterflo_projects",
  CREDENTIALS: "meterflo_credentials",
  UPDATE_URL: "meterflo_update_url",
  MOBILE_API_KEY: "meterflo_mobile_api_key",
};

interface StoredCredentials {
  serverUrl: string;
  username: string;
  passwordHash: string;
  salt: string;
  password: string;
  user: User;
  projects: Project[];
  lastProjectId: number | null;
}

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

async function generateSalt(): Promise<string> {
  const randomBytes = await Crypto.getRandomBytesAsync(16);
  return Array.from(new Uint8Array(randomBytes)).map((b: number) => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const combined = salt + password;
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    combined
  );
  return hash;
}

async function getStoredCredentials(): Promise<StoredCredentials | null> {
  try {
    const stored = await secureGet(STORAGE_KEYS.CREDENTIALS);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn("Failed to get stored credentials:", e);
  }
  return null;
}

async function storeCredentials(creds: StoredCredentials): Promise<void> {
  await secureSet(STORAGE_KEYS.CREDENTIALS, JSON.stringify(creds));
}

async function isNetworkAvailable(): Promise<boolean> {
  try {
    const netState = await NetInfo.fetch();
    return netState.isConnected === true && netState.isInternetReachable !== false;
  } catch {
    return false;
  }
}

async function isServerReachable(serverUrl: string, timeoutMs: number = 5000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    const response = await fetch(`${serverUrl}/api/health`, {
      method: "GET",
      headers: {
        "X-Requested-With": "XMLHttpRequest",
        "Origin": serverUrl,
        "Referer": `${serverUrl}/`,
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
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
    isOfflineSession: false,
    updateUrl: null,
    mobileApiKey: "",
  });

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const [storedUser, storedServerUrl, storedProjectId, storedProjects, storedUpdateUrl, storedMobileApiKey] = await Promise.all([
        secureGet(STORAGE_KEYS.USER),
        secureGet(STORAGE_KEYS.SERVER_URL),
        secureGet(STORAGE_KEYS.PROJECT_ID),
        secureGet(STORAGE_KEYS.PROJECTS),
        secureGet(STORAGE_KEYS.UPDATE_URL),
        secureGet(STORAGE_KEYS.MOBILE_API_KEY),
      ]);
      
      const mobileApiKey = storedMobileApiKey || "";

      if (storedUser && storedServerUrl && storedProjectId) {
        setState({
          user: JSON.parse(storedUser),
          serverUrl: storedServerUrl,
          projectId: parseInt(storedProjectId, 10),
          projects: storedProjects ? JSON.parse(storedProjects) : [],
          isLoading: false,
          isAuthenticated: true,
          needsProjectSelection: false,
          isOfflineSession: false,
          updateUrl: storedUpdateUrl || null,
          mobileApiKey,
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
          isOfflineSession: false,
          updateUrl: storedUpdateUrl || null,
          mobileApiKey,
        });
      } else {
        setState(prev => ({
          ...prev,
          serverUrl: storedServerUrl || "",
          mobileApiKey,
          isLoading: false,
        }));
      }
    } catch (error) {
      console.error("Failed to load stored auth:", error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const attemptOfflineLogin = async (
    serverUrl: string,
    username: string,
    password: string
  ): Promise<{ success: boolean; user?: User; projects?: Project[]; projectId?: number | null }> => {
    const storedCreds = await getStoredCredentials();
    
    if (!storedCreds) {
      return { success: false };
    }

    const normalizedUrl = serverUrl.endsWith("/") ? serverUrl.slice(0, -1) : serverUrl;
    
    if (storedCreds.serverUrl !== normalizedUrl) {
      return { success: false };
    }

    if (storedCreds.username.toLowerCase() !== username.toLowerCase()) {
      return { success: false };
    }

    const passwordHash = await hashPassword(password, storedCreds.salt);
    
    if (passwordHash !== storedCreds.passwordHash) {
      return { success: false };
    }

    return {
      success: true,
      user: storedCreds.user,
      projects: storedCreds.projects,
      projectId: storedCreds.lastProjectId,
    };
  };

  const login = useCallback(async (serverUrl: string, username: string, password: string) => {
    setState(prev => ({ ...prev, isLoading: true }));

    const normalizedUrl = serverUrl.endsWith("/") ? serverUrl.slice(0, -1) : serverUrl;

    try {
      const networkAvailable = await isNetworkAvailable();
      const serverReachable = networkAvailable ? await isServerReachable(normalizedUrl) : false;

      if (!networkAvailable || !serverReachable) {
        const offlineResult = await attemptOfflineLogin(normalizedUrl, username, password);
        
        if (!offlineResult.success) {
          throw new Error(
            networkAvailable
              ? "Server is unreachable and no saved credentials found for this account."
              : "You are offline and no saved credentials found for this account."
          );
        }

        const { user, projects, projectId } = offlineResult;

        await Promise.all([
          secureSet(STORAGE_KEYS.USER, JSON.stringify(user)),
          secureSet(STORAGE_KEYS.SERVER_URL, normalizedUrl),
          secureSet(STORAGE_KEYS.PROJECTS, JSON.stringify(projects)),
        ]);

        // Get stored update URL for offline login
        const storedUpdateUrl = await secureGet(STORAGE_KEYS.UPDATE_URL);
        
        if (projectId) {
          await secureSet(STORAGE_KEYS.PROJECT_ID, String(projectId));
          setState(prev => ({
            ...prev,
            user: user!,
            serverUrl: normalizedUrl,
            projectId,
            projects: projects!,
            isLoading: false,
            isAuthenticated: true,
            needsProjectSelection: false,
            isOfflineSession: true,
            updateUrl: storedUpdateUrl || null,
          }));
        } else if (projects && projects.length === 1) {
          await secureSet(STORAGE_KEYS.PROJECT_ID, String(projects[0].id));
          setState(prev => ({
            ...prev,
            user: user!,
            serverUrl: normalizedUrl,
            projectId: projects[0].id,
            projects: projects!,
            isLoading: false,
            isAuthenticated: true,
            needsProjectSelection: false,
            isOfflineSession: true,
            updateUrl: storedUpdateUrl || null,
          }));
        } else {
          setState(prev => ({
            ...prev,
            user: user!,
            serverUrl: normalizedUrl,
            projectId: null,
            projects: projects!,
            isLoading: false,
            isAuthenticated: false,
            needsProjectSelection: true,
            isOfflineSession: true,
            updateUrl: storedUpdateUrl || null,
          }));
        }
        return;
      }
      
      // Get mobile API key for CAPTCHA bypass
      const storedMobileApiKey = await secureGet(STORAGE_KEYS.MOBILE_API_KEY);
      
      console.log(`[Auth] Attempting login to: ${normalizedUrl}/api/auth/local/login`);
      console.log(`[Auth] Headers: Origin=${normalizedUrl}, X-Requested-With=XMLHttpRequest, Referer=${normalizedUrl}/`);
      if (storedMobileApiKey) {
        console.log(`[Auth] Using mobile API key for CAPTCHA bypass`);
      }
      
      const loginHeaders: Record<string, string> = { 
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
        "Origin": normalizedUrl,
        "Referer": `${normalizedUrl}/`,
      };
      
      // Add mobile API key header if configured
      if (storedMobileApiKey) {
        loginHeaders["X-MeterFlo-Mobile-Key"] = storedMobileApiKey;
      }
      
      const loginResponse = await fetch(`${normalizedUrl}/api/auth/local/login`, {
        method: "POST",
        headers: loginHeaders,
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });

      console.log(`[Auth] Login response status: ${loginResponse.status}`);
      
      if (!loginResponse.ok) {
        const errorText = await loginResponse.text();
        console.error(`[Auth] Login failed: ${loginResponse.status} - ${errorText?.substring(0, 500)}`);
        throw new Error(errorText || "Login failed");
      }

      const loginData = await loginResponse.json();

      const user: User = {
        id: loginData.user?.id || loginData.id,
        username: loginData.user?.username || loginData.username,
        displayName: loginData.user?.displayName || loginData.displayName || loginData.username,
        role: loginData.user?.role || loginData.role || "User",
      };

      const projectsResponse = await fetch(`${normalizedUrl}/api/users/${user.id}/projects`, {
        method: "GET",
        headers: {
          "X-Requested-With": "XMLHttpRequest",
          "Origin": normalizedUrl,
          "Referer": `${normalizedUrl}/`,
        },
        credentials: "include",
      });

      if (!projectsResponse.ok) {
        throw new Error("Failed to fetch projects");
      }

      const projectsData = await projectsResponse.json();
      const projects: Project[] = Array.isArray(projectsData) ? projectsData : projectsData.projects || [];
      
      // Extract mobileConfig.updateUrl if provided by server
      const updateUrl: string | null = projectsData?.mobileConfig?.updateUrl || null;

      const salt = await generateSalt();
      const passwordHash = await hashPassword(password, salt);
      
      await storeCredentials({
        serverUrl: normalizedUrl,
        username: user.username,
        passwordHash,
        salt,
        password,
        user,
        projects,
        lastProjectId: null,
      });

      const storagePromises = [
        secureSet(STORAGE_KEYS.USER, JSON.stringify(user)),
        secureSet(STORAGE_KEYS.SERVER_URL, normalizedUrl),
        secureSet(STORAGE_KEYS.PROJECTS, JSON.stringify(projects)),
      ];
      
      // Store or clear update URL
      if (updateUrl) {
        storagePromises.push(secureSet(STORAGE_KEYS.UPDATE_URL, updateUrl));
      } else {
        storagePromises.push(secureDelete(STORAGE_KEYS.UPDATE_URL));
      }
      
      await Promise.all(storagePromises);

      if (projects.length === 1) {
        await secureSet(STORAGE_KEYS.PROJECT_ID, String(projects[0].id));
        
        const storedCreds = await getStoredCredentials();
        if (storedCreds) {
          await storeCredentials({ ...storedCreds, lastProjectId: projects[0].id });
        }
        
        setState(prev => ({
          ...prev,
          user,
          serverUrl: normalizedUrl,
          projectId: projects[0].id,
          projects,
          isLoading: false,
          isAuthenticated: true,
          needsProjectSelection: false,
          isOfflineSession: false,
          updateUrl,
        }));
      } else {
        setState(prev => ({
          ...prev,
          user,
          serverUrl: normalizedUrl,
          projectId: null,
          projects,
          isLoading: false,
          isAuthenticated: false,
          needsProjectSelection: true,
          isOfflineSession: false,
          updateUrl,
        }));
      }
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, []);

  const selectProject = useCallback(async (projectId: number) => {
    await secureSet(STORAGE_KEYS.PROJECT_ID, String(projectId));
    
    const storedCreds = await getStoredCredentials();
    if (storedCreds) {
      await storeCredentials({ ...storedCreds, lastProjectId: projectId });
    }
    
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
        await fetch(`${storedServerUrl}/api/auth/logout`, {
          method: "POST",
          headers: {
            "X-Requested-With": "XMLHttpRequest",
            "Origin": storedServerUrl,
            "Referer": `${storedServerUrl}/`,
          },
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
      isOfflineSession: false,
    }));
  }, []);

  const revalidateSession = useCallback(async (): Promise<boolean> => {
    if (!state.isOfflineSession || !state.user || !state.serverUrl) {
      return true;
    }

    try {
      const networkAvailable = await isNetworkAvailable();
      if (!networkAvailable) {
        console.log("[Auth] Network not available for revalidation");
        return false;
      }

      const serverReachable = await isServerReachable(state.serverUrl);
      if (!serverReachable) {
        console.log("[Auth] Server not reachable for revalidation");
        return false;
      }

      const storedCreds = await getStoredCredentials();
      if (!storedCreds || !storedCreds.password) {
        console.log("[Auth] No stored credentials for revalidation");
        return false;
      }

      console.log("[Auth] Attempting silent re-authentication...");
      
      // Get mobile API key for CAPTCHA bypass
      const storedMobileApiKey = await secureGet(STORAGE_KEYS.MOBILE_API_KEY);
      
      const loginHeaders: Record<string, string> = { 
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
        "Origin": state.serverUrl,
        "Referer": `${state.serverUrl}/`,
      };
      
      if (storedMobileApiKey) {
        loginHeaders["X-MeterFlo-Mobile-Key"] = storedMobileApiKey;
      }
      
      const loginResponse = await fetch(`${state.serverUrl}/api/auth/local/login`, {
        method: "POST",
        headers: loginHeaders,
        credentials: "include",
        body: JSON.stringify({ 
          username: storedCreds.username, 
          password: storedCreds.password 
        }),
      });

      if (!loginResponse.ok) {
        console.warn("[Auth] Silent re-authentication failed, user may need to login again");
        return false;
      }

      console.log("[Auth] Silent re-authentication successful");
      setState(prev => ({ ...prev, isOfflineSession: false }));
      return true;
    } catch (error) {
      console.warn("[Auth] Failed to revalidate session:", error);
      return false;
    }
  }, [state.isOfflineSession, state.user, state.serverUrl]);

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

  const getUpdateUrl = useCallback(async (): Promise<string | null> => {
    // Return from state if available
    if (state.updateUrl) {
      return state.updateUrl;
    }
    // Otherwise check storage
    const storedUrl = await secureGet(STORAGE_KEYS.UPDATE_URL);
    return storedUrl || null;
  }, [state.updateUrl]);

  const setMobileApiKey = useCallback(async (key: string) => {
    const trimmedKey = key.trim();
    if (trimmedKey) {
      await secureSet(STORAGE_KEYS.MOBILE_API_KEY, trimmedKey);
    } else {
      await secureDelete(STORAGE_KEYS.MOBILE_API_KEY);
    }
    setState(prev => ({ ...prev, mobileApiKey: trimmedKey }));
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, selectProject, updateServerUrl, getApiUrl, revalidateSession, getUpdateUrl, setMobileApiKey }}>
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
