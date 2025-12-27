import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
  lastSyncTime: Date | null;
  isSyncing: boolean;
  addPendingAction: (action: Omit<PendingAction, "id" | "timestamp">) => Promise<void>;
  removePendingAction: (id: string) => Promise<void>;
  syncPendingActions: () => Promise<void>;
  clearAllPending: () => Promise<void>;
  updateLastSyncTime: () => void;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

const STORAGE_KEYS = {
  PENDING_ACTIONS: "meterflo_pending_actions",
  LAST_SYNC: "meterflo_last_sync",
};

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
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
      const [storedActions, storedSync] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.PENDING_ACTIONS),
        AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC),
      ]);

      if (storedActions) {
        setPendingActions(JSON.parse(storedActions));
      }
      if (storedSync) {
        setLastSyncTime(new Date(storedSync));
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
    if (!isOnline || pendingActions.length === 0 || isSyncing) return;

    setIsSyncing(true);
    try {
      for (const action of pendingActions) {
        await removePendingAction(action.id);
      }
      updateLastSyncTime();
    } catch (error) {
      console.error("Sync failed:", error);
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, pendingActions, isSyncing, removePendingAction]);

  const clearAllPending = useCallback(async () => {
    setPendingActions([]);
    await AsyncStorage.removeItem(STORAGE_KEYS.PENDING_ACTIONS);
  }, []);

  const updateLastSyncTime = useCallback(() => {
    const now = new Date();
    setLastSyncTime(now);
    AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, now.toISOString());
  }, []);

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        pendingActions,
        lastSyncTime,
        isSyncing,
        addPendingAction,
        removePendingAction,
        syncPendingActions,
        clearAllPending,
        updateLastSyncTime,
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
