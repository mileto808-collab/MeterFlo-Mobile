import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface WorkOrder {
  id: string;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "on_hold";
  priority: "low" | "medium" | "high" | "urgent";
  assignedTo: string;
  location: string;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
  notes: string[];
  workflowSteps: WorkflowStep[];
  currentStep: number;
  syncPending?: boolean;
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: "text" | "number" | "select" | "checkbox" | "photo" | "signature";
  required: boolean;
  options?: string[];
  value?: any;
  completed: boolean;
}

export interface ColumnConfig {
  key: string;
  label: string;
  visible: boolean;
  order: number;
}

export interface FilterConfig {
  status: string[];
  priority: string[];
  assignedTo: string;
  searchQuery: string;
  dateRange: { start: string | null; end: string | null };
}

export interface SortConfig {
  field: string;
  direction: "asc" | "desc";
}

interface WorkOrderContextType {
  workOrders: WorkOrder[];
  columns: ColumnConfig[];
  filters: FilterConfig;
  sort: SortConfig;
  isLoading: boolean;
  setWorkOrders: (orders: WorkOrder[]) => void;
  updateWorkOrder: (id: string, updates: Partial<WorkOrder>) => void;
  setColumns: (columns: ColumnConfig[]) => Promise<void>;
  setFilters: (filters: FilterConfig) => void;
  setSort: (sort: SortConfig) => void;
  getFilteredWorkOrders: () => WorkOrder[];
  refreshWorkOrders: () => Promise<void>;
}

const WorkOrderContext = createContext<WorkOrderContextType | undefined>(undefined);

const STORAGE_KEYS = {
  WORK_ORDERS: "meterflo_work_orders",
  COLUMNS: "meterflo_columns",
  FILTERS: "meterflo_filters",
  SORT: "meterflo_sort",
};

const defaultColumns: ColumnConfig[] = [
  { key: "id", label: "ID", visible: true, order: 0 },
  { key: "title", label: "Title", visible: true, order: 1 },
  { key: "status", label: "Status", visible: true, order: 2 },
  { key: "priority", label: "Priority", visible: true, order: 3 },
  { key: "assignedTo", label: "Assigned To", visible: true, order: 4 },
  { key: "location", label: "Location", visible: false, order: 5 },
  { key: "dueDate", label: "Due Date", visible: true, order: 6 },
];

const defaultFilters: FilterConfig = {
  status: [],
  priority: [],
  assignedTo: "",
  searchQuery: "",
  dateRange: { start: null, end: null },
};

const defaultSort: SortConfig = {
  field: "dueDate",
  direction: "asc",
};

const mockWorkOrders: WorkOrder[] = [
  {
    id: "WO-001",
    title: "Replace Water Meter - 123 Main St",
    description: "Customer reported inaccurate meter readings. Replace existing meter with new digital model.",
    status: "pending",
    priority: "high",
    assignedTo: "John Smith",
    location: "123 Main Street, Springfield",
    dueDate: "2025-12-28",
    createdAt: "2025-12-20T10:00:00Z",
    updatedAt: "2025-12-20T10:00:00Z",
    notes: ["Customer prefers morning appointments"],
    workflowSteps: [
      { id: "1", name: "Verify Location", type: "checkbox", required: true, completed: false },
      { id: "2", name: "Current Meter Reading", type: "number", required: true, completed: false },
      { id: "3", name: "New Meter Serial Number", type: "text", required: true, completed: false },
      { id: "4", name: "Installation Photo", type: "photo", required: true, completed: false },
      { id: "5", name: "Customer Signature", type: "signature", required: true, completed: false },
    ],
    currentStep: 0,
  },
  {
    id: "WO-002",
    title: "Leak Investigation - 456 Oak Ave",
    description: "High water usage detected. Investigate potential leak in main line.",
    status: "in_progress",
    priority: "urgent",
    assignedTo: "John Smith",
    location: "456 Oak Avenue, Springfield",
    dueDate: "2025-12-27",
    createdAt: "2025-12-19T14:00:00Z",
    updatedAt: "2025-12-26T09:30:00Z",
    notes: ["Access through side gate", "Dog on property - call ahead"],
    workflowSteps: [
      { id: "1", name: "Confirm Address", type: "checkbox", required: true, completed: true, value: true },
      { id: "2", name: "Leak Type", type: "select", required: true, options: ["Main Line", "Service Line", "Meter", "Other"], completed: false },
      { id: "3", name: "Estimated Flow Rate (GPM)", type: "number", required: true, completed: false },
      { id: "4", name: "Repair Notes", type: "text", required: false, completed: false },
    ],
    currentStep: 1,
  },
  {
    id: "WO-003",
    title: "New Service Installation - 789 Pine Dr",
    description: "Install new water service for residential construction.",
    status: "pending",
    priority: "medium",
    assignedTo: "Maria Garcia",
    location: "789 Pine Drive, Springfield",
    dueDate: "2025-12-30",
    createdAt: "2025-12-22T11:00:00Z",
    updatedAt: "2025-12-22T11:00:00Z",
    notes: [],
    workflowSteps: [
      { id: "1", name: "Permit Verification", type: "checkbox", required: true, completed: false },
      { id: "2", name: "Meter Size", type: "select", required: true, options: ["5/8\"", "3/4\"", "1\"", "1.5\"", "2\""], completed: false },
      { id: "3", name: "Installation Photo", type: "photo", required: true, completed: false },
    ],
    currentStep: 0,
  },
  {
    id: "WO-004",
    title: "Meter Calibration - 321 Elm St",
    description: "Annual calibration check for commercial meter.",
    status: "completed",
    priority: "low",
    assignedTo: "John Smith",
    location: "321 Elm Street, Springfield",
    dueDate: "2025-12-25",
    createdAt: "2025-12-15T08:00:00Z",
    updatedAt: "2025-12-25T16:00:00Z",
    notes: ["Calibration within spec"],
    workflowSteps: [
      { id: "1", name: "Initial Reading", type: "number", required: true, completed: true, value: 45678 },
      { id: "2", name: "Calibration Check", type: "checkbox", required: true, completed: true, value: true },
      { id: "3", name: "Final Reading", type: "number", required: true, completed: true, value: 45679 },
    ],
    currentStep: 3,
  },
  {
    id: "WO-005",
    title: "Backflow Prevention Test - 555 Commerce Blvd",
    description: "Annual backflow preventer testing for commercial property.",
    status: "on_hold",
    priority: "medium",
    assignedTo: "Maria Garcia",
    location: "555 Commerce Boulevard, Springfield",
    dueDate: "2025-12-29",
    createdAt: "2025-12-21T13:00:00Z",
    updatedAt: "2025-12-24T10:00:00Z",
    notes: ["Waiting for property manager access"],
    workflowSteps: [
      { id: "1", name: "Device Location", type: "text", required: true, completed: false },
      { id: "2", name: "Test Results", type: "select", required: true, options: ["Pass", "Fail", "Needs Repair"], completed: false },
      { id: "3", name: "Test Report Photo", type: "photo", required: true, completed: false },
    ],
    currentStep: 0,
  },
];

export function WorkOrderProvider({ children }: { children: ReactNode }) {
  const [workOrders, setWorkOrdersState] = useState<WorkOrder[]>([]);
  const [columns, setColumnsState] = useState<ColumnConfig[]>(defaultColumns);
  const [filters, setFiltersState] = useState<FilterConfig>(defaultFilters);
  const [sort, setSortState] = useState<SortConfig>(defaultSort);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredData();
  }, []);

  const loadStoredData = async () => {
    try {
      const [storedOrders, storedColumns, storedSort] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.WORK_ORDERS),
        AsyncStorage.getItem(STORAGE_KEYS.COLUMNS),
        AsyncStorage.getItem(STORAGE_KEYS.SORT),
      ]);

      if (storedOrders) {
        setWorkOrdersState(JSON.parse(storedOrders));
      } else {
        setWorkOrdersState(mockWorkOrders);
        await AsyncStorage.setItem(STORAGE_KEYS.WORK_ORDERS, JSON.stringify(mockWorkOrders));
      }

      if (storedColumns) {
        setColumnsState(JSON.parse(storedColumns));
      }

      if (storedSort) {
        setSortState(JSON.parse(storedSort));
      }
    } catch (error) {
      console.error("Failed to load work order data:", error);
      setWorkOrdersState(mockWorkOrders);
    } finally {
      setIsLoading(false);
    }
  };

  const setWorkOrders = useCallback((orders: WorkOrder[]) => {
    setWorkOrdersState(orders);
    AsyncStorage.setItem(STORAGE_KEYS.WORK_ORDERS, JSON.stringify(orders));
  }, []);

  const updateWorkOrder = useCallback((id: string, updates: Partial<WorkOrder>) => {
    setWorkOrdersState(prev => {
      const updated = prev.map(wo =>
        wo.id === id ? { ...wo, ...updates, updatedAt: new Date().toISOString() } : wo
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
      filtered = filtered.filter(
        wo =>
          wo.id.toLowerCase().includes(query) ||
          wo.title.toLowerCase().includes(query) ||
          wo.description.toLowerCase().includes(query) ||
          wo.location.toLowerCase().includes(query)
      );
    }

    if (filters.status.length > 0) {
      filtered = filtered.filter(wo => filters.status.includes(wo.status));
    }

    if (filters.priority.length > 0) {
      filtered = filtered.filter(wo => filters.priority.includes(wo.priority));
    }

    if (filters.assignedTo) {
      filtered = filtered.filter(wo =>
        wo.assignedTo.toLowerCase().includes(filters.assignedTo.toLowerCase())
      );
    }

    filtered.sort((a, b) => {
      const aValue = a[sort.field as keyof WorkOrder];
      const bValue = b[sort.field as keyof WorkOrder];

      if (aValue === undefined || bValue === undefined) return 0;

      let comparison = 0;
      if (typeof aValue === "string" && typeof bValue === "string") {
        comparison = aValue.localeCompare(bValue);
      } else if (aValue < bValue) {
        comparison = -1;
      } else if (aValue > bValue) {
        comparison = 1;
      }

      return sort.direction === "desc" ? -comparison : comparison;
    });

    return filtered;
  }, [workOrders, filters, sort]);

  const refreshWorkOrders = useCallback(async () => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsLoading(false);
  }, []);

  return (
    <WorkOrderContext.Provider
      value={{
        workOrders,
        columns,
        filters,
        sort,
        isLoading,
        setWorkOrders,
        updateWorkOrder,
        setColumns,
        setFilters,
        setSort,
        getFilteredWorkOrders,
        refreshWorkOrders,
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
