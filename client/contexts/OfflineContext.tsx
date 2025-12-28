import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
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
  completionMode?: "complete" | "trouble";
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
        let actions: PendingAction[] = JSON.parse(storedActions);
        
        let needsMigration = false;
        actions = actions.map(action => {
          if (action.type === "complete" && !action.completionMode) {
            needsMigration = true;
            const data = action.data;
            const isComplete = data.status === "Completed" || data.new_meter_id !== undefined;
            
            const formatLegacyPhotos = (photos: any[], prefix: string) => {
              if (!photos || !Array.isArray(photos)) return [];
              return photos.map((photo, idx) => {
                if (typeof photo === 'string') {
                  return {
                    base64: photo.startsWith('data:') ? photo : `data:image/jpeg;base64,${photo}`,
                    filename: `${prefix}_${idx + 1}.jpg`,
                  };
                }
                return photo;
              });
            };
            
            const migratedPayload = isComplete ? {
              projectId: data.projectId || 0,
              oldMeterReading: data.old_meter_reading ?? data.oldMeterReading,
              newMeterId: data.new_meter_id ?? data.newMeterId,
              newMeterReading: data.new_meter_reading ?? data.newMeterReading ?? 0,
              gpsCoordinates: data.new_gps ?? data.gpsCoordinates ?? null,
              signatureData: data.signature_data ?? data.signatureData ?? null,
              signatureName: data.signature_name ?? data.signatureName,
              completedAt: data.completed_at ?? data.completedAt,
              notes: data.notes ?? null,
              beforePhotos: formatLegacyPhotos(data.before_photos ?? data.beforePhotos ?? [], 'before'),
              afterPhotos: formatLegacyPhotos(data.after_photos ?? data.afterPhotos ?? [], 'after'),
            } : {
              projectId: data.projectId || 0,
              troubleCode: data.trouble ?? data.troubleCode,
              notes: data.notes ?? null,
              oldMeterReading: data.old_meter_reading ?? data.oldMeterReading,
              photos: formatLegacyPhotos(data.trouble_photos ?? data.photos ?? [], 'trouble'),
            };
            
            console.log(`[OfflineContext] Migrated legacy pending action for WO ${action.workOrderId}`);
            return {
              ...action,
              data: migratedPayload,
              completionMode: isComplete ? "complete" as const : "trouble" as const,
            };
          }
          return action;
        });
        
        if (needsMigration) {
          await AsyncStorage.setItem(STORAGE_KEYS.PENDING_ACTIONS, JSON.stringify(actions));
          console.log("[OfflineContext] Migrated legacy pending actions to new format");
        }
        
        setPendingActions(actions);
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
    
    const successfulActionIds: string[] = [];
    const failedActionIds: string[] = [];
    let lastError: string | undefined;
    
    try {
      for (const action of pendingActions) {
        try {
          if (action.type === "complete" && action.completionMode) {
            const endpoint = action.completionMode === "complete"
              ? `${serverUrl}/api/mobile/workorders/${action.workOrderId}/complete`
              : `${serverUrl}/api/mobile/workorders/${action.workOrderId}/trouble`;
            
            console.log(`[syncPendingActions] Syncing ${action.completionMode} for WO ${action.workOrderId} to ${endpoint}`);
            
            const payloadWithProjectId = {
              ...action.data,
              projectId: action.data.projectId || Number(projectId),
            };
            
            const response = await fetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify(payloadWithProjectId),
            });
            
            if (!response.ok) {
              const errorText = await response.text();
              console.error(`[syncPendingActions] Failed to sync WO ${action.workOrderId}:`, response.status, errorText?.substring(0, 200));
              throw new Error(errorText || `Failed to sync work order ${action.workOrderId}`);
            }
            
            console.log(`[syncPendingActions] Successfully synced WO ${action.workOrderId}`);
            successfulActionIds.push(action.id);
          } else if (action.type === "claim") {
            const claimEndpoint = `${serverUrl}/api/projects/${projectId}/work-orders/${action.workOrderId}/claim`;
            console.log(`[syncPendingActions] Syncing claim for WO ${action.workOrderId}`);
            
            const response = await fetch(claimEndpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
            });
            
            if (!response.ok) {
              const errorText = await response.text();
              console.error(`[syncPendingActions] Failed to claim WO ${action.workOrderId}:`, response.status, errorText?.substring(0, 200));
              throw new Error(errorText || `Failed to claim work order ${action.workOrderId}`);
            }
            
            console.log(`[syncPendingActions] Successfully claimed WO ${action.workOrderId}`);
            successfulActionIds.push(action.id);
          } else {
            const batchResponse = await fetch(`${serverUrl}/api/projects/${projectId}/mobile/sync/upload`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                workOrders: [{
                  workOrderId: parseInt(action.workOrderId, 10),
                  changeType: action.type,
                  data: action.data,
                  clientTimestamp: new Date(action.timestamp).toISOString(),
                }],
                clientTimestamp: new Date().toISOString(),
              }),
            });
            
            if (!batchResponse.ok) {
              const errorText = await batchResponse.text();
              throw new Error(errorText || `Failed to sync work order ${action.workOrderId}`);
            }
            
            successfulActionIds.push(action.id);
          }
        } catch (actionError) {
          console.error(`[syncPendingActions] Error syncing action ${action.id}:`, actionError);
          failedActionIds.push(action.id);
          lastError = actionError instanceof Error ? actionError.message : "Unknown error";
        }
      }
      
      const remainingActions = pendingActions.filter(a => !successfulActionIds.includes(a.id));
      const successCount = successfulActionIds.length;
      const failedCount = failedActionIds.length;
      
      const syncedWorkOrderIds = pendingActions
        .filter(action => successfulActionIds.includes(action.id))
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
        errorMessage: lastError,
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
