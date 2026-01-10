import { useEffect, useRef } from "react";
import { useOffline } from "@/contexts/OfflineContext";
import { useWorkOrders } from "@/contexts/WorkOrderContext";
import { useAuth } from "@/contexts/AuthContext";

export function AutoSyncManager() {
  const { isOnline, pendingActionsForCurrentProject, isSyncing, syncPendingActions } = useOffline();
  const { updateWorkOrder, transformOfflineToServerWorkOrder, deleteLocalWorkOrder } = useWorkOrders();
  const { serverUrl, projectId, isOfflineSession, revalidateSession } = useAuth();
  const wasOfflineRef = useRef(false);
  const autoSyncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isOnline) {
      wasOfflineRef.current = true;
      return;
    }

    if (wasOfflineRef.current && isOnline) {
      console.log("[AutoSyncManager] Connectivity restored");
      
      if (autoSyncTimeoutRef.current) {
        clearTimeout(autoSyncTimeoutRef.current);
      }
      
      autoSyncTimeoutRef.current = setTimeout(async () => {
        wasOfflineRef.current = false;
        
        if (isOfflineSession) {
          console.log("[AutoSyncManager] Revalidating offline session");
          const revalidated = await revalidateSession();
          if (!revalidated) {
            console.log("[AutoSyncManager] Session revalidation failed, skipping sync");
            wasOfflineRef.current = true;
            return;
          }
        }
        
        if (pendingActionsForCurrentProject.length === 0 || isSyncing || !serverUrl || !projectId) {
          return;
        }
        
        console.log("[AutoSyncManager] Triggering auto-sync");
        
        try {
          const { syncedWorkOrderIds, syncedOfflineWorkOrders, conflictedWorkOrderIds } = await syncPendingActions();
          
          if (syncedWorkOrderIds.length > 0) {
            console.log(`[AutoSyncManager] Auto-sync completed, synced ${syncedWorkOrderIds.length} work orders`);
            for (const workOrderId of syncedWorkOrderIds) {
              updateWorkOrder(workOrderId, { syncPending: false });
            }
          }
          
          if (syncedOfflineWorkOrders.length > 0) {
            console.log("[AutoSyncManager] Transforming synced offline work orders:", syncedOfflineWorkOrders.length);
            for (const syncedWo of syncedOfflineWorkOrders) {
              // Pass the lookupKey directly - it's the exact key used for offline storage
              await transformOfflineToServerWorkOrder(
                syncedWo.lookupKey,
                {
                  id: syncedWo.serverWorkOrderId,
                  customerWoId: syncedWo.customerWoId,
                  status: syncedWo.status,
                  serviceAddress: syncedWo.serviceAddress,
                  oldGps: syncedWo.oldGps,
                  newGps: syncedWo.newGps,
                  oldModuleId: syncedWo.oldModuleId,
                  newModuleId: syncedWo.newModuleId,
                  oldModuleRead: syncedWo.oldModuleRead,
                  newModuleRead: syncedWo.newModuleRead,
                  route: syncedWo.route,
                  zone: syncedWo.zone,
                  assignedUserId: syncedWo.assignedUserId,
                  assignedUserUsername: syncedWo.assignedUserUsername,
                  assignedUserDisplayName: syncedWo.assignedUserDisplayName,
                  assignedGroupId: syncedWo.assignedGroupId,
                  assignedGroupName: syncedWo.assignedGroupName,
                  customerName: syncedWo.customerName,
                  customerPhone: syncedWo.customerPhone,
                  customerEmail: syncedWo.customerEmail,
                  city: syncedWo.city,
                  state: syncedWo.state,
                  zip: syncedWo.zip,
                }
              );
            }
          }
          
          if (conflictedWorkOrderIds.length > 0) {
            console.log(`[AutoSyncManager] ${conflictedWorkOrderIds.length} work orders conflicted (claimed by another user), deleting local data`);
            for (const workOrderId of conflictedWorkOrderIds) {
              await deleteLocalWorkOrder(workOrderId);
            }
          }
        } catch (err) {
          console.error("[AutoSyncManager] Auto-sync failed, will retry on next trigger:", err);
          wasOfflineRef.current = true;
        }
      }, 2000);
    }
    
    return () => {
      if (autoSyncTimeoutRef.current) {
        clearTimeout(autoSyncTimeoutRef.current);
      }
    };
  }, [isOnline, pendingActionsForCurrentProject.length, isSyncing, serverUrl, projectId, isOfflineSession, syncPendingActions, updateWorkOrder, transformOfflineToServerWorkOrder, deleteLocalWorkOrder, revalidateSession]);

  return null;
}
