import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/contexts/AuthContext";

export interface WorkOrder {
  id: number;
  customerWoId: string;
  status: string;
  oldMeterId: string;
  newMeterId?: string;
  oldMeterReading?: string;
  newMeterReading?: string;
  serviceAddress: string;
  city?: string;
  state?: string;
  zip?: string;
  customerName?: string;
  customerPhone?: string;
  meterType?: string;
  serviceType?: string;
  scheduledDate?: string;
  notes?: string;
  assignedUserId?: string;
  assignedGroupId?: string;
  assigned_user_username?: string;
  assigned_user_display_name?: string;
  troubleCode?: string;
  troubleNote?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  syncPending?: boolean;
  localUpdatedAt?: string;
}

export interface ReferenceData {
  statuses: string[];
  troubleCodes: { code: string; description: string }[];
  meterTypes: string[];
  serviceTypes: string[];
  assignees: {
    users: { id: string; username: string; displayName: string }[];
    groups: { name: string; description: string }[];
  };
}

export interface ColumnConfig {
  key: string;
  label: string;
  visible: boolean;
  order: number;
}

export interface FilterConfig {
  status: string[];
  assignedTo: string;
  searchQuery: string;
}

export interface SortConfig {
  field: string;
  direction: "asc" | "desc";
}

interface WorkOrderContextType {
  workOrders: WorkOrder[];
  referenceData: ReferenceData | null;
  columns: ColumnConfig[];
  filters: FilterConfig;
  sort: SortConfig;
  isLoading: boolean;
  lastSyncTime: string | null;
  error: string | null;
  setWorkOrders: (orders: WorkOrder[]) => void;
  updateWorkOrder: (id: number, updates: Partial<WorkOrder>) => void;
  setColumns: (columns: ColumnConfig[]) => Promise<void>;
  setFilters: (filters: FilterConfig) => void;
  setSort: (sort: SortConfig) => void;
  getFilteredWorkOrders: () => WorkOrder[];
  refreshWorkOrders: () => Promise<void>;
  claimWorkOrder: (workOrderId: number) => Promise<void>;
}

const WorkOrderContext = createContext<WorkOrderContextType | undefined>(undefined);

const STORAGE_KEYS = {
  WORK_ORDERS: "meterflo_work_orders",
  REFERENCE_DATA: "meterflo_reference_data",
  COLUMNS: "meterflo_columns",
  SORT: "meterflo_sort",
  LAST_SYNC: "meterflo_last_sync",
};

const defaultColumns: ColumnConfig[] = [
  { key: "customerWoId", label: "WO #", visible: true, order: 0 },
  { key: "status", label: "Status", visible: true, order: 1 },
  { key: "serviceAddress", label: "Address", visible: true, order: 2 },
  { key: "customerName", label: "Customer", visible: true, order: 3 },
  { key: "oldMeterId", label: "Old Meter", visible: true, order: 4 },
  { key: "meterType", label: "Meter Type", visible: false, order: 5 },
  { key: "scheduledDate", label: "Scheduled", visible: true, order: 6 },
  { key: "assigned_user_display_name", label: "Assigned To", visible: false, order: 7 },
];

const defaultFilters: FilterConfig = {
  status: [],
  assignedTo: "",
  searchQuery: "",
};

const defaultSort: SortConfig = {
  field: "customerWoId",
  direction: "asc",
};

export function WorkOrderProvider({ children }: { children: ReactNode }) {
  const { serverUrl, projectId, isAuthenticated } = useAuth();
  const [workOrders, setWorkOrdersState] = useState<WorkOrder[]>([]);
  const [referenceData, setReferenceData] = useState<ReferenceData | null>(null);
  const [columns, setColumnsState] = useState<ColumnConfig[]>(defaultColumns);
  const [filters, setFiltersState] = useState<FilterConfig>(defaultFilters);
  const [sort, setSortState] = useState<SortConfig>(defaultSort);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStoredData();
  }, []);

  useEffect(() => {
    if (isAuthenticated && serverUrl && projectId) {
      refreshWorkOrders();
    }
  }, [isAuthenticated, serverUrl, projectId]);

  const loadStoredData = async () => {
    try {
      const [storedOrders, storedRefData, storedColumns, storedSort, storedLastSync] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.WORK_ORDERS),
        AsyncStorage.getItem(STORAGE_KEYS.REFERENCE_DATA),
        AsyncStorage.getItem(STORAGE_KEYS.COLUMNS),
        AsyncStorage.getItem(STORAGE_KEYS.SORT),
        AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC),
      ]);

      if (storedOrders) {
        setWorkOrdersState(JSON.parse(storedOrders));
      }
      if (storedRefData) {
        setReferenceData(JSON.parse(storedRefData));
      }
      if (storedColumns) {
        setColumnsState(JSON.parse(storedColumns));
      }
      if (storedSort) {
        setSortState(JSON.parse(storedSort));
      }
      if (storedLastSync) {
        setLastSyncTime(storedLastSync);
      }
    } catch (err) {
      console.error("Failed to load work order data:", err);
    }
  };

  const refreshWorkOrders = useCallback(async () => {
    if (!serverUrl || !projectId) return;
    
    setIsLoading(true);
    setError(null);

    try {
      let path = `/api/projects/${projectId}/mobile/sync/download?includeCompleted=false`;
      
      if (lastSyncTime) {
        path += `&lastSyncTimestamp=${encodeURIComponent(lastSyncTime)}`;
      }

      const response = await fetch(`${serverUrl}${path}`, {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to fetch work orders");
      }

      const data = await response.json();
      
      console.log("=== MeterFlo Server Response ===");
      console.log("Full response:", JSON.stringify(data, null, 2));
      if (data.workOrders && data.workOrders.length > 0) {
        console.log("Sample work order fields:", Object.keys(data.workOrders[0]));
        console.log("Sample work order:", JSON.stringify(data.workOrders[0], null, 2));
      }
      if (data.referenceData) {
        console.log("Reference data:", JSON.stringify(data.referenceData, null, 2));
      }
      console.log("=== End MeterFlo Response ===");
      
      const newWorkOrders: WorkOrder[] = data.workOrders || [];
      const newReferenceData: ReferenceData = data.referenceData || null;
      const newServerTimestamp: string = data.serverTimestamp;

      if (lastSyncTime && newWorkOrders.length > 0) {
        setWorkOrdersState(prev => {
          const merged = [...prev];
          newWorkOrders.forEach(newWo => {
            const existingIndex = merged.findIndex(wo => wo.id === newWo.id);
            if (existingIndex >= 0) {
              if (!merged[existingIndex].syncPending) {
                merged[existingIndex] = newWo;
              }
            } else {
              merged.push(newWo);
            }
          });
          AsyncStorage.setItem(STORAGE_KEYS.WORK_ORDERS, JSON.stringify(merged));
          return merged;
        });
      } else if (newWorkOrders.length > 0) {
        setWorkOrdersState(newWorkOrders);
        await AsyncStorage.setItem(STORAGE_KEYS.WORK_ORDERS, JSON.stringify(newWorkOrders));
      }

      if (newReferenceData) {
        setReferenceData(newReferenceData);
        await AsyncStorage.setItem(STORAGE_KEYS.REFERENCE_DATA, JSON.stringify(newReferenceData));
      }

      if (newServerTimestamp) {
        setLastSyncTime(newServerTimestamp);
        await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, newServerTimestamp);
      }

    } catch (err) {
      console.error("Failed to refresh work orders:", err);
      setError(err instanceof Error ? err.message : "Failed to sync work orders");
    } finally {
      setIsLoading(false);
    }
  }, [serverUrl, projectId, lastSyncTime]);

  const claimWorkOrder = useCallback(async (workOrderId: number) => {
    if (!serverUrl || !projectId) return;

    const response = await fetch(`${serverUrl}/api/projects/${projectId}/work-orders/${workOrderId}/claim`, {
      method: "POST",
      credentials: "include",
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "Failed to claim work order");
    }

    const data = await response.json();
    
    if (data.workOrder) {
      setWorkOrdersState(prev => {
        const updated = prev.map(wo => wo.id === workOrderId ? { ...wo, ...data.workOrder } : wo);
        AsyncStorage.setItem(STORAGE_KEYS.WORK_ORDERS, JSON.stringify(updated));
        return updated;
      });
    }
  }, [serverUrl, projectId]);

  const setWorkOrders = useCallback((orders: WorkOrder[]) => {
    setWorkOrdersState(orders);
    AsyncStorage.setItem(STORAGE_KEYS.WORK_ORDERS, JSON.stringify(orders));
  }, []);

  const updateWorkOrder = useCallback((id: number, updates: Partial<WorkOrder>) => {
    setWorkOrdersState(prev => {
      const updated = prev.map(wo =>
        wo.id === id 
          ? { ...wo, ...updates, localUpdatedAt: new Date().toISOString(), syncPending: true } 
          : wo
      );
      AsyncStorage.setItem(STORAGE_KEYS.WORK_ORDERS, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const setColumns = useCallback(async (newColumns: ColumnConfig[]) => {
    setColumnsState(newColumns);
    await AsyncStorage.setItem(STORAGE_KEYS.COLUMNS, JSON.stringify(newColumns));
  }, []);

  const setFilters = useCallback((newFilters: FilterConfig) => {
    setFiltersState(newFilters);
  }, []);

  const setSort = useCallback((newSort: SortConfig) => {
    setSortState(newSort);
    AsyncStorage.setItem(STORAGE_KEYS.SORT, JSON.stringify(newSort));
  }, []);

  const getFilteredWorkOrders = useCallback(() => {
    let filtered = [...workOrders];

    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(wo =>
        wo.customerWoId?.toLowerCase().includes(query) ||
        wo.serviceAddress?.toLowerCase().includes(query) ||
        wo.customerName?.toLowerCase().includes(query) ||
        wo.oldMeterId?.toLowerCase().includes(query) ||
        wo.newMeterId?.toLowerCase().includes(query)
      );
    }

    if (filters.status.length > 0) {
      filtered = filtered.filter(wo => filters.status.includes(wo.status));
    }

    if (filters.assignedTo) {
      filtered = filtered.filter(wo =>
        wo.assigned_user_display_name?.toLowerCase().includes(filters.assignedTo.toLowerCase()) ||
        wo.assigned_user_username?.toLowerCase().includes(filters.assignedTo.toLowerCase())
      );
    }

    filtered.sort((a, b) => {
      const aValue = a[sort.field as keyof WorkOrder];
      const bValue = b[sort.field as keyof WorkOrder];

      if (aValue === undefined || aValue === null) return 1;
      if (bValue === undefined || bValue === null) return -1;

      let comparison = 0;
      if (typeof aValue === "string" && typeof bValue === "string") {
        comparison = aValue.localeCompare(bValue);
      } else if (typeof aValue === "number" && typeof bValue === "number") {
        comparison = aValue - bValue;
      } else if (aValue < bValue) {
        comparison = -1;
      } else if (aValue > bValue) {
        comparison = 1;
      }

      return sort.direction === "desc" ? -comparison : comparison;
    });

    return filtered;
  }, [workOrders, filters, sort]);

  return (
    <WorkOrderContext.Provider
      value={{
        workOrders,
        referenceData,
        columns,
        filters,
        sort,
        isLoading,
        lastSyncTime,
        error,
        setWorkOrders,
        updateWorkOrder,
        setColumns,
        setFilters,
        setSort,
        getFilteredWorkOrders,
        refreshWorkOrders,
        claimWorkOrder,
      }}
    >
      {children}
    </WorkOrderContext.Provider>
  );
}

export function useWorkOrders() {
  const context = useContext(WorkOrderContext);
  if (context === undefined) {
    throw new Error("useWorkOrders must be used within a WorkOrderProvider");
  }
  return context;
}
