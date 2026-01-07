import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/contexts/AuthContext";
import { checkWorkOrderConflict } from "@/lib/conflict-check";

interface PendingAction {
  id: string;
  type: "update" | "complete" | "workflow" | "claim" | "offlineWorkOrder";
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

interface SyncedOfflineWorkOrder {
  oldSystemId: string;
  serverWorkOrderId: number;
  customerWoId?: string;
  status?: string;
  serviceAddress?: string;
  oldGps?: string;
  newGps?: string;
}

interface SyncResult {
  syncedWorkOrderIds: number[];
  syncedOfflineWorkOrders: SyncedOfflineWorkOrder[];
  conflictedWorkOrderIds: string[];
}

function isClaimConflictError(status: number, errorText: string): boolean {
  const lowerText = errorText.toLowerCase();
  if (status === 409) return true;
  if (status === 403 || status === 400) {
    return lowerText.includes("claimed") ||
           lowerText.includes("already assigned") ||
           lowerText.includes("no longer available") ||
           lowerText.includes("assigned to another") ||
           lowerText.includes("not available");
  }
  return false;
}

interface OfflineContextType {
  isOnline: boolean;
  pendingActions: PendingAction[];
  syncHistory: SyncHistoryEntry[];
  isSyncing: boolean;
  addPendingAction: (action: Omit<PendingAction, "id" | "timestamp">) => Promise<void>;
  removePendingAction: (id: string) => Promise<void>;
  syncPendingActions: () => Promise<SyncResult>;
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
  const { serverUrl, projectId, user, getAuthHeaders } = useAuth();
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
          // Migrate legacy "complete" actions
          if (action.type === "complete" && !action.completionMode) {
            needsMigration = true;
            const data = action.data;
            const isComplete = data.status === "Completed" || data.new_meter_id !== undefined || data.new_system_id !== undefined;
            
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
              oldSystemReading: data.old_system_reading ?? data.old_meter_reading ?? data.oldSystemReading ?? data.oldMeterReading,
              newSystemId: data.new_system_id ?? data.new_meter_id ?? data.newSystemId ?? data.newMeterId,
              newSystemReading: data.new_system_reading ?? data.new_meter_reading ?? data.newSystemReading ?? data.newMeterReading ?? 0,
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
              oldSystemReading: data.old_system_reading ?? data.old_meter_reading ?? data.oldSystemReading ?? data.oldMeterReading,
              photos: formatLegacyPhotos(data.trouble_photos ?? data.photos ?? [], 'trouble'),
            };
            
            console.log(`[OfflineContext] Migrated legacy pending action for WO ${action.workOrderId}`);
            return {
              ...action,
              data: migratedPayload,
              completionMode: isComplete ? "complete" as const : "trouble" as const,
            };
          }
          
          // Migrate legacy "offlineWorkOrder" actions from meter to system terminology
          if (action.type === "offlineWorkOrder") {
            const data = action.data;
            if (data.oldMeterId !== undefined && data.oldSystemId === undefined) {
              needsMigration = true;
              const migratedData = {
                ...data,
                oldSystemId: data.oldMeterId,
                newSystemId: data.newMeterId,
                oldSystemReading: data.oldMeterReading,
                newSystemReading: data.newMeterReading,
              };
              console.log(`[OfflineContext] Migrated offlineWorkOrder action from meter to system terminology`);
              return { ...action, data: migratedData };
            }
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

  const syncPendingActions = useCallback(async (): Promise<SyncResult> => {
    if (!isOnline || pendingActions.length === 0 || isSyncing || !serverUrl || !projectId) {
      return { syncedWorkOrderIds: [], syncedOfflineWorkOrders: [], conflictedWorkOrderIds: [] };
    }

    setIsSyncing(true);
    const workOrderIds = pendingActions.map(a => a.workOrderId);
    const workOrderTitles = pendingActions.map(a => a.workOrderTitle);
    const totalPhotoCount = pendingActions.reduce((sum, a) => sum + (a.photoCount || 0), 0);
    
    const successfulActionIds: string[] = [];
    const failedActionIds: string[] = [];
    const conflictedActionIds: string[] = [];
    const conflictedWorkOrderIds: string[] = [];
    const offlineToServerIdMap: Map<string, number> = new Map();
    const syncedOfflineWorkOrders: SyncedOfflineWorkOrder[] = [];
    let lastError: string | undefined;
    
    try {
      for (const action of pendingActions) {
        try {
          if (action.type === "complete" && action.completionMode) {
            // Pre-flight check using shared helper
            if (user?.username) {
              const conflictCheckHeaders = await getAuthHeaders();
              const conflictResult = await checkWorkOrderConflict(
                action.workOrderId,
                serverUrl,
                String(projectId),
                user.username,
                conflictCheckHeaders
              );
              
              if (conflictResult.hasConflict) {
                console.log(`[syncPendingActions] WO ${action.workOrderId} conflict detected: ${conflictResult.conflictType} by ${conflictResult.conflictUser}`);
                conflictedActionIds.push(action.id);
                if (!conflictedWorkOrderIds.includes(action.workOrderId)) {
                  conflictedWorkOrderIds.push(action.workOrderId);
                }
                continue;
              }
            }
            
            const endpoint = action.completionMode === "complete"
              ? `${serverUrl}/api/mobile/workorders/${action.workOrderId}/complete`
              : `${serverUrl}/api/mobile/workorders/${action.workOrderId}/trouble`;
            
            console.log(`[syncPendingActions] Syncing ${action.completionMode} for WO ${action.workOrderId} to ${endpoint}`);
            
            const payloadWithProjectId = {
              ...action.data,
              projectId: action.data.projectId || Number(projectId),
            };
            
            const authHeaders = await getAuthHeaders();
            const response = await fetch(endpoint, {
              method: "POST",
              headers: { 
                ...authHeaders,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(payloadWithProjectId),
            });
            
            if (!response.ok) {
              const errorText = await response.text();
              console.error(`[syncPendingActions] Failed to sync WO ${action.workOrderId}:`, response.status, errorText?.substring(0, 200));
              
              if (isClaimConflictError(response.status, errorText)) {
                console.log(`[syncPendingActions] Claim conflict on complete for WO ${action.workOrderId} - work order claimed by another user`);
                conflictedActionIds.push(action.id);
                if (!conflictedWorkOrderIds.includes(action.workOrderId)) {
                  conflictedWorkOrderIds.push(action.workOrderId);
                }
                continue;
              }
              
              throw new Error(errorText || `Failed to sync work order ${action.workOrderId}`);
            }
            
            console.log(`[syncPendingActions] Successfully synced WO ${action.workOrderId}`);
            successfulActionIds.push(action.id);
          } else if (action.type === "offlineWorkOrder") {
            const offlineData = action.data;
            // Handle legacy data with meter terminology
            const oldSystemId = offlineData.oldSystemId || offlineData.oldMeterId;
            const newSystemId = offlineData.newSystemId || offlineData.newMeterId;
            
            if (!oldSystemId) {
              console.warn(`[syncPendingActions] Skipping offlineWorkOrder action - missing oldSystemId`);
              continue;
            }
            
            console.log(`[syncPendingActions] Syncing offline work order for old system: ${oldSystemId}, new system: ${newSystemId}`);
            
            let eligibleWorkOrder: any = null;
            
            const searchByOldSystem = async () => {
              const authHeaders = await getAuthHeaders();
              const response = await fetch(
                `${serverUrl}/api/projects/${projectId}/work-orders/search?systemId=${encodeURIComponent(oldSystemId)}`,
                { 
                  method: "GET", 
                  headers: authHeaders,
                }
              );
              if (!response.ok) return [];
              const data = await response.json();
              return data.workOrders || data || [];
            };
            
            const searchByNewSystem = async () => {
              if (!newSystemId) return [];
              const authHeaders = await getAuthHeaders();
              const response = await fetch(
                `${serverUrl}/api/projects/${projectId}/work-orders/search?systemId=${encodeURIComponent(newSystemId)}`,
                { 
                  method: "GET", 
                  headers: authHeaders,
                }
              );
              if (!response.ok) return [];
              const data = await response.json();
              return data.workOrders || data || [];
            };
            
            const findEligible = (workOrders: any[]) => {
              return workOrders.find((wo: any) => {
                const status = (wo.status || "").toLowerCase();
                return status !== "completed" && status !== "closed";
              });
            };
            
            const oldSystemResults = await searchByOldSystem();
            eligibleWorkOrder = findEligible(oldSystemResults);
            
            if (!eligibleWorkOrder) {
              console.log(`[syncPendingActions] No match by old system ID, searching by new system ID: ${newSystemId}`);
              const newSystemResults = await searchByNewSystem();
              eligibleWorkOrder = findEligible(newSystemResults);
            }
            
            if (!eligibleWorkOrder) {
              console.log(`[syncPendingActions] No eligible work order found for old system ${oldSystemId} or new system ${newSystemId}, keeping in queue for retry`);
              continue;
            }
            
            const serverWorkOrderId = eligibleWorkOrder.id;
            
            // Pre-flight check using shared helper
            if (user?.username) {
              const conflictCheckHeaders = await getAuthHeaders();
              const conflictResult = await checkWorkOrderConflict(
                String(serverWorkOrderId),
                serverUrl,
                String(projectId),
                user.username,
                conflictCheckHeaders
              );
              
              if (conflictResult.hasConflict) {
                console.log(`[syncPendingActions] WO ${serverWorkOrderId} conflict detected: ${conflictResult.conflictType} by ${conflictResult.conflictUser}`);
                conflictedActionIds.push(action.id);
                if (!conflictedWorkOrderIds.includes(String(serverWorkOrderId))) {
                  conflictedWorkOrderIds.push(String(serverWorkOrderId));
                }
                continue;
              }
            }
            
            console.log(`[syncPendingActions] Found matching server work order ${serverWorkOrderId}, claiming...`);
            
            const claimHeaders = await getAuthHeaders();
            const claimResponse = await fetch(
              `${serverUrl}/api/projects/${projectId}/work-orders/${serverWorkOrderId}/claim`,
              {
                method: "POST",
                headers: claimHeaders,
              }
            );
            
            if (!claimResponse.ok) {
              const errorText = await claimResponse.text();
              console.warn(`[syncPendingActions] Failed to claim WO ${serverWorkOrderId}:`, errorText);
            } else {
              console.log(`[syncPendingActions] Claimed work order ${serverWorkOrderId}`);
            }
            
            const oldSystemReading = offlineData.oldSystemReading ?? offlineData.oldMeterReading;
            const newSystemReading = offlineData.newSystemReading ?? offlineData.newMeterReading;
            
            const completePayload = {
              projectId: Number(projectId),
              oldSystemReading: oldSystemReading,
              newSystemId: newSystemId,
              newSystemReading: newSystemReading,
              oldGps: offlineData.oldGps || null,
              gpsCoordinates: offlineData.newGps || null,
              signatureData: offlineData.signatureData || null,
              signatureName: offlineData.signatureName,
              completedAt: offlineData.completedAt,
              notes: offlineData.notes || null,
              beforePhotos: offlineData.beforePhotos || [],
              afterPhotos: offlineData.afterPhotos || [],
            };
            
            const completeHeaders = await getAuthHeaders();
            const completeResponse = await fetch(
              `${serverUrl}/api/mobile/workorders/${serverWorkOrderId}/complete`,
              {
                method: "POST",
                headers: { 
                  ...completeHeaders,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(completePayload),
              }
            );
            
            if (!completeResponse.ok) {
              const errorText = await completeResponse.text();
              console.error(`[syncPendingActions] Failed to complete WO ${serverWorkOrderId}:`, completeResponse.status, errorText?.substring(0, 200));
              throw new Error(errorText || `Failed to complete work order ${serverWorkOrderId}`);
            }
            
            let serverResponseData: any = null;
            try {
              serverResponseData = await completeResponse.json();
              console.log(`[syncPendingActions] Server response for WO ${serverWorkOrderId}:`, JSON.stringify(serverResponseData).substring(0, 200));
            } catch (e) {
              console.log(`[syncPendingActions] No JSON response from completion endpoint`);
            }
            
            console.log(`[syncPendingActions] Successfully synced offline work order for system ${offlineData.oldSystemId} to server WO ${serverWorkOrderId}`);
            successfulActionIds.push(action.id);
            offlineToServerIdMap.set(action.id, serverWorkOrderId);
            
            const serverWo = serverResponseData?.workOrder || serverResponseData;
            syncedOfflineWorkOrders.push({
              oldSystemId: offlineData.oldSystemId,
              serverWorkOrderId: serverWo?.id || serverWorkOrderId,
              customerWoId: serverWo?.customer_wo_id || serverWo?.customerWoId || eligibleWorkOrder.customer_wo_id || eligibleWorkOrder.customerWoId,
              status: serverWo?.status || "Completed",
              serviceAddress: serverWo?.service_address || serverWo?.serviceAddress || eligibleWorkOrder.service_address || eligibleWorkOrder.serviceAddress,
              oldGps: serverWo?.old_gps || serverWo?.oldGps || offlineData.oldGps,
              newGps: serverWo?.new_gps || serverWo?.newGps || offlineData.newGps,
            });
            
          } else if (action.type === "claim") {
            const claimEndpoint = `${serverUrl}/api/projects/${projectId}/work-orders/${action.workOrderId}/claim`;
            console.log(`[syncPendingActions] Syncing claim for WO ${action.workOrderId}`);
            
            const claimAuthHeaders = await getAuthHeaders();
            const response = await fetch(claimEndpoint, {
              method: "POST",
              headers: claimAuthHeaders,
            });
            
            if (!response.ok) {
              const errorText = await response.text();
              console.error(`[syncPendingActions] Failed to claim WO ${action.workOrderId}:`, response.status, errorText?.substring(0, 200));
              
              if (isClaimConflictError(response.status, errorText)) {
                console.log(`[syncPendingActions] Claim conflict detected for WO ${action.workOrderId} - another user has claimed it`);
                conflictedActionIds.push(action.id);
                if (!conflictedWorkOrderIds.includes(action.workOrderId)) {
                  conflictedWorkOrderIds.push(action.workOrderId);
                }
                continue;
              }
              
              throw new Error(errorText || `Failed to claim work order ${action.workOrderId}`);
            }
            
            console.log(`[syncPendingActions] Successfully claimed WO ${action.workOrderId}`);
            successfulActionIds.push(action.id);
          } else {
            const batchHeaders = await getAuthHeaders();
            const batchResponse = await fetch(`${serverUrl}/api/mobile/projects/${projectId}/sync/upload`, {
              method: "POST",
              headers: { 
                ...batchHeaders,
                "Content-Type": "application/json",
              },
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
      
      const remainingActions = pendingActions.filter(a => 
        !successfulActionIds.includes(a.id) && !conflictedActionIds.includes(a.id)
      );
      const successCount = successfulActionIds.length;
      const failedCount = failedActionIds.length;
      const conflictCount = conflictedActionIds.length;
      
      if (conflictCount > 0) {
        console.log(`[syncPendingActions] ${conflictCount} actions conflicted (claimed by other users), removing from queue`);
      }
      
      const syncedWorkOrderIds = pendingActions
        .filter(action => successfulActionIds.includes(action.id))
        .map(action => {
          if (action.type === "offlineWorkOrder" && offlineToServerIdMap.has(action.id)) {
            return offlineToServerIdMap.get(action.id)!;
          }
          return parseInt(action.workOrderId, 10);
        })
        .filter(woId => !isNaN(woId) && !remainingActions.some(ra => parseInt(ra.workOrderId, 10) === woId));
      
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
      
      return { syncedWorkOrderIds, syncedOfflineWorkOrders, conflictedWorkOrderIds };

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
      
      return { syncedWorkOrderIds: [], syncedOfflineWorkOrders: [], conflictedWorkOrderIds: [] };
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, pendingActions, isSyncing, serverUrl, projectId, user, addSyncHistoryEntry]);

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
