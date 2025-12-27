import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/contexts/AuthContext";
import { proxyRequest } from "@/lib/api-proxy";

interface PendingAction {
  id: string;
  type: "update" | "complete" | "workflow";
  workOrderId: string;
  workOrderTitle: string;
  data: any;
  timestamp: number;
}

interface OfflineContextType {
  isOnline: boolean;
  pendingActions: PendingAction[];
  isSyncing: boolean;
  addPendingAction: (action: Omit<PendingAction, "id" | "timestamp">) => Promise<void>;
  removePendingAction: (id: string) => Promise<void>;
  syncPendingActions: () => Promise<void>;
  clearAllPending: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

const STORAGE_KEYS = {
  PENDING_ACTIONS: "meterflo_pending_actions",
};

export function OfflineProvider({ children }: { children: ReactNode }) {
  const { serverUrl, projectId } = useAuth();
  const [isOnline, setIsOnline] = useState(true);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    loadStoredData();
    
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const online = state.isConnected ?? false;
      setIsOnline(online);
    });

    return () => unsubscribe();
  }, []);

  const loadStoredData = async () => {
    try {
      const storedActions = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_ACTIONS);
      if (storedActions) {
        setPendingActions(JSON.parse(storedActions));
      }
    } catch (error) {
      console.error("Failed to load offline data:", error);
    }
  };

  const addPendingAction = useCallback(async (action: Omit<PendingAction, "id" | "timestamp">) => {
    const newAction: PendingAction = {
      ...action,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    const updatedActions = [...pendingActions, newAction];
    setPendingActions(updatedActions);
    await AsyncStorage.setItem(STORAGE_KEYS.PENDING_ACTIONS, JSON.stringify(updatedActions));
  }, [pendingActions]);

  const removePendingAction = useCallback(async (id: string) => {
    const updatedActions = pendingActions.filter(a => a.id !== id);
    setPendingActions(updatedActions);
    await AsyncStorage.setItem(STORAGE_KEYS.PENDING_ACTIONS, JSON.stringify(updatedActions));
  }, [pendingActions]);

  const syncPendingActions = useCallback(async () => {
    if (!isOnline || pendingActions.length === 0 || isSyncing || !serverUrl || !projectId) return;

    setIsSyncing(true);
    try {
      const changes = pendingActions.map(action => ({
        workOrderId: parseInt(action.workOrderId, 10),
        changeType: action.type,
        data: action.data,
        clientTimestamp: new Date(action.timestamp).toISOString(),
      }));

      const result = await proxyRequest({
        serverUrl,
        method: "POST",
        path: `/api/projects/${projectId}/mobile/sync/upload`,
        body: {
          changes,
          clientTimestamp: new Date().toISOString(),
        },
      });
      
      if (result.conflicts && result.conflicts.length > 0) {
        console.warn("Sync conflicts detected:", result.conflicts);
      }

      const successfulIds = result.successful || pendingActions.map(a => a.id);
      
      const remainingActions = pendingActions.filter(
        action => !successfulIds.includes(action.id) && !successfulIds.includes(parseInt(action.workOrderId, 10))
      );
      
      if (remainingActions.length === 0) {
        setPendingActions([]);
        await AsyncStorage.removeItem(STORAGE_KEYS.PENDING_ACTIONS);
      } else {
        setPendingActions(remainingActions);
        await AsyncStorage.setItem(STORAGE_KEYS.PENDING_ACTIONS, JSON.stringify(remainingActions));
      }

    } catch (error) {
      console.error("Sync failed:", error);
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, pendingActions, isSyncing, serverUrl, projectId]);

  const clearAllPending = useCallback(async () => {
    setPendingActions([]);
    await AsyncStorage.removeItem(STORAGE_KEYS.PENDING_ACTIONS);
  }, []);

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        pendingActions,
        isSyncing,
        addPendingAction,
        removePendingAction,
        syncPendingActions,
        clearAllPending,
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const context = useContext(OfflineContext);
  if (context === undefined) {
    throw new Error("useOffline must be used within an OfflineProvider");
  }
  return context;
}
