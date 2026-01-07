import Constants from "expo-constants";
import { Platform } from "react-native";

export interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  html_url: string;
  assets: GitHubAsset[];
}

export interface GitHubAsset {
  id: number;
  name: string;
  browser_download_url: string;
  size: number;
  content_type: string;
}

export interface UpdateInfo {
  isUpdateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseNotes: string;
  releaseName: string;
  releaseUrl: string;
  apkDownloadUrl: string | null;
  apkSize: number | null;
  publishedAt: string;
}

function parseVersion(versionString: string): number[] {
  const cleanVersion = versionString.replace(/^v/, "").trim();
  return cleanVersion.split(".").map((part) => {
    const num = parseInt(part, 10);
    return isNaN(num) ? 0 : num;
  });
}

/**
 * Compares two version strings.
 * @returns 1 if latest > current (update available), -1 if current > latest, 0 if equal
 * Example: compareVersions("1.0.0", "2.0.0") returns 1 (update available)
 */
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

function findApkAsset(assets: GitHubAsset[]): GitHubAsset | null {
  return assets.find(
    (asset) =>
      asset.name.toLowerCase().endsWith(".apk") ||
      asset.content_type === "application/vnd.android.package-archive"
  ) || null;
}

export function getCurrentAppVersion(): string {
  return Constants.expoConfig?.version || "1.0.0";
}

export async function checkForUpdate(updateUrl: string): Promise<UpdateInfo | null> {
  if (!updateUrl) {
    console.log("[UpdateService] No update URL configured");
    return null;
  }

  try {
    console.log("[UpdateService] Checking for updates at:", updateUrl);
    
    const response = await fetch(updateUrl, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "MeterFlo-Mobile",
      },
    });

    if (!response.ok) {
      console.warn("[UpdateService] Failed to fetch release info:", response.status);
      return null;
    }

    const release: GitHubRelease = await response.json();
    const currentVersion = getCurrentAppVersion();
    const latestVersion = release.tag_name;
    
    const comparison = compareVersions(currentVersion, latestVersion);
    const isUpdateAvailable = comparison > 0;
    
    const apkAsset = findApkAsset(release.assets);
    
    console.log("[UpdateService] Current version:", currentVersion);
    console.log("[UpdateService] Latest version:", latestVersion);
    console.log("[UpdateService] Update available:", isUpdateAvailable);

    return {
      isUpdateAvailable,
      currentVersion,
      latestVersion: latestVersion.replace(/^v/, ""),
      releaseNotes: release.body || "No release notes available.",
      releaseName: release.name || `Version ${latestVersion}`,
      releaseUrl: release.html_url,
      apkDownloadUrl: apkAsset?.browser_download_url || null,
      apkSize: apkAsset?.size || null,
      publishedAt: release.published_at,
    };
  } catch (error) {
    console.error("[UpdateService] Error checking for updates:", error);
    return null;
  }
}

export function canInstallUpdate(): boolean {
  return Platform.OS === "android";
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
