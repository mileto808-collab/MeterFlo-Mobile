import Constants from "expo-constants";
import { Platform, Linking } from "react-native";

let Updates: any = null;
try {
  Updates = require("expo-updates");
} catch (e) {
  console.log("[UpdateService] expo-updates not available");
}

export type UpdateSource = "github" | "appstore" | "eas";

export interface UpdateConfig {
  android?: {
    source: "github";
    url: string;
  };
  ios?: {
    source: "appstore" | "eas";
    appStoreId?: string;
  };
}

export interface UpdateInfo {
  isUpdateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseNotes: string;
  releaseName: string;
  releaseUrl: string;
  downloadUrl: string | null;
  fileSize: number | null;
  publishedAt: string;
  source: UpdateSource;
  canInstallDirectly: boolean;
}

interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  html_url: string;
  assets: GitHubAsset[];
}

interface GitHubAsset {
  id: number;
  name: string;
  browser_download_url: string;
  size: number;
  content_type: string;
}

interface AppStoreLookupResult {
  resultCount: number;
  results: Array<{
    version: string;
    releaseNotes: string;
    trackViewUrl: string;
    currentVersionReleaseDate: string;
  }>;
}

function parseVersion(versionString: string): number[] {
  const cleanVersion = versionString.replace(/^v/, "").trim();
  return cleanVersion.split(".").map((part) => {
    const num = parseInt(part, 10);
    return isNaN(num) ? 0 : num;
  });
}

function compareVersions(current: string, latest: string): number {
  const currentParts = parseVersion(current);
  const latestParts = parseVersion(latest);
  
  const maxLength = Math.max(currentParts.length, latestParts.length);
  
  for (let i = 0; i < maxLength; i++) {
    const currentPart = currentParts[i] || 0;
    const latestPart = latestParts[i] || 0;
    
    if (latestPart > currentPart) {
      return 1;
    } else if (latestPart < currentPart) {
      return -1;
    }
  }
  
  return 0;
}

export function getCurrentAppVersion(): string {
  return Constants.expoConfig?.version || "1.0.0";
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

async function checkGitHubUpdate(url: string): Promise<UpdateInfo | null> {
  try {
    console.log("[UpdateService] Checking GitHub for updates at:", url);
    
    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "MeterFlo-Mobile",
      },
    });

    if (!response.ok) {
      console.warn("[UpdateService] Failed to fetch GitHub release:", response.status);
      return null;
    }

    const release: GitHubRelease = await response.json();
    const currentVersion = getCurrentAppVersion();
    const latestVersion = release.tag_name;
    
    const comparison = compareVersions(currentVersion, latestVersion);
    const isUpdateAvailable = comparison > 0;
    
    const apkAsset = release.assets.find(
      (asset) =>
        asset.name.toLowerCase().endsWith(".apk") ||
        asset.content_type === "application/vnd.android.package-archive"
    ) || null;
    
    console.log("[UpdateService] GitHub - Current:", currentVersion, "Latest:", latestVersion, "Update:", isUpdateAvailable);

    return {
      isUpdateAvailable,
      currentVersion,
      latestVersion: latestVersion.replace(/^v/, ""),
      releaseNotes: release.body || "No release notes available.",
      releaseName: release.name || `Version ${latestVersion}`,
      releaseUrl: release.html_url,
      downloadUrl: apkAsset?.browser_download_url || null,
      fileSize: apkAsset?.size || null,
      publishedAt: release.published_at,
      source: "github",
      canInstallDirectly: Platform.OS === "android",
    };
  } catch (error) {
    console.error("[UpdateService] Error checking GitHub updates:", error);
    return null;
  }
}

async function checkAppStoreUpdate(appStoreId: string): Promise<UpdateInfo | null> {
  try {
    const bundleId = Constants.expoConfig?.ios?.bundleIdentifier;
    
    let lookupUrl: string;
    if (appStoreId) {
      lookupUrl = `https://itunes.apple.com/lookup?id=${appStoreId}`;
    } else if (bundleId) {
      lookupUrl = `https://itunes.apple.com/lookup?bundleId=${bundleId}`;
    } else {
      console.warn("[UpdateService] No App Store ID or bundle ID available");
      return null;
    }
    
    console.log("[UpdateService] Checking App Store at:", lookupUrl);
    
    const response = await fetch(lookupUrl);
    
    if (!response.ok) {
      console.warn("[UpdateService] Failed to fetch App Store info:", response.status);
      return null;
    }
    
    const data: AppStoreLookupResult = await response.json();
    
    if (data.resultCount === 0 || !data.results[0]) {
      console.warn("[UpdateService] App not found in App Store");
      return null;
    }
    
    const appInfo = data.results[0];
    const currentVersion = getCurrentAppVersion();
    const latestVersion = appInfo.version;
    
    const comparison = compareVersions(currentVersion, latestVersion);
    const isUpdateAvailable = comparison > 0;
    
    console.log("[UpdateService] App Store - Current:", currentVersion, "Latest:", latestVersion, "Update:", isUpdateAvailable);
    
    return {
      isUpdateAvailable,
      currentVersion,
      latestVersion,
      releaseNotes: appInfo.releaseNotes || "No release notes available.",
      releaseName: `Version ${latestVersion}`,
      releaseUrl: appInfo.trackViewUrl,
      downloadUrl: appInfo.trackViewUrl,
      fileSize: null,
      publishedAt: appInfo.currentVersionReleaseDate,
      source: "appstore",
      canInstallDirectly: false,
    };
  } catch (error) {
    console.error("[UpdateService] Error checking App Store updates:", error);
    return null;
  }
}

async function checkEASUpdate(): Promise<UpdateInfo | null> {
  try {
    if (!Updates) {
      console.log("[UpdateService] expo-updates module not available");
      return null;
    }
    
    if (__DEV__) {
      console.log("[UpdateService] EAS Updates not available in development mode");
      return {
        isUpdateAvailable: false,
        currentVersion: getCurrentAppVersion(),
        latestVersion: getCurrentAppVersion(),
        releaseNotes: "EAS Updates are not available in development mode.",
        releaseName: "Development Build",
        releaseUrl: "",
        downloadUrl: null,
        fileSize: null,
        publishedAt: new Date().toISOString(),
        source: "eas",
        canInstallDirectly: false,
      };
    }
    
    console.log("[UpdateService] Checking for EAS updates...");
    
    const update = await Updates.checkForUpdateAsync();
    
    console.log("[UpdateService] EAS check result:", update.isAvailable);
    
    const currentVersion = getCurrentAppVersion();
    
    return {
      isUpdateAvailable: update.isAvailable,
      currentVersion,
      latestVersion: update.isAvailable ? "New Update" : currentVersion,
      releaseNotes: update.isAvailable ? "A new over-the-air update is available." : "You have the latest version.",
      releaseName: update.isAvailable ? "OTA Update" : "Current Version",
      releaseUrl: "",
      downloadUrl: null,
      fileSize: null,
      publishedAt: new Date().toISOString(),
      source: "eas",
      canInstallDirectly: update.isAvailable,
    };
  } catch (error) {
    console.error("[UpdateService] Error checking EAS updates:", error);
    return null;
  }
}

export async function checkForUpdate(config: UpdateConfig): Promise<UpdateInfo | null> {
  const platform = Platform.OS;
  
  if (platform === "android") {
    if (config.android?.source === "github" && config.android.url) {
      return checkGitHubUpdate(config.android.url);
    }
  } else if (platform === "ios") {
    if (config.ios?.source === "appstore") {
      return checkAppStoreUpdate(config.ios.appStoreId || "");
    } else if (config.ios?.source === "eas") {
      return checkEASUpdate();
    }
  }
  
  console.log("[UpdateService] No update configuration for platform:", platform);
  return null;
}

export async function applyUpdate(updateInfo: UpdateInfo): Promise<boolean> {
  try {
    if (updateInfo.source === "github" && Platform.OS === "android" && updateInfo.downloadUrl) {
      await Linking.openURL(updateInfo.downloadUrl);
      return true;
    }
    
    if (updateInfo.source === "appstore" && updateInfo.releaseUrl) {
      await Linking.openURL(updateInfo.releaseUrl);
      return true;
    }
    
    if (updateInfo.source === "eas" && updateInfo.canInstallDirectly && Updates) {
      if (!__DEV__) {
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync();
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error("[UpdateService] Error applying update:", error);
    return false;
  }
}

export function getUpdateSourceLabel(source: UpdateSource): string {
  switch (source) {
    case "github":
      return "GitHub Releases";
    case "appstore":
      return "App Store";
    case "eas":
      return "Over-the-Air";
    default:
      return "Unknown";
  }
}

export function getUpdateActionLabel(updateInfo: UpdateInfo): string {
  switch (updateInfo.source) {
    case "github":
      return "Download APK";
    case "appstore":
      return "Open App Store";
    case "eas":
      return "Install Update";
    default:
      return "Update";
  }
}

export function buildUpdateConfig(
  androidGitHubUrl: string | null,
  iosUpdateSource: "appstore" | "eas" | null,
  appStoreId: string | null
): UpdateConfig {
  const config: UpdateConfig = {};
  
  if (androidGitHubUrl) {
    config.android = {
      source: "github",
      url: androidGitHubUrl,
    };
  }
  
  if (iosUpdateSource === "appstore") {
    config.ios = {
      source: "appstore",
      appStoreId: appStoreId || undefined,
    };
  } else if (iosUpdateSource === "eas") {
    config.ios = {
      source: "eas",
    };
  }
  
  return config;
}
