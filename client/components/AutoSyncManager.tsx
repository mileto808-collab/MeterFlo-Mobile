import { useEffect, useRef } from "react";
import { useOffline } from "@/contexts/OfflineContext";
import { useWorkOrders } from "@/contexts/WorkOrderContext";
import { useAuth } from "@/contexts/AuthContext";

export function AutoSyncManager() {
  const { isOnline, pendingActions, isSyncing, syncPendingActions } = useOffline();
  const { updateWorkOrder, removeOfflineWorkOrder, refreshWorkOrders } = useWorkOrders();
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
      
      const offlineWorkOrderMeterIds = pendingActions
        .filter(a => a.type === "offlineWorkOrder")
        .map(a => a.data?.oldMeterId)
        .filter(Boolean) as string[];
      
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
          
          if (offlineWorkOrderMeterIds.length > 0) {
            console.log("[AutoSyncManager] Removing synced offline work orders:", offlineWorkOrderMeterIds);
            for (const oldMeterId of offlineWorkOrderMeterIds) {
              await removeOfflineWorkOrder(oldMeterId);
            }
            await refreshWorkOrders(true);
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
  }, [isOnline, pendingActions.length, isSyncing, serverUrl, projectId, syncPendingActions, updateWorkOrder, removeOfflineWorkOrder, refreshWorkOrders]);

  return null;
}
