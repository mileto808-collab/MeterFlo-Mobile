import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/contexts/AuthContext";

export interface WorkOrder {
  id: number;
  customerWoId: string;
  customerId?: string;
  status: string;
  oldSystemId?: string;
  newSystemId?: string;
  oldSystemReading?: string;
  newSystemReading?: string;
  oldSystemType?: string;
  newSystemType?: string;
  oldModuleId?: string;
  newModuleId?: string;
  oldModuleRead?: string;
  newModuleRead?: string;
  oldModuleType?: string;
  newModuleType?: string;
  oldGps?: string;
  newGps?: string;
  serviceAddress: string;
  city?: string;
  state?: string;
  zip?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  systemType?: string;
  serviceType?: string;
  serviceTypeColor?: string;
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
  beforePhotos?: { base64: string; filename: string }[];
  afterPhotos?: { base64: string; filename: string }[];
  troublePhotos?: { base64: string; filename: string }[];
  startTime?: string;
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
  isOfflineCreated?: boolean;
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
  service_type_color?: string;
  old_system_id?: string;
  new_system_id?: string;
  old_system_type?: string;
  new_system_type?: string;
  old_system_reading?: number | string;
  new_system_reading?: number | string;
  old_meter_id?: string;
  new_meter_id?: string;
  old_meter_type?: string;
  new_meter_type?: string;
  old_meter_reading?: number | string;
  new_meter_reading?: number | string;
  old_module_id?: string;
  new_module_id?: string;
  old_module_read?: number | string;
  new_module_read?: number | string;
  old_module_type?: string;
  new_module_type?: string;
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
  systemTypes?: string[] | { id: string; name: string }[];
  meterTypes?: string[] | { id: string; name: string }[];
  serviceTypes?: string[] | { name?: string; label?: string; color?: string; badge_color?: string }[];
  service_types?: string[] | { name?: string; label?: string; color?: string; badge_color?: string }[];
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

export interface ServiceTypeInfo {
  name: string;
  color?: string;
}

export interface ReferenceData {
  statuses: StatusInfo[];
  troubleCodes: { code: string; label: string; description: string }[];
  systemTypes: string[];
  serviceTypes: ServiceTypeInfo[];
  assignees: {
    users: { id: string; username: string; displayName: string }[];
    groups: { name: string; description: string }[];
  };
}

export type WizardMode = "changeout" | "reading_only" | "user_choice";
export type WizardGpsMode = "automatic" | "manual" | "disabled";

export interface ProjectConfig {
  wizardMode: WizardMode;
  wizardGpsMode: WizardGpsMode;
  wizardShowGpsStep: boolean;
  wizardShowNotesStep: boolean;
  wizardShowBeforePhotosStep: boolean;
  wizardShowAfterPhotosStep: boolean;
  wizardShowSignatureStep: boolean;
  searchShowBarcodeScan: boolean;
  searchShowQrCodeScan: boolean;
  searchShowManualEntry: boolean;
  searchShowHidScanner: boolean;
  isActive: boolean;
}

export const defaultProjectConfig: ProjectConfig = {
  wizardMode: "changeout",
  wizardGpsMode: "manual",
  wizardShowGpsStep: true,
  wizardShowNotesStep: true,
  wizardShowBeforePhotosStep: true,
  wizardShowAfterPhotosStep: true,
  wizardShowSignatureStep: true,
  searchShowBarcodeScan: true,
  searchShowQrCodeScan: true,
  searchShowManualEntry: true,
  searchShowHidScanner: false,
  isActive: true,
};

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
    oldSystemId: serverWo.old_system_id || serverWo.old_meter_id || "",
    newSystemId: serverWo.new_system_id || serverWo.new_meter_id || undefined,
    oldSystemReading: (serverWo.old_system_reading ?? serverWo.old_meter_reading) != null ? String(serverWo.old_system_reading ?? serverWo.old_meter_reading) : undefined,
    newSystemReading: (serverWo.new_system_reading ?? serverWo.new_meter_reading) != null ? String(serverWo.new_system_reading ?? serverWo.new_meter_reading) : undefined,
    oldSystemType: serverWo.old_system_type || serverWo.old_meter_type || undefined,
    newSystemType: serverWo.new_system_type || serverWo.new_meter_type || undefined,
    oldModuleId: serverWo.old_module_id || undefined,
    newModuleId: serverWo.new_module_id || undefined,
    oldModuleRead: serverWo.old_module_read != null ? String(serverWo.old_module_read) : undefined,
    newModuleRead: serverWo.new_module_read != null ? String(serverWo.new_module_read) : undefined,
    oldModuleType: serverWo.old_module_type || undefined,
    newModuleType: serverWo.new_module_type || undefined,
    oldGps: serverWo.old_gps || serverWo.gps || serverWo.location || serverWo.meter_gps || serverWo.meter_location || undefined,
    newGps: serverWo.new_gps || undefined,
    serviceAddress: serverWo.address || "",
    city: serverWo.city || undefined,
    state: serverWo.state || undefined,
    zip: serverWo.zip || undefined,
    customerName: serverWo.customer_name || undefined,
    customerPhone: serverWo.phone || undefined,
    customerEmail: serverWo.email || undefined,
    systemType: serverWo.old_system_type || serverWo.old_meter_type || undefined,
    serviceType: serverWo.service_type || undefined,
    serviceTypeColor: serverWo.service_type_color || undefined,
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
  if (wo.customer_wo_id !== undefined || wo.old_meter_id !== undefined || wo.old_system_id !== undefined) {
    return mapServerWorkOrder(wo as ServerWorkOrder);
  }
  if (wo.oldMeterId !== undefined && wo.oldSystemId === undefined) {
    return {
      ...wo,
      oldSystemId: wo.oldMeterId,
      newSystemId: wo.newMeterId,
      oldSystemReading: wo.oldMeterReading,
      newSystemReading: wo.newMeterReading,
      oldSystemType: wo.oldMeterType,
      newSystemType: wo.newMeterType,
      systemType: wo.meterType,
    } as WorkOrder;
  }
  return wo as WorkOrder;
}

function normalizeStoredReferenceData(ref: any): ReferenceData {
  if (ref.workOrderStatuses !== undefined) {
    return mapServerReferenceData(ref as ServerReferenceData);
  }
  
  let result = ref;
  
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
    result = { ...result, statuses: normalizedStatuses };
  }
  
  const rawServiceTypes = ref.serviceTypes || ref.service_types;
  if (rawServiceTypes && Array.isArray(rawServiceTypes)) {
    const normalizedServiceTypes: ServiceTypeInfo[] = rawServiceTypes.map((st: any) => {
      if (typeof st === "string") {
        return { name: st };
      }
      if (st && typeof st === "object") {
        const name = st.name || st.label || "Unknown";
        const color = st.color || st.badge_color;
        return { name, color };
      }
      return { name: "Unknown" };
    });
    result = { ...result, serviceTypes: normalizedServiceTypes };
  }
  
  return result as ReferenceData;
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

  let systemTypes: string[] = [];
  const rawSystemTypes = serverRef.systemTypes || serverRef.meterTypes;
  if (Array.isArray(rawSystemTypes)) {
    systemTypes = rawSystemTypes.map(m =>
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

  const rawServiceTypes = serverRef.serviceTypes || serverRef.service_types || [];
  const serviceTypes: ServiceTypeInfo[] = rawServiceTypes.map(st => {
    if (typeof st === "string") {
      return { name: st };
    }
    const name = st.name || st.label || "Unknown";
    const color = st.color || st.badge_color;
    return { name, color };
  });

  return {
    statuses,
    troubleCodes,
    systemTypes,
    serviceTypes,
    assignees: { users, groups },
  };
}

export interface OfflineWorkOrderData {
  id: string;
  projectId: number;
  oldSystemId?: string;
  oldSystemReading?: number | null;
  oldModuleId?: string | null;
  oldModuleReading?: number | null;
  newSystemId?: string;
  newSystemReading?: number;
  newModuleId?: string | null;
  newModuleReading?: number | null;
  gpsCoordinates?: string | null;
  signatureData?: string | null;
  signatureName?: string;
  completedAt: string;
  completedBy: string | null;
  completedByUsername: string | null;
  completionNotes: string | null;
  beforePhotos?: { base64: string; filename: string }[];
  afterPhotos?: { base64: string; filename: string }[];
  troubleCode?: string;
  troublePhotos?: { base64: string; filename: string }[];
  status: string;
  isOfflineCreated: boolean;
  syncPending: boolean;
}

interface WorkOrderContextType {
  workOrders: WorkOrder[];
  referenceData: ReferenceData | null;
  projectConfig: ProjectConfig;
  filters: FilterConfig;
  sort: SortConfig;
  isLoading: boolean;
  lastSyncTime: string | null;
  error: string | null;
  setWorkOrders: (orders: WorkOrder[]) => void;
  updateWorkOrder: (id: number, updates: Partial<WorkOrder>, baseWorkOrder?: WorkOrder) => void;
  deleteLocalWorkOrder: (workOrderId: number | string) => Promise<void>;
  setFilters: (filters: FilterConfig) => void;
  setSort: (sort: SortConfig) => void;
  getFilteredWorkOrders: () => WorkOrder[];
  getStatusColor: (status: string) => string;
  getServiceTypeColor: (serviceType: string) => string | undefined;
  refreshWorkOrders: (forceFullSync?: boolean, preserveLocal?: boolean) => Promise<void>;
  claimWorkOrder: (workOrderId: number) => Promise<void>;
  fetchSingleWorkOrder: (workOrderId: number) => Promise<WorkOrder | null>;
  searchWorkOrdersByMeterIdOnServer: (meterId: string) => Promise<WorkOrder[]>;
  clearAllData: () => Promise<void>;
  addOfflineWorkOrder: (data: OfflineWorkOrderData) => Promise<void>;
  removeOfflineWorkOrder: (lookupId: string) => Promise<void>;
  transformOfflineToServerWorkOrder: (lookupKey: string, serverData: {
    id: number;
    customerWoId?: string;
    status?: string;
    serviceAddress?: string;
    oldGps?: string;
    newGps?: string;
    oldModuleId?: string;
    newModuleId?: string;
    oldModuleRead?: string;
    newModuleRead?: string;
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
  }) => Promise<void>;
}

const WorkOrderContext = createContext<WorkOrderContextType | undefined>(undefined);

const STORAGE_KEYS = {
  WORK_ORDERS: "meterflo_work_orders",
  REFERENCE_DATA: "meterflo_reference_data",
  PROJECT_CONFIG: "meterflo_project_config",
  SORT: "meterflo_sort",
  LAST_SYNC: "meterflo_last_sync",
};

const defaultFilters: FilterConfig = {
  status: ["Open", "Scheduled"],
  assignedTo: "",
  searchQuery: "",
};

const defaultSort: SortConfig = [];

export function WorkOrderProvider({ children }: { children: ReactNode }) {
  const { serverUrl, projectId, isAuthenticated, user } = useAuth();
  const [workOrders, setWorkOrdersState] = useState<WorkOrder[]>([]);
  const [referenceData, setReferenceData] = useState<ReferenceData | null>(null);
  const [projectConfig, setProjectConfig] = useState<ProjectConfig>(defaultProjectConfig);
  const [filters, setFiltersState] = useState<FilterConfig>(defaultFilters);
  const [sort, setSortState] = useState<SortConfig>(defaultSort);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const lastSyncTimeRef = useRef<string | null>(null);
  const previousSessionRef = useRef<{ userId: string | null; projectId: number | null }>({ userId: null, projectId: null });
  const hasLoadedDataRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    lastSyncTimeRef.current = lastSyncTime;
  }, [lastSyncTime]);

  // Clear work orders immediately when user logs out
  useEffect(() => {
    if (!user) {
      console.log("[WorkOrderContext] User logged out, clearing work orders from state");
      setWorkOrdersState([]);
      setReferenceData(null);
      setLastSyncTime(null);
      lastSyncTimeRef.current = null;
      hasLoadedDataRef.current = false;
      previousSessionRef.current = { userId: null, projectId: null };
    }
  }, [user]);

  // Load cached data only when we have a valid session, and verify it belongs to current user+project
  useEffect(() => {
    const currentUserId = user?.id || null;
    const currentProjectId = projectId;
    
    // Skip if no user or project yet
    if (!currentUserId || !currentProjectId) {
      return;
    }
    
    const prev = previousSessionRef.current;
    const userChanged = prev.userId !== null && prev.userId !== currentUserId;
    const projectChanged = prev.projectId !== null && prev.projectId !== currentProjectId;
    
    // If session changed mid-session, clear immediately
    if (userChanged || projectChanged) {
      console.log(`[WorkOrderContext] Session changed (user: ${prev.userId}->${currentUserId}, project: ${prev.projectId}->${currentProjectId}), clearing cache`);
      clearCacheForSessionChange();
      AsyncStorage.setItem("meterflo_cache_session", JSON.stringify({ userId: currentUserId, projectId: currentProjectId }));
    } else if (!hasLoadedDataRef.current) {
      // First time loading with valid session - verify cached data belongs to this session
      hasLoadedDataRef.current = true;
      loadStoredDataIfSessionMatches(currentUserId, currentProjectId);
    }
    
    previousSessionRef.current = { userId: currentUserId, projectId: currentProjectId };
  }, [user?.id, projectId]);
  
  const clearCacheForSessionChange = useCallback(async () => {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.WORK_ORDERS,
      STORAGE_KEYS.REFERENCE_DATA,
      STORAGE_KEYS.PROJECT_CONFIG,
      STORAGE_KEYS.LAST_SYNC,
    ]);
    lastSyncTimeRef.current = null;
    setLastSyncTime(null);
    setReferenceData(null);
    setProjectConfig(defaultProjectConfig);
    setWorkOrdersState([]);
    console.log("[WorkOrderContext] Cache cleared for session change");
  }, []);

  // Verify session before loading cached data - prevents stale data from showing briefly
  const loadStoredDataIfSessionMatches = async (currentUserId: string, currentProjectId: number) => {
    try {
      const cachedSession = await AsyncStorage.getItem("meterflo_cache_session");
      if (cachedSession) {
        try {
          const { userId: cachedUserId, projectId: cachedProjectId } = JSON.parse(cachedSession);
          if (cachedUserId !== currentUserId || cachedProjectId !== currentProjectId) {
            console.log(`[WorkOrderContext] Cached data from different session (user: ${cachedUserId}/${currentUserId}, project: ${cachedProjectId}/${currentProjectId}), clearing`);
            await clearCacheForSessionChange();
            await AsyncStorage.setItem("meterflo_cache_session", JSON.stringify({ userId: currentUserId, projectId: currentProjectId }));
            return; // Don't load stale data
          }
        } catch (e) {
          await clearCacheForSessionChange();
          await AsyncStorage.setItem("meterflo_cache_session", JSON.stringify({ userId: currentUserId, projectId: currentProjectId }));
          return;
        }
      }
      // Session matches or no previous session - safe to load cached data
      await AsyncStorage.setItem("meterflo_cache_session", JSON.stringify({ userId: currentUserId, projectId: currentProjectId }));
      await loadStoredData();
    } catch (e) {
      console.error("[WorkOrderContext] Error checking session:", e);
    }
  };

  useEffect(() => {
    if (isAuthenticated && serverUrl && projectId) {
      refreshWorkOrders();
    }
  }, [isAuthenticated, serverUrl, projectId, user?.id]);

  const loadStoredData = async () => {
    try {
      const [storedOrders, storedRefData, storedProjectConfig, storedSort, storedLastSync] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.WORK_ORDERS),
        AsyncStorage.getItem(STORAGE_KEYS.REFERENCE_DATA),
        AsyncStorage.getItem(STORAGE_KEYS.PROJECT_CONFIG),
        AsyncStorage.getItem(STORAGE_KEYS.SORT),
        AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC),
      ]);

      if (storedOrders) {
        const parsedOrders = JSON.parse(storedOrders);
        let normalizedOrders = parsedOrders.map(normalizeStoredWorkOrder);
        
        // Migrate offline work orders to normalize customerWoId with trimmed identifiers
        let needsMigration = false;
        normalizedOrders = normalizedOrders.map((wo: WorkOrder) => {
          if (wo.customerWoId?.startsWith("OFFLINE-")) {
            // Extract the lookup key after OFFLINE-
            const currentLookupPart = wo.customerWoId.substring(8);
            const trimmedLookupPart = currentLookupPart.trim();
            
            // Also normalize the identifier fields
            const trimmedOldSystemId = wo.oldSystemId?.trim() || "";
            const trimmedOldModuleId = wo.oldModuleId?.trim() || "";
            const trimmedNewSystemId = wo.newSystemId?.trim() || "";
            const trimmedNewModuleId = wo.newModuleId?.trim() || "";
            
            // Compute what the canonical lookup key should be
            const canonicalLookupKey = trimmedOldSystemId || trimmedOldModuleId;
            
            // Check if migration is needed
            const customerWoIdNeedsUpdate = currentLookupPart !== trimmedLookupPart;
            const fieldsNeedUpdate = 
              wo.oldSystemId !== (trimmedOldSystemId || undefined) ||
              wo.oldModuleId !== (trimmedOldModuleId || undefined) ||
              wo.newSystemId !== (trimmedNewSystemId || undefined) ||
              wo.newModuleId !== (trimmedNewModuleId || undefined);
            
            if (customerWoIdNeedsUpdate || fieldsNeedUpdate) {
              needsMigration = true;
              const finalLookupKey = canonicalLookupKey || trimmedLookupPart;
              console.log(`[WorkOrderContext] Migrating offline WO customerWoId from ${wo.customerWoId} to OFFLINE-${finalLookupKey}`);
              return {
                ...wo,
                customerWoId: `OFFLINE-${finalLookupKey}`,
                oldSystemId: trimmedOldSystemId || undefined,
                oldModuleId: trimmedOldModuleId || undefined,
                newSystemId: trimmedNewSystemId || undefined,
                newModuleId: trimmedNewModuleId || undefined,
              };
            }
          }
          return wo;
        });
        
        // Filter out offline work orders with empty lookup keys (unrecoverable legacy data)
        const filteredOrders = normalizedOrders.filter((wo: WorkOrder) => {
          if (wo.customerWoId === "OFFLINE-" || wo.customerWoId === "OFFLINE-undefined" || wo.customerWoId === "OFFLINE-null") {
            console.warn(`[WorkOrderContext] Removing unrecoverable offline work order with invalid customerWoId: ${wo.customerWoId}`);
            needsMigration = true;
            return false;
          }
          return true;
        });
        
        if (needsMigration) {
          await AsyncStorage.setItem(STORAGE_KEYS.WORK_ORDERS, JSON.stringify(filteredOrders));
          console.log("[WorkOrderContext] Migrated offline work orders to normalized format");
        }
        
        setWorkOrdersState(filteredOrders);
      }
      if (storedRefData) {
        const parsedRefData = JSON.parse(storedRefData);
        const normalizedRefData = normalizeStoredReferenceData(parsedRefData);
        setReferenceData(normalizedRefData);
        AsyncStorage.setItem(STORAGE_KEYS.REFERENCE_DATA, JSON.stringify(normalizedRefData));
      }
      if (storedProjectConfig) {
        try {
          const parsedConfig = JSON.parse(storedProjectConfig);
          setProjectConfig({ ...defaultProjectConfig, ...parsedConfig });
        } catch (e) {
          console.warn("[WorkOrderContext] Failed to parse stored project config:", e);
        }
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
      const includeCompleted = preserveLocal ? "true" : "false";
      let path = `/api/projects/${projectId}/mobile/sync/download?includeCompleted=${includeCompleted}`;
      
      const currentLastSyncTime = lastSyncTimeRef.current;
      if (currentLastSyncTime && !forceFullSync) {
        path += `&lastSyncTimestamp=${encodeURIComponent(currentLastSyncTime)}`;
      }
      
      const fullUrl = `${serverUrl}${path}`;
      console.log("[refreshWorkOrders] forceFullSync:", forceFullSync, "preserveLocal:", preserveLocal, "lastSyncTime:", currentLastSyncTime, "fullUrl:", fullUrl);

      const response = await fetch(fullUrl, {
        method: "GET",
        headers: {
          "X-Requested-With": "XMLHttpRequest",
          "Origin": serverUrl,
          "Referer": `${serverUrl}/`,
        },
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
            oldSystemId: localWo.oldSystemId || serverWo.oldSystemId,
            oldGps: localWo.oldGps || serverWo.oldGps,
            oldSystemReading: localWo.oldSystemReading || serverWo.oldSystemReading,
            newSystemId: localWo.newSystemId || serverWo.newSystemId,
            newSystemReading: localWo.newSystemReading || serverWo.newSystemReading,
            newGps: localWo.newGps || serverWo.newGps,
            completedAt: localWo.completedAt || serverWo.completedAt,
            completedBy: localWo.completedBy || serverWo.completedBy,
            completedByUsername: localWo.completedByUsername || serverWo.completedByUsername,
            troubleCode: localWo.troubleCode || serverWo.troubleCode,
            troubleNote: serverWo.troubleNote,
            notes: serverWo.notes,
            status: localWo.status || serverWo.status,
            beforePhotos: localWo.beforePhotos || serverWo.beforePhotos,
            afterPhotos: localWo.afterPhotos || serverWo.afterPhotos,
            troublePhotos: localWo.troublePhotos || serverWo.troublePhotos,
            isOfflineCreated: localWo.isOfflineCreated,
          };
        }
        
        return serverWo;
      };
      
      if (forceFullSync || !currentLastSyncTime) {
        console.log("[refreshWorkOrders] Full sync - replacing work orders, preserveLocal:", preserveLocal);
        
        // Load pending actions to check if syncPending work orders have actual pending actions
        const pendingActionsStr = await AsyncStorage.getItem("meterflo_pending_actions");
        const pendingActions: { workOrderId?: number; data?: { oldSystemId?: string; oldMeterId?: string; oldModuleId?: string } }[] = pendingActionsStr ? JSON.parse(pendingActionsStr) : [];
        // Build set of work order IDs that have actual pending actions
        const workOrderIdsWithPendingActions = new Set(
          pendingActions
            .filter(a => a.workOrderId != null)
            .map(a => a.workOrderId)
        );
        // Also track lookup keys for offline work orders (which don't have a workOrderId yet)
        const offlineLookupKeys = new Set(
          pendingActions
            .filter(a => a.workOrderId == null && a.data)
            .map(a => {
              const d = a.data!;
              return (d.oldSystemId || d.oldMeterId || d.oldModuleId || "").trim();
            })
            .filter(k => k)
        );
        
        setWorkOrdersState(prev => {
          const prevById = new Map(prev.map(wo => [wo.id, wo]));
          const serverWorkOrderIds = new Set(newWorkOrders.map(wo => wo.id));
          
          const mergedServerWorkOrders = newWorkOrders
            .filter(serverWo => {
              if (!preserveLocal) return true;
              const localWo = prevById.get(serverWo.id);
              if (localWo) return true;
              const serverStatus = serverWo.status?.toLowerCase();
              const isServerCompleted = serverStatus === "completed" || serverStatus === "trouble";
              return !isServerCompleted;
            })
            .map(serverWo => {
              const localWo = prevById.get(serverWo.id);
              return mergeLocalCompletionData(serverWo, localWo);
            });
          
          // Only preserve syncPending work orders if they have an actual pending action
          const pendingNotOnServer = prev.filter(wo => {
            if (!wo.syncPending) return false;
            if (serverWorkOrderIds.has(wo.id)) return false;
            
            // Check if there's an actual pending action for this work order
            if (wo.id && workOrderIdsWithPendingActions.has(wo.id)) {
              return true; // Has pending action by work order ID
            }
            // For offline work orders, check by lookup key
            const lookupKey = (wo.oldSystemId || wo.oldModuleId || "").trim();
            if (lookupKey && offlineLookupKeys.has(lookupKey)) {
              return true; // Has pending action by lookup key
            }
            // No pending action found - this is a stale syncPending flag
            console.log(`[refreshWorkOrders] Removing stale syncPending work order ${wo.id || wo.customerWoId} - no pending action found`);
            return false;
          });
          const pendingIds = new Set(pendingNotOnServer.map(wo => wo.id));
          
          // When preserveLocal=true (pull-down refresh):
          // - Keep Completed/Trouble work orders that the user processed (have completedAt)
          // - Remove Open work orders that weren't claimed/processed by user
          // When preserveLocal=false (Sync button):
          // - Remove all work orders not on server (except syncPending)
          const localOnlyWorkOrders = preserveLocal 
            ? prev.filter(wo => {
                if (wo.syncPending) return false; // Already handled in pendingNotOnServer
                if (serverWorkOrderIds.has(wo.id)) return false; // On server, handled in mergedServerWorkOrders
                if (pendingIds.has(wo.id)) return false; // Already handled in pendingNotOnServer
                
                // Keep user-processed Completed/Trouble work orders
                const status = wo.status?.toLowerCase();
                const isCompletedOrTrouble = status === "completed" || status === "trouble";
                const wasProcessedByUser = !!wo.completedAt;
                
                return isCompletedOrTrouble && wasProcessedByUser;
              })
            : [];
          
          const removedWorkOrders = prev.filter(wo => {
            if (serverWorkOrderIds.has(wo.id)) return false; // Still on server
            if (pendingIds.has(wo.id)) return false; // Preserved as pending with actual action
            
            // Count stale syncPending work orders as removed (no actual pending action)
            if (wo.syncPending && !pendingIds.has(wo.id)) return true;
            
            if (preserveLocal) {
              // Only remove Open work orders not processed by user
              const status = wo.status?.toLowerCase();
              const isCompletedOrTrouble = status === "completed" || status === "trouble";
              const wasProcessedByUser = !!wo.completedAt;
              return !(isCompletedOrTrouble && wasProcessedByUser);
            }
            return true; // Remove all when preserveLocal=false
          });
          
          if (pendingNotOnServer.length > 0) {
            console.log("[refreshWorkOrders] Preserving", pendingNotOnServer.length, "pending work orders not on server");
          }
          if (localOnlyWorkOrders.length > 0) {
            console.log("[refreshWorkOrders] Preserving", localOnlyWorkOrders.length, "user-processed work orders not on server");
          }
          if (removedWorkOrders.length > 0) {
            console.log("[refreshWorkOrders] Removing", removedWorkOrders.length, "work orders no longer on server (unclaimed Open orders)");
          }
          
          const finalWorkOrders = [...mergedServerWorkOrders, ...pendingNotOnServer, ...localOnlyWorkOrders];
          AsyncStorage.setItem(STORAGE_KEYS.WORK_ORDERS, JSON.stringify(finalWorkOrders));
          return finalWorkOrders;
        });
      } else if (newWorkOrders.length > 0) {
        console.log("[refreshWorkOrders] Incremental sync - merging work orders");
        setWorkOrdersState(prev => {
          const merged = [...prev];
          const prevById = new Map(prev.map(wo => [wo.id, wo]));
          newWorkOrders.forEach(newWo => {
            const existingIndex = merged.findIndex(wo => wo.id === newWo.id);
            if (existingIndex >= 0) {
              merged[existingIndex] = mergeLocalCompletionData(newWo, merged[existingIndex]);
            } else {
              const localWo = prevById.get(newWo.id);
              if (localWo) {
                merged.push(mergeLocalCompletionData(newWo, localWo));
              } else {
                const serverStatus = newWo.status?.toLowerCase();
                const isServerCompleted = serverStatus === "completed" || serverStatus === "trouble";
                if (!isServerCompleted) {
                  merged.push(newWo);
                }
              }
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

      // Fetch project configuration
      try {
        const projectConfigUrl = `${serverUrl}/api/projects/${projectId}`;
        const configResponse = await fetch(projectConfigUrl, {
          method: "GET",
          headers: {
            "X-Requested-With": "XMLHttpRequest",
            "Origin": serverUrl,
            "Referer": `${serverUrl}/`,
          },
          credentials: "include",
        });

        if (configResponse.ok) {
          const projectData = await configResponse.json();
          const newProjectConfig: ProjectConfig = {
            wizardMode: projectData.wizardMode || defaultProjectConfig.wizardMode,
            wizardGpsMode: projectData.wizardGpsMode || defaultProjectConfig.wizardGpsMode,
            wizardShowGpsStep: projectData.wizardShowGpsStep ?? defaultProjectConfig.wizardShowGpsStep,
            wizardShowNotesStep: projectData.wizardShowNotesStep ?? defaultProjectConfig.wizardShowNotesStep,
            wizardShowBeforePhotosStep: projectData.wizardShowBeforePhotosStep ?? defaultProjectConfig.wizardShowBeforePhotosStep,
            wizardShowAfterPhotosStep: projectData.wizardShowAfterPhotosStep ?? defaultProjectConfig.wizardShowAfterPhotosStep,
            wizardShowSignatureStep: projectData.wizardShowSignatureStep ?? defaultProjectConfig.wizardShowSignatureStep,
            searchShowBarcodeScan: projectData.searchShowBarcodeScan ?? defaultProjectConfig.searchShowBarcodeScan,
            searchShowQrCodeScan: projectData.searchShowQrCodeScan ?? defaultProjectConfig.searchShowQrCodeScan,
            searchShowManualEntry: projectData.searchShowManualEntry ?? defaultProjectConfig.searchShowManualEntry,
            searchShowHidScanner: projectData.searchShowHidScanner ?? defaultProjectConfig.searchShowHidScanner,
            isActive: projectData.isActive ?? defaultProjectConfig.isActive,
          };
          setProjectConfig(newProjectConfig);
          await AsyncStorage.setItem(STORAGE_KEYS.PROJECT_CONFIG, JSON.stringify(newProjectConfig));
          console.log("[refreshWorkOrders] Project config updated:", newProjectConfig.wizardMode);
        }
      } catch (configErr) {
        console.warn("[refreshWorkOrders] Failed to fetch project config, using cached:", configErr);
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
      headers: {
        "X-Requested-With": "XMLHttpRequest",
        "Origin": serverUrl,
        "Referer": `${serverUrl}/`,
      },
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
        const updated = prev.map(wo => {
          if (wo.id !== workOrderId) return wo;
          const merged: WorkOrder = { ...wo };
          for (const key of Object.keys(mappedWorkOrder) as (keyof WorkOrder)[]) {
            const serverValue = mappedWorkOrder[key];
            if (serverValue !== undefined && serverValue !== "" && serverValue !== null) {
              (merged as any)[key] = serverValue;
            }
          }
          return merged;
        });
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
        headers: {
          "X-Requested-With": "XMLHttpRequest",
          "Origin": serverUrl,
          "Referer": `${serverUrl}/`,
        },
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

  const searchWorkOrdersByMeterIdOnServer = useCallback(async (searchTerm: string): Promise<WorkOrder[]> => {
    if (!serverUrl || !projectId) return [];

    try {
      console.log("[searchWorkOrdersByMeterIdOnServer] Searching for term:", searchTerm);
      // Use the multi-field search endpoint that supports meter ID, customer ID, and address matching
      const response = await fetch(
        `${serverUrl}/api/projects/${projectId}/work-orders/by-meter/${encodeURIComponent(searchTerm)}`,
        {
          method: "GET",
          headers: {
            "X-Requested-With": "XMLHttpRequest",
            "Origin": serverUrl,
            "Referer": `${serverUrl}/`,
          },
          credentials: "include",
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          console.log("[searchWorkOrdersByMeterIdOnServer] No work orders found for term:", searchTerm);
          return [];
        }
        const errorText = await response.text();
        throw new Error(errorText || "Failed to search work orders");
      }

      const data = await response.json();
      // Handle different response formats: array, { workOrders: [...] }, { workOrder: {...} }, or null
      let serverWorkOrders: ServerWorkOrder[];
      if (!data || typeof data !== 'object') {
        // Null, undefined, or primitive response
        serverWorkOrders = [];
      } else if (Array.isArray(data)) {
        serverWorkOrders = data;
      } else if (Array.isArray(data.workOrders)) {
        serverWorkOrders = data.workOrders;
      } else if (data.workOrder && typeof data.workOrder === 'object') {
        // Single work order returned
        serverWorkOrders = [data.workOrder];
      } else if (data.id) {
        // Single work order returned directly (not wrapped)
        serverWorkOrders = [data as ServerWorkOrder];
      } else {
        serverWorkOrders = [];
      }
      const mappedWorkOrders = serverWorkOrders.map(mapServerWorkOrder);
      
      console.log("[searchWorkOrdersByMeterIdOnServer] Found", mappedWorkOrders.length, "work orders");
      return mappedWorkOrders;
    } catch (err) {
      console.error("[searchWorkOrdersByMeterIdOnServer] Failed to search:", err);
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

  const addOfflineWorkOrder = useCallback(async (data: OfflineWorkOrderData) => {
    console.log("[addOfflineWorkOrder] Creating new offline work order:", data.id);
    
    // Normalize identifiers by trimming whitespace for consistent lookup keys
    const normalizedSystemId = data.oldSystemId?.trim() || "";
    const normalizedModuleId = data.oldModuleId?.trim() || "";
    
    // Use normalized system ID if available, otherwise use normalized module ID
    const lookupId = normalizedSystemId || normalizedModuleId;
    
    // Guard against missing identifiers - require at least one
    if (!lookupId) {
      console.error("[addOfflineWorkOrder] Cannot create offline work order - missing both oldSystemId and oldModuleId");
      throw new Error("Cannot create offline work order without system ID or module ID");
    }
    
    const newWorkOrder: WorkOrder = {
      id: Date.now(),
      customerWoId: `OFFLINE-${lookupId}`,
      status: data.status,
      oldSystemId: normalizedSystemId || undefined,
      newSystemId: data.newSystemId?.trim() || undefined,
      oldModuleId: normalizedModuleId || undefined,
      newModuleId: data.newModuleId?.trim() || undefined,
      oldSystemReading: data.oldSystemReading != null ? String(data.oldSystemReading) : undefined,
      newSystemReading: data.newSystemReading != null ? String(data.newSystemReading) : undefined,
      oldModuleRead: data.oldModuleReading != null ? String(data.oldModuleReading) : undefined,
      newModuleRead: data.newModuleReading != null ? String(data.newModuleReading) : undefined,
      oldGps: data.gpsCoordinates || undefined,
      newGps: data.gpsCoordinates || undefined,
      serviceAddress: "Offline Work Order",
      signatureData: data.signatureData || undefined,
      signatureName: data.signatureName || undefined,
      notes: data.completionNotes || undefined,
      troubleCode: data.troubleCode,
      beforePhotos: data.beforePhotos,
      afterPhotos: data.afterPhotos,
      troublePhotos: data.troublePhotos,
      completedAt: data.completedAt,
      completedBy: data.completedBy || undefined,
      completedByUsername: data.completedByUsername || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncPending: true,
      localUpdatedAt: new Date().toISOString(),
      isOfflineCreated: true,
    };
    
    setWorkOrdersState(prev => {
      const updated = [newWorkOrder, ...prev];
      AsyncStorage.setItem(STORAGE_KEYS.WORK_ORDERS, JSON.stringify(updated));
      return updated;
    });
    
    console.log("[addOfflineWorkOrder] Work order added successfully");
  }, []);

  const removeOfflineWorkOrder = useCallback(async (lookupId: string) => {
    console.log("[removeOfflineWorkOrder] Removing offline work order for lookup ID:", lookupId);
    const customerWoId = `OFFLINE-${lookupId}`;
    
    setWorkOrdersState(prev => {
      const updated = prev.filter(wo => wo.customerWoId !== customerWoId);
      if (updated.length !== prev.length) {
        console.log("[removeOfflineWorkOrder] Removed offline work order:", customerWoId);
        AsyncStorage.setItem(STORAGE_KEYS.WORK_ORDERS, JSON.stringify(updated));
      }
      return updated;
    });
  }, []);

  const transformOfflineToServerWorkOrder = useCallback(async (lookupKey: string, serverData: {
    id: number;
    customerWoId?: string;
    status?: string;
    serviceAddress?: string;
    oldGps?: string;
    newGps?: string;
    oldModuleId?: string;
    newModuleId?: string;
    oldModuleRead?: string;
    newModuleRead?: string;
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
  }) => {
    console.log("[transformOfflineToServerWorkOrder] Transforming offline WO for lookupKey:", lookupKey, "to server ID:", serverData.id);
    const offlineCustomerWoId = `OFFLINE-${lookupKey}`;
    
    setWorkOrdersState(prev => {
      const updated = prev.map(wo => {
        if (wo.customerWoId === offlineCustomerWoId) {
          console.log("[transformOfflineToServerWorkOrder] Found offline WO, updating with server data");
          return {
            ...wo,
            id: serverData.id,
            customerWoId: serverData.customerWoId || wo.customerWoId,
            status: serverData.status || wo.status,
            serviceAddress: serverData.serviceAddress || wo.serviceAddress,
            oldGps: serverData.oldGps || wo.oldGps,
            newGps: serverData.newGps || wo.newGps,
            oldModuleId: serverData.oldModuleId || wo.oldModuleId,
            newModuleId: serverData.newModuleId || wo.newModuleId,
            oldModuleRead: serverData.oldModuleRead || wo.oldModuleRead,
            newModuleRead: serverData.newModuleRead || wo.newModuleRead,
            route: serverData.route || wo.route,
            zone: serverData.zone || wo.zone,
            assignedUserId: serverData.assignedUserId || wo.assignedUserId,
            assignedUserUsername: serverData.assignedUserUsername || wo.assignedUserUsername,
            assignedUserDisplayName: serverData.assignedUserDisplayName || wo.assignedUserDisplayName,
            assignedGroupId: serverData.assignedGroupId || wo.assignedGroupId,
            assignedGroupName: serverData.assignedGroupName || wo.assignedGroupName,
            customerName: serverData.customerName || wo.customerName,
            customerPhone: serverData.customerPhone || wo.customerPhone,
            customerEmail: serverData.customerEmail || wo.customerEmail,
            city: serverData.city || wo.city,
            state: serverData.state || wo.state,
            zip: serverData.zip || wo.zip,
            syncPending: false,
            localUpdatedAt: new Date().toISOString(),
            isOfflineCreated: true,
          };
        }
        return wo;
      });
      AsyncStorage.setItem(STORAGE_KEYS.WORK_ORDERS, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const setWorkOrders = useCallback((orders: WorkOrder[]) => {
    setWorkOrdersState(orders);
    AsyncStorage.setItem(STORAGE_KEYS.WORK_ORDERS, JSON.stringify(orders));
  }, []);

  const updateWorkOrder = useCallback((id: number, updates: Partial<WorkOrder>, baseWorkOrder?: WorkOrder) => {
    setWorkOrdersState(prev => {
      const existingIndex = prev.findIndex(wo => wo.id === id);
      
      if (existingIndex >= 0) {
        // Work order exists - update it
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
      } else if (baseWorkOrder) {
        // Work order doesn't exist but we have the base - add it with updates applied
        // Normalize the base work order to ensure consistent field naming
        console.log("[updateWorkOrder] Work order not found locally, adding with updates:", id);
        const now = new Date().toISOString();
        const normalizedBase = normalizeStoredWorkOrder(baseWorkOrder);
        const newWorkOrder: WorkOrder = {
          ...normalizedBase,
          ...updates,
          // Ensure required fields are set
          id: id,
          createdAt: normalizedBase.createdAt || now,
          updatedAt: normalizedBase.updatedAt || now,
          localUpdatedAt: now,
          syncPending: updates.syncPending !== undefined ? updates.syncPending : true,
        };
        const updated = [...prev, newWorkOrder];
        AsyncStorage.setItem(STORAGE_KEYS.WORK_ORDERS, JSON.stringify(updated));
        return updated;
      } else {
        // Work order doesn't exist and no base provided - log warning and return unchanged
        console.warn("[updateWorkOrder] Work order not found and no base provided:", id);
        return prev;
      }
    });
  }, []);

  const deleteLocalWorkOrder = useCallback(async (workOrderId: number | string) => {
    const numericId = typeof workOrderId === "string" ? parseInt(workOrderId, 10) : workOrderId;
    console.log("[deleteLocalWorkOrder] Deleting work order:", numericId);
    
    setWorkOrdersState(prev => {
      const workOrderToDelete = prev.find(wo => wo.id === numericId);
      if (workOrderToDelete) {
        const photoCount = 
          (workOrderToDelete.beforePhotos?.length || 0) + 
          (workOrderToDelete.afterPhotos?.length || 0) + 
          (workOrderToDelete.troublePhotos?.length || 0);
        console.log("[deleteLocalWorkOrder] Removing work order with", photoCount, "photos");
      }
      
      const updated = prev.filter(wo => wo.id !== numericId);
      if (updated.length !== prev.length) {
        console.log("[deleteLocalWorkOrder] Work order removed successfully");
        AsyncStorage.setItem(STORAGE_KEYS.WORK_ORDERS, JSON.stringify(updated));
      } else {
        console.log("[deleteLocalWorkOrder] Work order not found in local storage");
      }
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

  const getServiceTypeColor = useCallback((serviceType: string): string | undefined => {
    if (referenceData?.serviceTypes && serviceType) {
      const serviceTypeInfo = referenceData.serviceTypes.find(
        st => st.name && st.name.toLowerCase() === serviceType.toLowerCase()
      );
      if (serviceTypeInfo?.color) {
        return serviceTypeInfo.color;
      }
    }
    return undefined;
  }, [referenceData]);

  const getFilteredWorkOrders = useCallback(() => {
    let filtered = [...workOrders];

    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(wo =>
        wo.customerWoId?.toLowerCase().includes(query) ||
        wo.serviceAddress?.toLowerCase().includes(query) ||
        wo.customerName?.toLowerCase().includes(query) ||
        wo.oldSystemId?.toLowerCase().includes(query) ||
        wo.newSystemId?.toLowerCase().includes(query)
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
        projectConfig,
        filters,
        sort,
        isLoading,
        lastSyncTime,
        error,
        setWorkOrders,
        updateWorkOrder,
        deleteLocalWorkOrder,
        setFilters,
        setSort,
        getFilteredWorkOrders,
        getStatusColor,
        getServiceTypeColor,
        refreshWorkOrders,
        claimWorkOrder,
        fetchSingleWorkOrder,
        searchWorkOrdersByMeterIdOnServer,
        clearAllData,
        addOfflineWorkOrder,
        removeOfflineWorkOrder,
        transformOfflineToServerWorkOrder,
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
