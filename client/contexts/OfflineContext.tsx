import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, ReactNode } from "react";
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
  completionMode?: "complete" | "trouble" | "readingOnly";
  lookupKey?: string; // For offlineWorkOrder: the key used for offline storage (system ID or module ID)
  projectId?: number; // The project this action belongs to - actions only sync when matching current project
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
  lookupKey: string; // The key used for offline storage (system ID or module ID)
  oldSystemId?: string;
  oldModuleId?: string;
  newModuleId?: string;
  oldModuleRead?: string;
  newModuleRead?: string;
  serverWorkOrderId: number;
  customerWoId?: string;
  status?: string;
  serviceAddress?: string;
  oldGps?: string;
  newGps?: string;
  route?: string;
  zone?: string;
  assignedUserId?: string;
  assignedUserUsername?: string;
  assignedUserDisplayName?: string;
  assignedGroupId?: string;
  assignedGroupName?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  city?: string;
  state?: string;
  zip?: string;
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
  pendingActionsForCurrentProject: PendingAction[];
  pendingActionsForOtherProjects: PendingAction[];
  syncHistory: SyncHistoryEntry[];
  isSyncing: boolean;
  addPendingAction: (action: Omit<PendingAction, "id" | "timestamp">) => Promise<void>;
  removePendingAction: (id: string) => Promise<void>;
  syncPendingActions: () => Promise<SyncResult>;
  clearAllPending: () => Promise<void>;
  clearPendingForCurrentProject: () => Promise<void>;
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
  const { serverUrl, projectId, user } = useAuth();
  const [isOnline, setIsOnline] = useState(true);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [syncHistory, setSyncHistory] = useState<SyncHistoryEntry[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const previousSessionRef = useRef<{ userId: string | null; projectId: number | null }>({ userId: null, projectId: null });
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    loadStoredData();
    
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const online = state.isConnected ?? false;
      setIsOnline(online);
    });

    return () => unsubscribe();
  }, []);

  // Clear sync history when user logs out
  useEffect(() => {
    if (!user) {
      console.log("[OfflineContext] User logged out, clearing sync history from state");
      setSyncHistory([]);
      hasInitializedRef.current = false;
      previousSessionRef.current = { userId: null, projectId: null };
    }
  }, [user]);

  // Clear sync history when user or project changes to avoid confusion
  useEffect(() => {
    const currentUserId = user?.id || null;
    const currentProjectId = projectId;
    const prev = previousSessionRef.current;
    
    if (!currentUserId || !currentProjectId) {
      return;
    }
    
    const userChanged = prev.userId !== null && prev.userId !== currentUserId;
    const projectChanged = prev.projectId !== null && prev.projectId !== currentProjectId;
    
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      // Check if sync history belongs to a different session
      AsyncStorage.getItem("meterflo_offline_session").then((cachedSession) => {
        if (cachedSession) {
          try {
            const { userId: cachedUserId, projectId: cachedProjectId } = JSON.parse(cachedSession);
            if (cachedUserId !== currentUserId || cachedProjectId !== currentProjectId) {
              console.log("[OfflineContext] Sync history from different session, clearing");
              setSyncHistory([]);
              AsyncStorage.removeItem(STORAGE_KEYS.SYNC_HISTORY);
            }
          } catch (e) {
            // Invalid cache session
          }
        }
        AsyncStorage.setItem("meterflo_offline_session", JSON.stringify({ userId: currentUserId, projectId: currentProjectId }));
      });
    } else if (userChanged || projectChanged) {
      console.log(`[OfflineContext] Session changed, clearing sync history`);
      setSyncHistory([]);
      AsyncStorage.removeItem(STORAGE_KEYS.SYNC_HISTORY);
      AsyncStorage.setItem("meterflo_offline_session", JSON.stringify({ userId: currentUserId, projectId: currentProjectId }));
    }
    
    previousSessionRef.current = { userId: currentUserId, projectId: currentProjectId };
  }, [user?.id, projectId]);

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
              oldModuleId: data.old_module_id ?? data.oldModuleId ?? null,
              oldModuleRead: data.old_module_read ?? data.oldModuleRead,
              newSystemId: data.new_system_id ?? data.new_meter_id ?? data.newSystemId ?? data.newMeterId,
              newSystemReading: data.new_system_reading ?? data.new_meter_reading ?? data.newSystemReading ?? data.newMeterReading ?? 0,
              newModuleId: data.new_module_id ?? data.newModuleId ?? null,
              newModuleRead: data.new_module_read ?? data.newModuleRead,
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
              oldModuleId: data.old_module_id ?? data.oldModuleId ?? null,
              oldModuleRead: data.old_module_read ?? data.oldModuleRead,
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
          // and normalize identifiers by trimming
          if (action.type === "offlineWorkOrder") {
            const data = action.data;
            let migratedData = { ...data };
            let actionNeedsMigration = false;
            
            // Migrate meter to system terminology
            if (data.oldMeterId !== undefined && data.oldSystemId === undefined) {
              actionNeedsMigration = true;
              migratedData.oldSystemId = data.oldMeterId;
              migratedData.newSystemId = data.newMeterId;
              migratedData.oldSystemReading = data.oldMeterReading;
              migratedData.newSystemReading = data.newMeterReading;
            }
            
            // Normalize identifiers by trimming
            const oldSystemId = (migratedData.oldSystemId || "").trim();
            const oldModuleId = (migratedData.oldModuleId || "").trim();
            const newSystemId = (migratedData.newSystemId || "").trim();
            const newModuleId = (migratedData.newModuleId || "").trim();
            
            // Backfill lookupKey if missing
            const computedLookupKey = oldSystemId || oldModuleId;
            if (!action.lookupKey && computedLookupKey) {
              actionNeedsMigration = true;
            }
            
            if (actionNeedsMigration) {
              needsMigration = true;
              migratedData.oldSystemId = oldSystemId || undefined;
              migratedData.oldModuleId = oldModuleId || undefined;
              migratedData.newSystemId = newSystemId || undefined;
              migratedData.newModuleId = newModuleId || undefined;
              console.log(`[OfflineContext] Migrated offlineWorkOrder action, lookupKey: ${computedLookupKey}`);
              return { 
                ...action, 
                data: migratedData,
                lookupKey: action.lookupKey?.trim() || computedLookupKey,
              };
            }
          }
          
          return action;
        });
        
        // Filter out invalid legacy offlineWorkOrder actions with no usable identifiers
        const validActions = actions.filter(action => {
          if (action.type === "offlineWorkOrder") {
            const data = action.data;
            const oldSystemId = (data.oldSystemId || data.oldMeterId || "").trim();
            const oldModuleId = (data.oldModuleId || "").trim();
            const lookupKey = action.lookupKey?.trim() || oldSystemId || oldModuleId;
            if (!lookupKey) {
              console.warn(`[OfflineContext] Filtering out invalid legacy offlineWorkOrder action ${action.id} - no usable identifiers`);
              needsMigration = true;
              return false;
            }
          }
          return true;
        });
        
        if (needsMigration) {
          await AsyncStorage.setItem(STORAGE_KEYS.PENDING_ACTIONS, JSON.stringify(validActions));
          console.log("[OfflineContext] Migrated legacy pending actions to new format");
        }
        
        setPendingActions(validActions);
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
    if (!projectId) {
      console.error("[OfflineContext] Cannot add pending action without projectId - action will be rejected");
      throw new Error("Cannot queue offline action: no project selected");
    }
    
    const newAction: PendingAction = {
      ...action,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      projectId: projectId,
    };

    const updatedActions = [...pendingActions, newAction];
    setPendingActions(updatedActions);
    await AsyncStorage.setItem(STORAGE_KEYS.PENDING_ACTIONS, JSON.stringify(updatedActions));
  }, [pendingActions, projectId]);

  const removePendingAction = useCallback(async (id: string) => {
    const updatedActions = pendingActions.filter(a => a.id !== id);
    setPendingActions(updatedActions);
    await AsyncStorage.setItem(STORAGE_KEYS.PENDING_ACTIONS, JSON.stringify(updatedActions));
  }, [pendingActions]);

  const syncPendingActions = useCallback(async (): Promise<SyncResult> => {
    if (!isOnline || pendingActions.length === 0 || isSyncing || !serverUrl || !projectId) {
      return { syncedWorkOrderIds: [], syncedOfflineWorkOrders: [], conflictedWorkOrderIds: [] };
    }

    // Filter pending actions to only sync those belonging to the current project
    // Actions without a projectId (legacy) or matching the current projectId will be synced
    const projectScopedActions = pendingActions.filter(action => 
      action.projectId === undefined || action.projectId === projectId
    );
    
    if (projectScopedActions.length === 0) {
      console.log(`[syncPendingActions] No pending actions for current project ${projectId}`);
      return { syncedWorkOrderIds: [], syncedOfflineWorkOrders: [], conflictedWorkOrderIds: [] };
    }
    
    console.log(`[syncPendingActions] Syncing ${projectScopedActions.length} of ${pendingActions.length} actions for project ${projectId}`);

    setIsSyncing(true);
    const workOrderIds = projectScopedActions.map(a => a.workOrderId);
    const workOrderTitles = projectScopedActions.map(a => a.workOrderTitle);
    const totalPhotoCount = projectScopedActions.reduce((sum, a) => sum + (a.photoCount || 0), 0);
    
    const successfulActionIds: string[] = [];
    const failedActionIds: string[] = [];
    const conflictedActionIds: string[] = [];
    const conflictedWorkOrderIds: string[] = [];
    const offlineToServerIdMap: Map<string, number> = new Map();
    const syncedOfflineWorkOrders: SyncedOfflineWorkOrder[] = [];
    let lastError: string | undefined;
    
    try {
      for (const action of projectScopedActions) {
        try {
          if (action.type === "complete" && action.completionMode) {
            // Pre-flight check using shared helper
            if (user?.username) {
              const conflictResult = await checkWorkOrderConflict(
                action.workOrderId,
                serverUrl,
                String(projectId),
                user.username
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
            
            // All completion modes use the /complete endpoint (readingOnly uses isReadingOnly flag)
            // Only trouble mode uses the /trouble endpoint
            const endpoint = action.completionMode === "trouble"
              ? `${serverUrl}/api/mobile/projects/${projectId}/work-orders/${action.workOrderId}/trouble`
              : `${serverUrl}/api/mobile/projects/${projectId}/work-orders/${action.workOrderId}/complete`;
            
            console.log(`[syncPendingActions] Syncing ${action.completionMode} for WO ${action.workOrderId} to ${endpoint}`);
            
            const payloadWithProjectId = {
              ...action.data,
              projectId: action.data.projectId || Number(projectId),
            };
            
            const response = await fetch(endpoint, {
              method: "POST",
              headers: { 
                "Content-Type": "application/json",
                "X-Requested-With": "XMLHttpRequest",
                "Origin": serverUrl,
                "Referer": `${serverUrl}/`,
              },
              credentials: "include",
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
            
            // Call time-tracking endpoint after successful offline completion sync
            if (action.data?.startTime) {
              try {
                const endTime = action.data.endTime || action.data.completedAt || new Date().toISOString();
                const timeTrackingEndpoint = `${serverUrl}/api/projects/${projectId}/work-orders/${action.workOrderId}/time-tracking`;
                const timeTrackingResponse = await fetch(timeTrackingEndpoint, {
                  method: "POST",
                  headers: { 
                    "Content-Type": "application/json",
                    "X-Requested-With": "XMLHttpRequest",
                    "Origin": serverUrl,
                    "Referer": `${serverUrl}/`,
                  },
                  credentials: "include",
                  body: JSON.stringify({
                    startTime: action.data.startTime,
                    endTime: endTime,
                  }),
                });
                if (!timeTrackingResponse.ok) {
                  console.warn(`[syncPendingActions] Time-tracking call failed for WO ${action.workOrderId}: ${timeTrackingResponse.status}`);
                }
              } catch (timeTrackingError) {
                // Silently fail - time tracking is non-critical
              }
            }
            
            successfulActionIds.push(action.id);
          } else if (action.type === "offlineWorkOrder") {
            const offlineData = action.data;
            // Handle legacy data with meter terminology and normalize by trimming
            const oldSystemId = (offlineData.oldSystemId || offlineData.oldMeterId || "").trim();
            const newSystemId = (offlineData.newSystemId || offlineData.newMeterId || "").trim();
            const oldModuleId = (offlineData.oldModuleId || "").trim();
            const newModuleId = (offlineData.newModuleId || "").trim();
            
            // Check for valid lookup key - prefer stored key, fall back to computed
            const computedLookupKey = oldSystemId || oldModuleId;
            const effectiveLookupKey = action.lookupKey?.trim() || computedLookupKey;
            
            // Skip and remove legacy actions without valid identifiers
            if (!effectiveLookupKey) {
              console.warn(`[syncPendingActions] Removing invalid legacy offlineWorkOrder action ${action.id} - missing identifiers`);
              // Add to success to remove from queue (it's unrecoverable, not a retry-able failure)
              successfulActionIds.push(action.id);
              continue;
            }
            
            console.log(`[syncPendingActions] Syncing offline work order for old system: ${oldSystemId || 'none'}, old module: ${oldModuleId || 'none'}, new system: ${newSystemId || 'none'}, new module: ${newModuleId || 'none'}`);
            
            let eligibleWorkOrder: any = null;
            
            // Server uses meterId parameter that searches across all ID fields (old_meter_id, new_meter_id, old_module_id, new_module_id)
            const searchByMeterId = async (id: string) => {
              if (!id) return [];
              const response = await fetch(
                `${serverUrl}/api/projects/${projectId}/work-orders/search?meterId=${encodeURIComponent(id)}`,
                { 
                  method: "GET", 
                  headers: { "X-Requested-With": "XMLHttpRequest", "Origin": serverUrl, "Referer": `${serverUrl}/` },
                  credentials: "include" 
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
            
            // Search order: old system ID -> old module ID -> new system ID -> new module ID
            // All searches use the unified meterId parameter that searches across all ID fields
            if (oldSystemId) {
              console.log(`[syncPendingActions] Searching by old system ID: ${oldSystemId}`);
              const oldSystemResults = await searchByMeterId(oldSystemId);
              eligibleWorkOrder = findEligible(oldSystemResults);
            }
            
            if (!eligibleWorkOrder && oldModuleId) {
              console.log(`[syncPendingActions] No match by old system ID, searching by old module ID: ${oldModuleId}`);
              const oldModuleResults = await searchByMeterId(oldModuleId);
              eligibleWorkOrder = findEligible(oldModuleResults);
            }
            
            if (!eligibleWorkOrder && newSystemId) {
              console.log(`[syncPendingActions] No match by old IDs, searching by new system ID: ${newSystemId}`);
              const newSystemResults = await searchByMeterId(newSystemId);
              eligibleWorkOrder = findEligible(newSystemResults);
            }
            
            if (!eligibleWorkOrder && newModuleId) {
              console.log(`[syncPendingActions] No match by system IDs, searching by new module ID: ${newModuleId}`);
              const newModuleResults = await searchByMeterId(newModuleId);
              eligibleWorkOrder = findEligible(newModuleResults);
            }
            
            if (!eligibleWorkOrder) {
              console.log(`[syncPendingActions] No eligible work order found for system ${oldSystemId || newSystemId || 'none'} or module ${oldModuleId || newModuleId || 'none'}, keeping in queue for retry`);
              continue;
            }
            
            const serverWorkOrderId = eligibleWorkOrder.id;
            
            // Pre-flight check using shared helper
            if (user?.username) {
              const conflictResult = await checkWorkOrderConflict(
                String(serverWorkOrderId),
                serverUrl,
                String(projectId),
                user.username
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
            
            const claimResponse = await fetch(
              `${serverUrl}/api/projects/${projectId}/work-orders/${serverWorkOrderId}/claim`,
              {
                method: "POST",
                headers: { 
                  "Content-Type": "application/json",
                  "X-Requested-With": "XMLHttpRequest",
                  "Origin": serverUrl,
                  "Referer": `${serverUrl}/`,
                },
                credentials: "include",
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
            // Check both field name variants: oldModuleRead (from regular wizard) and oldModuleReading (from offline wizard)
            const oldModuleReadRaw = offlineData.oldModuleRead ?? offlineData.oldModuleReading;
            const newModuleReadRaw = offlineData.newModuleRead ?? offlineData.newModuleReading;
            
            // Parse module readings to numeric strings, defaulting to "0" if module exists but reading is empty/invalid
            const parseModuleReading = (val: string | undefined | null): string | null => {
              if (val === undefined || val === null || val === "") return null;
              const trimmed = String(val).trim();
              const parsed = parseFloat(trimmed);
              return isNaN(parsed) ? null : String(parsed);
            };
            
            // Use snake_case field names to match server expectations
            // Note: status and projectId not needed - server sets status automatically and projectId comes from URL
            // GPS: check oldGps/newGps separately, with gpsCoordinates as fallback for each
            // For offline work orders, gpsCoordinates from wizard represents the work location (used for both old/new)
            const oldGpsValue = offlineData.oldGps ?? offlineData.gpsCoordinates ?? null;
            const newGpsValue = offlineData.newGps ?? offlineData.gpsCoordinates ?? null;
            
            // In Reading Only mode, omit old reading fields entirely - server preserves existing values
            const isReadingOnly = offlineData.isReadingOnly === true;
            
            // Detect if this is a trouble report
            const isTroubleReport = !!(offlineData.troubleCode || offlineData.status === "Trouble");
            
            // Determine if this is module-only (no system) for reading field handling
            const hasSystem = !!(newSystemId && newSystemId.trim());
            const hasModule = !!(offlineData.newModuleId && offlineData.newModuleId.trim());
            
            let completePayload: Record<string, any>;
            let completeEndpoint: string;
            
            if (isTroubleReport) {
              // Trouble report - use /trouble endpoint with trouble-specific payload
              completeEndpoint = `${serverUrl}/api/mobile/projects/${projectId}/work-orders/${serverWorkOrderId}/trouble`;
              completePayload = {
                projectId: Number(projectId),
                troubleCode: offlineData.troubleCode,
                notes: offlineData.notes || offlineData.troubleNote || null,
                oldSystemReading: oldSystemReading ?? 0,
                oldModuleId: offlineData.oldModuleId || null,
                oldModuleReading: offlineData.oldModuleId ? (parseModuleReading(oldModuleReadRaw) ?? "0") : null,
                startTime: offlineData.startTime || offlineData.completedAt,
                photos: offlineData.troublePhotos || [],
              };
              console.log(`[syncPendingActions] Sending trouble payload for WO ${serverWorkOrderId}:`, JSON.stringify({
                ...completePayload,
                photos: completePayload.photos?.length ? `[${completePayload.photos.length} photos]` : [],
              }));
            } else {
              // Regular completion - use /complete endpoint
              completeEndpoint = `${serverUrl}/api/mobile/projects/${projectId}/work-orders/${serverWorkOrderId}/complete`;
              completePayload = {
                old_gps: oldGpsValue,
                new_gps: newGpsValue,
                signatureData: offlineData.signatureData || null,
                signatureName: offlineData.signatureName,
                completedAt: offlineData.completedAt,
                notes: offlineData.notes || null,
                beforePhotos: offlineData.beforePhotos || [],
                afterPhotos: offlineData.afterPhotos || [],
              };
              
              // Add Reading Only mode flags
              if (isReadingOnly) {
                completePayload.canChange = true;
                completePayload.isReadingOnly = true;
              }
              
              // Add system fields if system exists
              if (hasSystem) {
                completePayload.newSystemId = newSystemId;
                completePayload.newSystemReading = newSystemReading ?? 0;
              }
              
              // Add module fields if module exists
              if (hasModule) {
                completePayload.newModuleId = offlineData.newModuleId;
                completePayload.newModuleReading = parseModuleReading(newModuleReadRaw) ?? "0";
              }
              
              // Only include old reading fields in changeout mode (not Reading Only)
              if (!isReadingOnly) {
                completePayload.oldSystemReading = oldSystemReading ?? 0;
                completePayload.oldModuleId = offlineData.oldModuleId || null;
                completePayload.oldModuleRead = offlineData.oldModuleId ? (parseModuleReading(oldModuleReadRaw) ?? "0") : null;
              }
              
              // Log payload without sensitive data (photos/signature)
              console.log(`[syncPendingActions] Sending complete payload for WO ${serverWorkOrderId}:`, JSON.stringify({
                ...completePayload,
                signatureData: completePayload.signatureData ? '[REDACTED]' : null,
                beforePhotos: completePayload.beforePhotos?.length ? `[${completePayload.beforePhotos.length} photos]` : [],
                afterPhotos: completePayload.afterPhotos?.length ? `[${completePayload.afterPhotos.length} photos]` : [],
              }));
            }
            
            const completeResponse = await fetch(completeEndpoint, {
              method: "POST",
              headers: { 
                "Content-Type": "application/json",
                "X-Requested-With": "XMLHttpRequest",
                "Origin": serverUrl,
                "Referer": `${serverUrl}/`,
              },
              credentials: "include",
              body: JSON.stringify(completePayload),
            });
            
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
            
            // Call time-tracking endpoint after successful offline work order sync
            if (offlineData.startTime) {
              try {
                const endTime = offlineData.endTime || offlineData.completedAt || new Date().toISOString();
                const timeTrackingEndpoint = `${serverUrl}/api/projects/${projectId}/work-orders/${serverWorkOrderId}/time-tracking`;
                const timeTrackingResponse = await fetch(timeTrackingEndpoint, {
                  method: "POST",
                  headers: { 
                    "Content-Type": "application/json",
                    "X-Requested-With": "XMLHttpRequest",
                    "Origin": serverUrl,
                    "Referer": `${serverUrl}/`,
                  },
                  credentials: "include",
                  body: JSON.stringify({
                    startTime: offlineData.startTime,
                    endTime: endTime,
                  }),
                });
                if (!timeTrackingResponse.ok) {
                  console.warn(`[syncPendingActions] Time-tracking call failed for offline WO ${serverWorkOrderId}: ${timeTrackingResponse.status}`);
                }
              } catch (timeTrackingError) {
                // Silently fail - time tracking is non-critical
              }
            }
            
            successfulActionIds.push(action.id);
            offlineToServerIdMap.set(action.id, serverWorkOrderId);
            
            const serverWo = serverResponseData?.workOrder || serverResponseData;
            // Use the effectiveLookupKey computed at the start of this action processing
            syncedOfflineWorkOrders.push({
              lookupKey: effectiveLookupKey,
              oldSystemId: offlineData.oldSystemId,
              oldModuleId: offlineData.oldModuleId,
              newModuleId: offlineData.newModuleId,
              oldModuleRead: offlineData.oldModuleRead,
              newModuleRead: offlineData.newModuleRead,
              serverWorkOrderId: serverWo?.id || serverWorkOrderId,
              customerWoId: serverWo?.customer_wo_id || serverWo?.customerWoId || eligibleWorkOrder.customer_wo_id || eligibleWorkOrder.customerWoId,
              status: serverWo?.status || "Completed",
              serviceAddress: serverWo?.service_address || serverWo?.serviceAddress || eligibleWorkOrder.service_address || eligibleWorkOrder.serviceAddress,
              oldGps: serverWo?.old_gps || serverWo?.oldGps || oldGpsValue,
              newGps: serverWo?.new_gps || serverWo?.newGps || newGpsValue,
              route: serverWo?.route || eligibleWorkOrder.route,
              zone: serverWo?.zone || eligibleWorkOrder.zone,
              assignedUserId: serverWo?.assigned_user_id || serverWo?.assignedUserId || eligibleWorkOrder.assigned_user_id || eligibleWorkOrder.assignedUserId,
              assignedUserUsername: serverWo?.assigned_user_username || serverWo?.assignedUserUsername || eligibleWorkOrder.assigned_user_username || eligibleWorkOrder.assignedUserUsername,
              assignedUserDisplayName: serverWo?.assigned_user_display_name || serverWo?.assignedUserDisplayName || eligibleWorkOrder.assigned_user_display_name || eligibleWorkOrder.assignedUserDisplayName,
              assignedGroupId: serverWo?.assigned_group_id || serverWo?.assignedGroupId || eligibleWorkOrder.assigned_group_id || eligibleWorkOrder.assignedGroupId,
              assignedGroupName: serverWo?.assigned_group_name || serverWo?.assignedGroupName || eligibleWorkOrder.assigned_group_name || eligibleWorkOrder.assignedGroupName,
              customerName: serverWo?.customer_name || serverWo?.customerName || eligibleWorkOrder.customer_name || eligibleWorkOrder.customerName,
              customerPhone: serverWo?.phone || serverWo?.customerPhone || eligibleWorkOrder.phone || eligibleWorkOrder.customerPhone,
              customerEmail: serverWo?.email || serverWo?.customerEmail || eligibleWorkOrder.email || eligibleWorkOrder.customerEmail,
              city: serverWo?.city || eligibleWorkOrder.city,
              state: serverWo?.state || eligibleWorkOrder.state,
              zip: serverWo?.zip || eligibleWorkOrder.zip,
            });
            
          } else if (action.type === "claim") {
            const claimEndpoint = `${serverUrl}/api/projects/${projectId}/work-orders/${action.workOrderId}/claim`;
            console.log(`[syncPendingActions] Syncing claim for WO ${action.workOrderId}`);
            
            const response = await fetch(claimEndpoint, {
              method: "POST",
              headers: { 
                "Content-Type": "application/json",
                "X-Requested-With": "XMLHttpRequest",
                "Origin": serverUrl,
                "Referer": `${serverUrl}/`,
              },
              credentials: "include",
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
            const batchResponse = await fetch(`${serverUrl}/api/projects/${projectId}/mobile/sync/upload`, {
              method: "POST",
              headers: { 
                "Content-Type": "application/json",
                "X-Requested-With": "XMLHttpRequest",
                "Origin": serverUrl,
                "Referer": `${serverUrl}/`,
              },
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
            
            // Call time-tracking endpoint after successful sync if action has time data
            if (action.data?.startTime) {
              try {
                const endTime = action.data.endTime || action.data.completedAt || new Date().toISOString();
                const timeTrackingEndpoint = `${serverUrl}/api/projects/${projectId}/work-orders/${action.workOrderId}/time-tracking`;
                const timeTrackingResponse = await fetch(timeTrackingEndpoint, {
                  method: "POST",
                  headers: { 
                    "Content-Type": "application/json",
                    "X-Requested-With": "XMLHttpRequest",
                    "Origin": serverUrl,
                    "Referer": `${serverUrl}/`,
                  },
                  credentials: "include",
                  body: JSON.stringify({
                    startTime: action.data.startTime,
                    endTime: endTime,
                  }),
                });
                if (!timeTrackingResponse.ok) {
                  console.warn(`[syncPendingActions] Time-tracking call failed for WO ${action.workOrderId}: ${timeTrackingResponse.status}`);
                }
              } catch (timeTrackingError) {
                // Silently fail - time tracking is non-critical
              }
            }
            
            successfulActionIds.push(action.id);
          }
        } catch (actionError) {
          console.error(`[syncPendingActions] Error syncing action ${action.id}:`, actionError);
          failedActionIds.push(action.id);
          lastError = actionError instanceof Error ? actionError.message : "Unknown error";
        }
      }
      
      // Remove successful (including legacy removals) and conflicted actions; failed actions retry
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
  
  const clearPendingForCurrentProject = useCallback(async () => {
    if (!projectId) {
      await clearAllPending();
      return;
    }
    
    const remainingActions = pendingActions.filter(action => 
      action.projectId !== undefined && action.projectId !== projectId
    );
    
    if (remainingActions.length === 0) {
      setPendingActions([]);
      await AsyncStorage.removeItem(STORAGE_KEYS.PENDING_ACTIONS);
    } else {
      setPendingActions(remainingActions);
      await AsyncStorage.setItem(STORAGE_KEYS.PENDING_ACTIONS, JSON.stringify(remainingActions));
    }
    
    console.log(`[OfflineContext] Cleared pending actions for project ${projectId}, ${remainingActions.length} actions remain for other projects`);
  }, [pendingActions, projectId, clearAllPending]);
  
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

  const pendingActionsForCurrentProject = useMemo(() => {
    if (!projectId) return pendingActions;
    return pendingActions.filter(action => 
      action.projectId === undefined || action.projectId === projectId
    );
  }, [pendingActions, projectId]);
  
  const pendingActionsForOtherProjects = useMemo(() => {
    if (!projectId) return [];
    return pendingActions.filter(action => 
      action.projectId !== undefined && action.projectId !== projectId
    );
  }, [pendingActions, projectId]);

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        pendingActions,
        pendingActionsForCurrentProject,
        pendingActionsForOtherProjects,
        syncHistory,
        isSyncing,
        addPendingAction,
        removePendingAction,
        syncPendingActions,
        clearAllPending,
        clearPendingForCurrentProject,
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
