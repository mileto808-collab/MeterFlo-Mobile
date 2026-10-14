import { useCallback, useEffect, useRef, useState } from "react";
import { useWorkOrders } from "@/contexts/WorkOrderContext";
import { useOffline } from "@/contexts/OfflineContext";
import { useAuth } from "@/contexts/AuthContext";
import { ReadingError } from "@/lib/reading-precision";

export function useReadingSettings() {
  const { projectConfig, refreshProjectConfig } = useWorkOrders();
  const { isOnline } = useOffline();
  const { isOfflineSession, revalidateSession } = useAuth();
  const canRefresh = isOnline && !isOfflineSession;
  const [ready, setReady] = useState(false);
  const loadedRequest = useRef<typeof refreshProjectConfig | null>(null);
  const [error, setError] = useState("");
  const [serverErrors, setServerErrors] = useState<ReadingError[]>([]);
  const retry = useCallback(async () => {
    setReady(false);
    setError("");
    try {
      const online = isOnline && (!isOfflineSession || await revalidateSession());
      const config = await refreshProjectConfig(online, true);
      loadedRequest.current = refreshProjectConfig;
      setReady(true);
      return config;
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to load reading settings.");
      return null;
    }
  }, [refreshProjectConfig, isOnline, isOfflineSession, revalidateSession]);
  useEffect(() => {
    let active = true;
    setReady(false);
    setError("");
    void refreshProjectConfig(canRefresh, true).then(() => {
      if (active) {
        loadedRequest.current = refreshProjectConfig;
        setReady(true);
      }
    }).catch(error => {
      if (active) setError(error.message);
    });
    return () => { active = false; };
  }, [refreshProjectConfig, canRefresh]);
  return {
    ready: ready && loadedRequest.current === refreshProjectConfig,
    error, retry, limits: projectConfig, serverErrors, setServerErrors,
    usingCache: projectConfig.readingSettingsSource === "cache",
  };
}
