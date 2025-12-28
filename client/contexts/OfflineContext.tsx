import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/contexts/AuthContext";

interface PendingAction {
  id: string;
  type: "update" | "complete" | "workflow" | "claim";
  workOrderId: string;
  workOrderTitle: string;
  data: any;
  timestamp: number;
  photoCount?: number;
}

interface SyncHistoryEntry {
  id: string;
  timestamp: number;
  workOrderIds: string[];
  workOrderTitles: string[];
  status: "success" | "failed" | "partial";
  successCount: number;
  failedCount: number;
  photoCount: number;
  errorMessage?: string;
}

interface OfflineContextType {
  isOnline: boolean;
  pendingActions: PendingAction[];
  syncHistory: SyncHistoryEntry[];
  isSyncing: boolean;
  addPendingAction: (action: Omit<PendingAction, "id" | "timestamp">) => Promise<void>;
  removePendingAction: (id: string) => Promise<void>;
  syncPendingActions: () => Promise<number[]>;
  clearAllPending: () => Promise<void>;
  clearSyncHistory: () => Promise<void>;
  addDirectSubmissionHistory: (entry: Omit<SyncHistoryEntry, "id" | "timestamp">) => Promise<void>;
}

export type { SyncHistoryEntry };

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

const STORAGE_KEYS = {
  PENDING_ACTIONS: "meterflo_pending_actions",
  SYNC_HISTORY: "meterflo_sync_history",
};

const MAX_SYNC_HISTORY = 20;

export function OfflineProvider({ children }: { children: ReactNode }) {
  const { serverUrl, projectId } = useAuth();
  const [isOnline, setIsOnline] = useState(true);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [syncHistory, setSyncHistory] = useState<SyncHistoryEntry[]>([]);
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
      
      const storedHistory = await AsyncStorage.getItem(STORAGE_KEYS.SYNC_HISTORY);
      if (storedHistory) {
        setSyncHistory(JSON.parse(storedHistory));
      }
    } catch (error) {
      console.error("Failed to load offline data:", error);
    }
  };
  
  const addSyncHistoryEntry = useCallback(async (entry: SyncHistoryEntry) => {
    const updatedHistory = [entry, ...syncHistory].slice(0, MAX_SYNC_HISTORY);
    setSyncHistory(updatedHistory);
    await AsyncStorage.setItem(STORAGE_KEYS.SYNC_HISTORY, JSON.stringify(updatedHistory));
  }, [syncHistory]);

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

  const syncPendingActions = useCallback(async (): Promise<number[]> => {
    if (!isOnline || pendingActions.length === 0 || isSyncing || !serverUrl || !projectId) return [];

    setIsSyncing(true);
    const workOrderIds = pendingActions.map(a => a.workOrderId);
    const workOrderTitles = pendingActions.map(a => a.workOrderTitle);
    const totalPhotoCount = pendingActions.reduce((sum, a) => sum + (a.photoCount || 0), 0);
    
    try {
      const changes = pendingActions.map(action => ({
        workOrderId: parseInt(action.workOrderId, 10),
        changeType: action.type,
        data: action.data,
        clientTimestamp: new Date(action.timestamp).toISOString(),
      }));

      const response = await fetch(`${serverUrl}/api/projects/${projectId}/mobile/sync/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          workOrders: changes,
          clientTimestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Sync failed");
      }

      const result = await response.json();
      
      if (result.conflicts && result.conflicts.length > 0) {
        console.warn("Sync conflicts detected:", result.conflicts);
      }

      const successfulIds = result.successful || pendingActions.map(a => a.id);
      
      const remainingActions = pendingActions.filter(
        action => !successfulIds.includes(action.id) && !successfulIds.includes(parseInt(action.workOrderId, 10))
      );
      
      const successCount = pendingActions.length - remainingActions.length;
      const failedCount = remainingActions.length;
      
      const syncedWorkOrderIds = pendingActions
        .filter(action => !remainingActions.some(ra => ra.id === action.id))
        .map(action => parseInt(action.workOrderId, 10))
        .filter(woId => !remainingActions.some(ra => parseInt(ra.workOrderId, 10) === woId));
      
      await addSyncHistoryEntry({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        workOrderIds,
        workOrderTitles,
        status: failedCount === 0 ? "success" : (successCount > 0 ? "partial" : "failed"),
        successCount,
        failedCount,
        photoCount: totalPhotoCount,
      });
      
      if (remainingActions.length === 0) {
        setPendingActions([]);
        await AsyncStorage.removeItem(STORAGE_KEYS.PENDING_ACTIONS);
      } else {
        setPendingActions(remainingActions);
        await AsyncStorage.setItem(STORAGE_KEYS.PENDING_ACTIONS, JSON.stringify(remainingActions));
      }
      
      return syncedWorkOrderIds;

    } catch (error) {
      console.error("Sync failed:", error);
      
      await addSyncHistoryEntry({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        workOrderIds,
        workOrderTitles,
        status: "failed",
        successCount: 0,
        failedCount: pendingActions.length,
        photoCount: totalPhotoCount,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
      
      return [];
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, pendingActions, isSyncing, serverUrl, projectId, addSyncHistoryEntry]);

  const clearAllPending = useCallback(async () => {
    setPendingActions([]);
    await AsyncStorage.removeItem(STORAGE_KEYS.PENDING_ACTIONS);
  }, []);
  
  const clearSyncHistory = useCallback(async () => {
    setSyncHistory([]);
    await AsyncStorage.removeItem(STORAGE_KEYS.SYNC_HISTORY);
  }, []);
  
  const addDirectSubmissionHistory = useCallback(async (entry: Omit<SyncHistoryEntry, "id" | "timestamp">) => {
    const fullEntry: SyncHistoryEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };
    await addSyncHistoryEntry(fullEntry);
  }, [addSyncHistoryEntry]);

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        pendingActions,
        syncHistory,
        isSyncing,
        addPendingAction,
        removePendingAction,
        syncPendingActions,
        clearAllPending,
        clearSyncHistory,
        addDirectSubmissionHistory,
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
