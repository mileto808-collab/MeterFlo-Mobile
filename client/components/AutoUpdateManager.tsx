import React, { useEffect, useState, useCallback } from "react";
import { Platform, AppState, AppStateStatus } from "react-native";
import * as SecureStore from "expo-secure-store";
import { useAuth } from "@/contexts/AuthContext";
import { checkForUpdate, UpdateInfo } from "@/lib/github-update-service";
import { UpdateAvailableModal } from "./UpdateAvailableModal";

const STORAGE_KEYS = {
  SKIPPED_VERSION: "meterflo_skipped_version",
  UPDATE_CHECK_ENABLED: "meterflo_update_check_enabled",
  LAST_UPDATE_CHECK: "meterflo_last_update_check",
};

const MIN_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

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

export function AutoUpdateManager() {
  const { isAuthenticated, getUpdateUrl } = useAuth();
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  const performUpdateCheck = useCallback(async () => {
    if (!isAuthenticated || hasChecked) {
      return;
    }

    try {
      const updateCheckEnabled = await secureGet(STORAGE_KEYS.UPDATE_CHECK_ENABLED);
      if (updateCheckEnabled === "false") {
        console.log("[AutoUpdate] Update checks disabled by user");
        return;
      }

      const lastCheck = await secureGet(STORAGE_KEYS.LAST_UPDATE_CHECK);
      const now = Date.now();
      
      if (lastCheck) {
        const lastCheckTime = parseInt(lastCheck, 10);
        if (now - lastCheckTime < MIN_CHECK_INTERVAL_MS) {
          console.log("[AutoUpdate] Skipping check - checked recently");
          setHasChecked(true);
          return;
        }
      }

      const updateUrl = await getUpdateUrl();
      if (!updateUrl) {
        console.log("[AutoUpdate] No update URL configured");
        setHasChecked(true);
        return;
      }

      console.log("[AutoUpdate] Checking for updates...");
      const info = await checkForUpdate(updateUrl);
      
      setHasChecked(true);

      if (!info) {
        console.log("[AutoUpdate] Failed to fetch update info - will retry next time");
        return;
      }

      await secureSet(STORAGE_KEYS.LAST_UPDATE_CHECK, String(now));

      if (!info.isUpdateAvailable) {
        console.log("[AutoUpdate] No update available");
        return;
      }

      const skippedVersion = await secureGet(STORAGE_KEYS.SKIPPED_VERSION);
      if (skippedVersion === info.latestVersion) {
        console.log("[AutoUpdate] User skipped this version:", info.latestVersion);
        return;
      }

      console.log("[AutoUpdate] Update available:", info.latestVersion);
      setUpdateInfo(info);
      setShowModal(true);
    } catch (error) {
      console.error("[AutoUpdate] Error checking for updates:", error);
      setHasChecked(true);
    }
  }, [isAuthenticated, getUpdateUrl, hasChecked]);

  useEffect(() => {
    if (isAuthenticated && !hasChecked) {
      const timer = setTimeout(() => {
        performUpdateCheck();
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, hasChecked, performUpdateCheck]);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === "active" && isAuthenticated) {
        setHasChecked(false);
      }
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription.remove();
  }, [isAuthenticated]);

  const handleClose = useCallback(() => {
    setShowModal(false);
  }, []);

  const handleSkip = useCallback(async () => {
    if (updateInfo) {
      await secureSet(STORAGE_KEYS.SKIPPED_VERSION, updateInfo.latestVersion);
    }
    setShowModal(false);
  }, [updateInfo]);

  return (
    <UpdateAvailableModal
      visible={showModal}
      updateInfo={updateInfo}
      onClose={handleClose}
      onSkip={handleSkip}
    />
  );
}
