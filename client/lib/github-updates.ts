import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import * as Application from "expo-application";
import { Platform, Linking } from "react-native";

const STORAGE_KEYS = {
  GITHUB_REPO_URL: "meterflo_github_repo_url",
  LAST_UPDATE_CHECK: "meterflo_last_update_check",
};

export interface UpdateInfo {
  versionName: string;
  versionCode?: number;
  apkUrl: string;
  releaseNotes?: string;
  forceUpdate?: boolean;
  minVersion?: string;
}

export interface UpdateCheckResult {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string | null;
  updateInfo: UpdateInfo | null;
  error: string | null;
}

function compareVersions(current: string, latest: string): number {
  const currentParts = current.split(".").map(Number);
  const latestParts = latest.split(".").map(Number);
  
  const maxLength = Math.max(currentParts.length, latestParts.length);
  
  for (let i = 0; i < maxLength; i++) {
    const currentPart = currentParts[i] || 0;
    const latestPart = latestParts[i] || 0;
    
    if (latestPart > currentPart) return 1;
    if (latestPart < currentPart) return -1;
  }
  
  return 0;
}

function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  try {
    const trimmed = url.trim().replace(/\/$/, "");
    const match = trimmed.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (match) {
      return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
    }
    return null;
  } catch {
    return null;
  }
}

export async function getStoredGitHubUrl(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(STORAGE_KEYS.GITHUB_REPO_URL);
  } catch {
    return null;
  }
}

export async function setGitHubUrl(url: string): Promise<void> {
  if (url.trim()) {
    await SecureStore.setItemAsync(STORAGE_KEYS.GITHUB_REPO_URL, url.trim());
  } else {
    await SecureStore.deleteItemAsync(STORAGE_KEYS.GITHUB_REPO_URL);
  }
}

export async function clearGitHubUrl(): Promise<void> {
  await SecureStore.deleteItemAsync(STORAGE_KEYS.GITHUB_REPO_URL);
}

export function getCurrentVersion(): string {
  return Application.nativeApplicationVersion || "1.0.0";
}

export async function checkForUpdates(repoUrl?: string): Promise<UpdateCheckResult> {
  const currentVersion = getCurrentVersion();
  const githubUrl = repoUrl || await getStoredGitHubUrl();
  
  if (!githubUrl) {
    return {
      updateAvailable: false,
      currentVersion,
      latestVersion: null,
      updateInfo: null,
      error: "No GitHub repository configured",
    };
  }
  
  const parsed = parseGitHubUrl(githubUrl);
  if (!parsed) {
    return {
      updateAvailable: false,
      currentVersion,
      latestVersion: null,
      updateInfo: null,
      error: "Invalid GitHub repository URL",
    };
  }
  
  try {
    const updateJsonUrl = `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/main/update.json`;
    
    const response = await fetch(updateJsonUrl, {
      headers: {
        "Cache-Control": "no-cache",
      },
    });
    
    if (!response.ok) {
      const fallbackUrl = `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/master/update.json`;
      const fallbackResponse = await fetch(fallbackUrl, {
        headers: {
          "Cache-Control": "no-cache",
        },
      });
      
      if (!fallbackResponse.ok) {
        return {
          updateAvailable: false,
          currentVersion,
          latestVersion: null,
          updateInfo: null,
          error: "Could not find update.json in the repository. Make sure the file exists in the main or master branch.",
        };
      }
      
      const updateInfo: UpdateInfo = await fallbackResponse.json();
      const comparison = compareVersions(currentVersion, updateInfo.versionName);
      
      return {
        updateAvailable: comparison > 0,
        currentVersion,
        latestVersion: updateInfo.versionName,
        updateInfo: comparison > 0 ? updateInfo : null,
        error: null,
      };
    }
    
    const updateInfo: UpdateInfo = await response.json();
    const comparison = compareVersions(currentVersion, updateInfo.versionName);
    
    await SecureStore.setItemAsync(STORAGE_KEYS.LAST_UPDATE_CHECK, new Date().toISOString());
    
    return {
      updateAvailable: comparison > 0,
      currentVersion,
      latestVersion: updateInfo.versionName,
      updateInfo: comparison > 0 ? updateInfo : null,
      error: null,
    };
    
  } catch (error) {
    return {
      updateAvailable: false,
      currentVersion,
      latestVersion: null,
      updateInfo: null,
      error: error instanceof Error ? error.message : "Failed to check for updates",
    };
  }
}

export async function downloadUpdate(apkUrl: string): Promise<void> {
  if (Platform.OS === "web") {
    window.open(apkUrl, "_blank");
    return;
  }
  
  try {
    await WebBrowser.openBrowserAsync(apkUrl);
  } catch {
    await Linking.openURL(apkUrl);
  }
}

export async function getLastUpdateCheck(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(STORAGE_KEYS.LAST_UPDATE_CHECK);
  } catch {
    return null;
  }
}
