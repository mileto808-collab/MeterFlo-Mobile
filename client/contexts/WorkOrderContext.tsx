import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/contexts/AuthContext";

export interface WorkOrder {
  id: number;
  customerWoId: string;
  customerId?: string;
  status: string;
  oldMeterId: string;
  newMeterId?: string;
  oldMeterReading?: string;
  newMeterReading?: string;
  oldMeterType?: string;
  newMeterType?: string;
  oldGps?: string;
  newGps?: string;
  serviceAddress: string;
  city?: string;
  state?: string;
  zip?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  meterType?: string;
  serviceType?: string;
  scheduledDate?: string;
  scheduledBy?: string;
  scheduledByUsername?: string;
  notes?: string;
  route?: string;
  zone?: string;
  assignedUserId?: string;
  assignedGroupId?: string;
  assignedUserUsername?: string;
  assignedUserDisplayName?: string;
  assignedGroupName?: string;
  troubleCode?: string;
  troubleNote?: string;
  signatureData?: string;
  signatureName?: string;
  attachments?: (string | { url?: string; filename?: string; name?: string; id?: string })[];
  completedAt?: string;
  completedBy?: string;
  completedByUsername?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  createdByUsername?: string;
  updatedBy?: string;
  updatedByUsername?: string;
  syncPending?: boolean;
  localUpdatedAt?: string;
}

interface ServerWorkOrder {
  id: number;
  status: string;
  customer_wo_id: string;
  customer_id?: string;
  customer_name?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  email?: string;
  route?: string;
  zone?: string;
  service_type?: string;
  old_meter_id?: string;
  new_meter_id?: string;
  old_meter_type?: string;
  new_meter_type?: string;
  old_meter_reading?: number | string;
  new_meter_reading?: number | string;
  old_gps?: string;
  new_gps?: string;
  gps?: string;
  location?: string;
  meter_gps?: string;
  meter_location?: string;
  notes?: string;
  trouble?: string;
  scheduled_at?: string;
  completed_at?: string;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
  completed_by?: string;
  scheduled_by?: string;
  scheduled_by_username?: string;
  completed_by_username?: string;
  assigned_user_id?: string;
  assigned_group_id?: string;
  assigned_user_username?: string;
  assigned_user_display_name?: string;
  signature_data?: string;
  signature_name?: string;
  attachments?: (string | { url?: string; filename?: string; name?: string; id?: string })[];
  assigned_group_name?: string;
  created_by_username?: string;
  updated_by_username?: string;
}

interface ServerReferenceData {
  workOrderStatuses?: string[] | { code: string; label: string; color?: string }[];
  troubleCodes?: { code: string; label?: string; description?: string }[];
  meterTypes?: string[] | { id: string; name: string }[];
  serviceTypes?: string[];
  assignees?: {
    users?: { id: string; username: string; displayName?: string; display_name?: string }[];
    groups?: { name: string; description?: string }[];
  };
}

export interface StatusInfo {
  code: string;
  label: string;
  color: string;
}

export interface ReferenceData {
  statuses: StatusInfo[];
  troubleCodes: { code: string; label: string; description: string }[];
  meterTypes: string[];
  serviceTypes: string[];
  assignees: {
    users: { id: string; username: string; displayName: string }[];
    groups: { name: string; description: string }[];
  };
}

export interface FilterConfig {
  status: string[];
  assignedTo: string;
  searchQuery: string;
}

export interface SortCriterion {
  field: string;
  direction: "asc" | "desc";
}

export type SortConfig = SortCriterion[];

function mapServerWorkOrder(serverWo: ServerWorkOrder): WorkOrder {
  return {
    id: serverWo.id,
    customerWoId: serverWo.customer_wo_id || "",
    customerId: serverWo.customer_id || undefined,
    status: serverWo.status || "Unknown",
    oldMeterId: serverWo.old_meter_id || "",
    newMeterId: serverWo.new_meter_id || undefined,
    oldMeterReading: serverWo.old_meter_reading != null ? String(serverWo.old_meter_reading) : undefined,
    newMeterReading: serverWo.new_meter_reading != null ? String(serverWo.new_meter_reading) : undefined,
    oldMeterType: serverWo.old_meter_type || undefined,
    newMeterType: serverWo.new_meter_type || undefined,
    oldGps: serverWo.old_gps || serverWo.gps || serverWo.location || serverWo.meter_gps || serverWo.meter_location || undefined,
    newGps: serverWo.new_gps || undefined,
    serviceAddress: serverWo.address || "",
    city: serverWo.city || undefined,
    state: serverWo.state || undefined,
    zip: serverWo.zip || undefined,
    customerName: serverWo.customer_name || undefined,
    customerPhone: serverWo.phone || undefined,
    customerEmail: serverWo.email || undefined,
    meterType: serverWo.old_meter_type || undefined,
    serviceType: serverWo.service_type || undefined,
    scheduledDate: serverWo.scheduled_at || undefined,
    scheduledBy: serverWo.scheduled_by || undefined,
    scheduledByUsername: serverWo.scheduled_by_username || undefined,
    notes: serverWo.notes || undefined,
    route: serverWo.route || undefined,
    zone: serverWo.zone || undefined,
    assignedUserId: serverWo.assigned_user_id || undefined,
    assignedGroupId: serverWo.assigned_group_id || undefined,
    assignedUserUsername: serverWo.assigned_user_username || undefined,
    assignedUserDisplayName: serverWo.assigned_user_display_name || undefined,
    assignedGroupName: serverWo.assigned_group_name || undefined,
    troubleCode: serverWo.trouble || undefined,
    signatureData: serverWo.signature_data || undefined,
    signatureName: serverWo.signature_name || undefined,
    attachments: serverWo.attachments || undefined,
    completedAt: serverWo.completed_at || undefined,
    completedBy: serverWo.completed_by || undefined,
    completedByUsername: serverWo.completed_by_username || undefined,
    createdAt: serverWo.created_at || new Date().toISOString(),
    updatedAt: serverWo.updated_at || new Date().toISOString(),
    createdBy: serverWo.created_by || undefined,
    createdByUsername: serverWo.created_by_username || undefined,
    updatedBy: serverWo.updated_by || undefined,
    updatedByUsername: serverWo.updated_by_username || undefined,
  };
}

function normalizeStoredWorkOrder(wo: any): WorkOrder {
  if (wo.customer_wo_id !== undefined || wo.old_meter_id !== undefined) {
    return mapServerWorkOrder(wo as ServerWorkOrder);
  }
  return wo as WorkOrder;
}

function normalizeStoredReferenceData(ref: any): ReferenceData {
  if (ref.workOrderStatuses !== undefined) {
    return mapServerReferenceData(ref as ServerReferenceData);
  }
  if (ref.statuses && Array.isArray(ref.statuses)) {
    const normalizedStatuses: StatusInfo[] = ref.statuses.map((s: any) => {
      if (typeof s === "string") {
        return { code: s, label: s, color: getDefaultStatusColor(s) };
      }
      if (s && typeof s === "object") {
        return {
          code: s.code || s.label || "Unknown",
          label: s.label || s.code || "Unknown",
          color: s.color || getDefaultStatusColor(s.code || s.label || ""),
        };
      }
      return { code: "Unknown", label: "Unknown", color: "#6B7280" };
    });
    return { ...ref, statuses: normalizedStatuses };
  }
  return ref as ReferenceData;
}

function getDefaultStatusColor(status: string): string {
  const normalizedStatus = status.toLowerCase().replace(/\s+/g, "_");
  switch (normalizedStatus) {
    case "open":
    case "pending":
      return "#3B82F6";
    case "in_progress":
    case "in progress":
      return "#F59E0B";
    case "completed":
    case "complete":
      return "#10B981";
    case "trouble":
    case "on_hold":
    case "on hold":
      return "#EF4444";
    case "scheduled":
      return "#8B5CF6";
    default:
      return "#6B7280";
  }
}

function mapServerReferenceData(serverRef: ServerReferenceData): ReferenceData {
  let statuses: StatusInfo[] = [];
  if (Array.isArray(serverRef.workOrderStatuses)) {
    statuses = serverRef.workOrderStatuses.map(s => {
      if (typeof s === "string") {
        return { code: s, label: s, color: getDefaultStatusColor(s) };
      }
      return {
        code: s.code,
        label: s.label || s.code,
        color: s.color || getDefaultStatusColor(s.code),
      };
    });
  }

  let meterTypes: string[] = [];
  if (Array.isArray(serverRef.meterTypes)) {
    meterTypes = serverRef.meterTypes.map(m =>
      typeof m === "string" ? m : m.name || m.id
    );
  }

  const users = (serverRef.assignees?.users || []).map(u => ({
    id: u.id,
    username: u.username,
    displayName: u.displayName || u.display_name || u.username,
  }));

  const groups = (serverRef.assignees?.groups || []).map(g => ({
    name: g.name,
    description: g.description || "",
  }));

  const troubleCodes = (serverRef.troubleCodes || []).map(tc => ({
    code: tc.code,
    label: tc.label || tc.code,
    description: tc.description || "",
  }));

  return {
    statuses,
    troubleCodes,
    meterTypes,
    serviceTypes: serverRef.serviceTypes || [],
    assignees: { users, groups },
  };
}

interface WorkOrderContextType {
  workOrders: WorkOrder[];
  referenceData: ReferenceData | null;
  filters: FilterConfig;
  sort: SortConfig;
  isLoading: boolean;
  lastSyncTime: string | null;
  error: string | null;
  setWorkOrders: (orders: WorkOrder[]) => void;
  updateWorkOrder: (id: number, updates: Partial<WorkOrder>) => void;
  setFilters: (filters: FilterConfig) => void;
  setSort: (sort: SortConfig) => void;
  getFilteredWorkOrders: () => WorkOrder[];
  getStatusColor: (status: string) => string;
  refreshWorkOrders: (forceFullSync?: boolean, preserveLocal?: boolean) => Promise<void>;
  claimWorkOrder: (workOrderId: number) => Promise<void>;
  fetchSingleWorkOrder: (workOrderId: number) => Promise<WorkOrder | null>;
  clearAllData: () => Promise<void>;
}

const WorkOrderContext = createContext<WorkOrderContextType | undefined>(undefined);

const STORAGE_KEYS = {
  WORK_ORDERS: "meterflo_work_orders",
  REFERENCE_DATA: "meterflo_reference_data",
  SORT: "meterflo_sort",
  LAST_SYNC: "meterflo_last_sync",
};

const defaultFilters: FilterConfig = {
  status: [],
  assignedTo: "",
  searchQuery: "",
};

const defaultSort: SortConfig = [];

export function WorkOrderProvider({ children }: { children: ReactNode }) {
  const { serverUrl, projectId, isAuthenticated } = useAuth();
  const [workOrders, setWorkOrdersState] = useState<WorkOrder[]>([]);
  const [referenceData, setReferenceData] = useState<ReferenceData | null>(null);
  const [filters, setFiltersState] = useState<FilterConfig>(defaultFilters);
  const [sort, setSortState] = useState<SortConfig>(defaultSort);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const lastSyncTimeRef = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStoredData();
  }, []);

  useEffect(() => {
    lastSyncTimeRef.current = lastSyncTime;
  }, [lastSyncTime]);

  useEffect(() => {
    if (isAuthenticated && serverUrl && projectId) {
      refreshWorkOrders();
    }
  }, [isAuthenticated, serverUrl, projectId]);

  const loadStoredData = async () => {
    try {
      const [storedOrders, storedRefData, storedSort, storedLastSync] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.WORK_ORDERS),
        AsyncStorage.getItem(STORAGE_KEYS.REFERENCE_DATA),
        AsyncStorage.getItem(STORAGE_KEYS.SORT),
        AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC),
      ]);

      if (storedOrders) {
        const parsedOrders = JSON.parse(storedOrders);
        const normalizedOrders = parsedOrders.map(normalizeStoredWorkOrder);
        setWorkOrdersState(normalizedOrders);
      }
      if (storedRefData) {
        const parsedRefData = JSON.parse(storedRefData);
        const normalizedRefData = normalizeStoredReferenceData(parsedRefData);
        setReferenceData(normalizedRefData);
        AsyncStorage.setItem(STORAGE_KEYS.REFERENCE_DATA, JSON.stringify(normalizedRefData));
      }
      if (storedSort) {
        const parsedSort = JSON.parse(storedSort);
        let normalizedSort: SortConfig = [];
        if (Array.isArray(parsedSort)) {
          normalizedSort = parsedSort.filter(s => s && typeof s === "object" && s.field);
        } else if (parsedSort && typeof parsedSort === "object" && parsedSort.field) {
          normalizedSort = [parsedSort];
        }
        setSortState(normalizedSort);
        AsyncStorage.setItem(STORAGE_KEYS.SORT, JSON.stringify(normalizedSort));
      }
      if (storedLastSync) {
        setLastSyncTime(storedLastSync);
      }
    } catch (err) {
      console.error("Failed to load work order data:", err);
    }
  };

  const refreshWorkOrders = useCallback(async (forceFullSync: boolean = false, preserveLocal: boolean = false) => {
    if (!serverUrl || !projectId) return;
    
    setIsLoading(true);
    setError(null);

    try {
      let path = `/api/projects/${projectId}/mobile/sync/download?includeCompleted=false`;
      
      const currentLastSyncTime = lastSyncTimeRef.current;
      if (currentLastSyncTime && !forceFullSync) {
        path += `&lastSyncTimestamp=${encodeURIComponent(currentLastSyncTime)}`;
      }
      
      const fullUrl = `${serverUrl}${path}`;
      console.log("[refreshWorkOrders] forceFullSync:", forceFullSync, "preserveLocal:", preserveLocal, "lastSyncTime:", currentLastSyncTime, "fullUrl:", fullUrl);

      const response = await fetch(fullUrl, {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[refreshWorkOrders] Server error:", response.status, errorText?.substring(0, 200));
        throw new Error(errorText || "Failed to fetch work orders");
      }

      const data = await response.json();
      
      const serverWorkOrders: ServerWorkOrder[] = data.workOrders || [];
      const newWorkOrders: WorkOrder[] = serverWorkOrders.map(mapServerWorkOrder);
      
      const serverReferenceData: ServerReferenceData | null = data.referenceData || null;
      const newReferenceData: ReferenceData | null = serverReferenceData 
        ? mapServerReferenceData(serverReferenceData)
        : null;
      
      const newServerTimestamp: string = data.serverTimestamp;

      console.log("[refreshWorkOrders] Received", newWorkOrders.length, "work orders from server");
      
      const mergeLocalCompletionData = (serverWo: WorkOrder, localWo: WorkOrder | undefined): WorkOrder => {
        if (!localWo) return serverWo;
        if (localWo.syncPending) return localWo;
        
        const localStatus = localWo.status?.toLowerCase();
        const isLocallyCompleted = localStatus === "completed" || localStatus === "trouble";
        
        if (isLocallyCompleted && localWo.completedAt) {
          return {
            ...serverWo,
            customerWoId: localWo.customerWoId || serverWo.customerWoId,
            oldMeterId: localWo.oldMeterId || serverWo.oldMeterId,
            oldGps: localWo.oldGps || serverWo.oldGps,
            oldMeterReading: localWo.oldMeterReading || serverWo.oldMeterReading,
            newMeterId: localWo.newMeterId || serverWo.newMeterId,
            newMeterReading: localWo.newMeterReading || serverWo.newMeterReading,
            newGps: localWo.newGps || serverWo.newGps,
            completedAt: localWo.completedAt || serverWo.completedAt,
            completedBy: localWo.completedBy || serverWo.completedBy,
            completedByUsername: localWo.completedByUsername || serverWo.completedByUsername,
            troubleCode: localWo.troubleCode || serverWo.troubleCode,
            troubleNote: serverWo.troubleNote,
            status: localWo.status || serverWo.status,
          };
        }
        
        return serverWo;
      };
      
      if (forceFullSync || !currentLastSyncTime) {
        console.log("[refreshWorkOrders] Full sync - replacing work orders, preserveLocal:", preserveLocal);
        setWorkOrdersState(prev => {
          const prevById = new Map(prev.map(wo => [wo.id, wo]));
          const serverWorkOrderIds = new Set(newWorkOrders.map(wo => wo.id));
          
          const mergedServerWorkOrders = newWorkOrders.map(serverWo => {
            const localWo = prevById.get(serverWo.id);
            return mergeLocalCompletionData(serverWo, localWo);
          });
          
          const pendingNotOnServer = prev.filter(wo => wo.syncPending && !serverWorkOrderIds.has(wo.id));
          const pendingIds = new Set(pendingNotOnServer.map(wo => wo.id));
          
          const localOnlyWorkOrders = preserveLocal 
            ? prev.filter(wo => !wo.syncPending && !serverWorkOrderIds.has(wo.id) && !pendingIds.has(wo.id))
            : [];
          
          const removedWorkOrders = preserveLocal 
            ? []
            : prev.filter(wo => !wo.syncPending && !serverWorkOrderIds.has(wo.id));
          
          if (pendingNotOnServer.length > 0) {
            console.log("[refreshWorkOrders] Preserving", pendingNotOnServer.length, "pending work orders not on server");
          }
          if (localOnlyWorkOrders.length > 0) {
            console.log("[refreshWorkOrders] Preserving", localOnlyWorkOrders.length, "local work orders (preserveLocal=true)");
          }
          if (removedWorkOrders.length > 0) {
            console.log("[refreshWorkOrders] Removing", removedWorkOrders.length, "work orders no longer on server");
          }
          
          const finalWorkOrders = [...mergedServerWorkOrders, ...pendingNotOnServer, ...localOnlyWorkOrders];
          AsyncStorage.setItem(STORAGE_KEYS.WORK_ORDERS, JSON.stringify(finalWorkOrders));
          return finalWorkOrders;
        });
      } else if (newWorkOrders.length > 0) {
        console.log("[refreshWorkOrders] Incremental sync - merging work orders");
        setWorkOrdersState(prev => {
          const merged = [...prev];
          newWorkOrders.forEach(newWo => {
            const existingIndex = merged.findIndex(wo => wo.id === newWo.id);
            if (existingIndex >= 0) {
              merged[existingIndex] = mergeLocalCompletionData(newWo, merged[existingIndex]);
            } else {
              merged.push(newWo);
            }
          });
          AsyncStorage.setItem(STORAGE_KEYS.WORK_ORDERS, JSON.stringify(merged));
          return merged;
        });
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
  }, [serverUrl, projectId]);

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
      const mappedWorkOrder = mapServerWorkOrder(data.workOrder);
      setWorkOrdersState(prev => {
        const updated = prev.map(wo => wo.id === workOrderId ? { ...wo, ...mappedWorkOrder } : wo);
        AsyncStorage.setItem(STORAGE_KEYS.WORK_ORDERS, JSON.stringify(updated));
        return updated;
      });
    }
  }, [serverUrl, projectId]);

  const fetchSingleWorkOrder = useCallback(async (workOrderId: number): Promise<WorkOrder | null> => {
    if (!serverUrl || !projectId) return null;

    try {
      const response = await fetch(`${serverUrl}/api/projects/${projectId}/work-orders/${workOrderId}`, {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to fetch work order");
      }

      const data = await response.json();
      const serverWo = data.workOrder || data;
      const mappedWorkOrder = mapServerWorkOrder(serverWo);
      
      setWorkOrdersState(prev => {
        const existingIndex = prev.findIndex(wo => wo.id === workOrderId);
        let updated: WorkOrder[];
        if (existingIndex >= 0) {
          updated = prev.map(wo => wo.id === workOrderId ? { ...wo, ...mappedWorkOrder } : wo);
        } else {
          updated = [...prev, mappedWorkOrder];
        }
        AsyncStorage.setItem(STORAGE_KEYS.WORK_ORDERS, JSON.stringify(updated));
        return updated;
      });

      return mappedWorkOrder;
    } catch (err) {
      console.error("Failed to fetch single work order:", err);
      throw err;
    }
  }, [serverUrl, projectId]);

  const clearAllData = useCallback(async () => {
    console.log("[clearAllData] Clearing all work order data");
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.WORK_ORDERS,
      STORAGE_KEYS.REFERENCE_DATA,
      STORAGE_KEYS.LAST_SYNC,
    ]);
    lastSyncTimeRef.current = null;
    setLastSyncTime(null);
    setReferenceData(null);
    setWorkOrdersState([]);
    console.log("[clearAllData] Done clearing data");
  }, []);

  const setWorkOrders = useCallback((orders: WorkOrder[]) => {
    setWorkOrdersState(orders);
    AsyncStorage.setItem(STORAGE_KEYS.WORK_ORDERS, JSON.stringify(orders));
  }, []);

  const updateWorkOrder = useCallback((id: number, updates: Partial<WorkOrder>) => {
    setWorkOrdersState(prev => {
      const updated = prev.map(wo =>
        wo.id === id 
          ? { 
              ...wo, 
              ...updates, 
              localUpdatedAt: new Date().toISOString(), 
              syncPending: updates.syncPending !== undefined ? updates.syncPending : true 
            } 
          : wo
      );
      AsyncStorage.setItem(STORAGE_KEYS.WORK_ORDERS, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const setFilters = useCallback((newFilters: FilterConfig) => {
    setFiltersState(newFilters);
  }, []);

  const setSort = useCallback((newSort: SortConfig) => {
    const normalizedSort = Array.isArray(newSort) 
      ? newSort.filter(s => s && typeof s === "object" && s.field)
      : [];
    setSortState(normalizedSort);
    AsyncStorage.setItem(STORAGE_KEYS.SORT, JSON.stringify(normalizedSort));
  }, []);

  const getStatusColor = useCallback((status: string): string => {
    if (referenceData?.statuses) {
      const statusInfo = referenceData.statuses.find(
        s => s.code.toLowerCase() === status.toLowerCase() || 
             s.label.toLowerCase() === status.toLowerCase()
      );
      if (statusInfo) {
        return statusInfo.color;
      }
    }
    return getDefaultStatusColor(status);
  }, [referenceData]);

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
      const normalizedFilters = filters.status.map(s => s.toLowerCase());
      filtered = filtered.filter(wo => normalizedFilters.includes(wo.status.toLowerCase()));
    }

    if (filters.assignedTo) {
      filtered = filtered.filter(wo =>
        wo.assignedUserDisplayName?.toLowerCase().includes(filters.assignedTo.toLowerCase()) ||
        wo.assignedUserUsername?.toLowerCase().includes(filters.assignedTo.toLowerCase())
      );
    }

    if (sort.length > 0) {
      filtered.sort((a, b) => {
        for (const criterion of sort) {
          const aValue = a[criterion.field as keyof WorkOrder];
          const bValue = b[criterion.field as keyof WorkOrder];

          if (aValue === undefined || aValue === null) {
            if (bValue !== undefined && bValue !== null) return 1;
            continue;
          }
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

          if (comparison !== 0) {
            return criterion.direction === "desc" ? -comparison : comparison;
          }
        }
        return 0;
      });
    }

    return filtered;
  }, [workOrders, filters, sort]);

  return (
    <WorkOrderContext.Provider
      value={{
        workOrders,
        referenceData,
        filters,
        sort,
        isLoading,
        lastSyncTime,
        error,
        setWorkOrders,
        updateWorkOrder,
        setFilters,
        setSort,
        getFilteredWorkOrders,
        getStatusColor,
        refreshWorkOrders,
        claimWorkOrder,
        fetchSingleWorkOrder,
        clearAllData,
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
