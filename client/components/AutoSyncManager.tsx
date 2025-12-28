import { useEffect, useRef } from "react";
import { useOffline } from "@/contexts/OfflineContext";
import { useWorkOrders } from "@/contexts/WorkOrderContext";
import { useAuth } from "@/contexts/AuthContext";

export function AutoSyncManager() {
  const { isOnline, pendingActions, isSyncing, syncPendingActions } = useOffline();
  const { updateWorkOrder } = useWorkOrders();
  const { serverUrl, projectId } = useAuth();
  const wasOfflineRef = useRef(false);
  const autoSyncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isOnline) {
      wasOfflineRef.current = true;
      return;
    }

    if (wasOfflineRef.current && isOnline && pendingActions.length > 0 && !isSyncing && serverUrl && projectId) {
      console.log("[AutoSyncManager] Connectivity restored, triggering auto-sync");
      
      if (autoSyncTimeoutRef.current) {
        clearTimeout(autoSyncTimeoutRef.current);
      }
      
      autoSyncTimeoutRef.current = setTimeout(async () => {
        wasOfflineRef.current = false;
        
        try {
          const syncedWorkOrderIds = await syncPendingActions();
          if (syncedWorkOrderIds.length > 0) {
            console.log(`[AutoSyncManager] Auto-sync completed, synced ${syncedWorkOrderIds.length} work orders`);
            for (const workOrderId of syncedWorkOrderIds) {
              updateWorkOrder(workOrderId, { syncPending: false });
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
  }, [isOnline, pendingActions.length, isSyncing, serverUrl, projectId, syncPendingActions, updateWorkOrder]);

  return null;
}
