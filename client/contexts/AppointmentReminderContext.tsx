import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useWorkOrders, WorkOrder } from "./WorkOrderContext";
import { useAuth } from "./AuthContext";

export type ReminderType = "1hour" | "30min" | "15min" | "missed";

export interface AppointmentReminder {
  workOrder: WorkOrder;
  reminderType: ReminderType;
  scheduledDate: Date;
}

const SHOWN_REMINDERS_KEY = "@meterflo_shown_reminders";
const CHECK_INTERVAL_MS = 60000;

interface AppointmentReminderContextType {
  currentReminder: AppointmentReminder | null;
  dismissReminder: () => void;
  clearShownReminders: () => Promise<void>;
}

const AppointmentReminderContext = createContext<AppointmentReminderContextType | undefined>(undefined);

export function useAppointmentReminders() {
  const context = useContext(AppointmentReminderContext);
  if (!context) {
    throw new Error("useAppointmentReminders must be used within AppointmentReminderProvider");
  }
  return context;
}

interface ShownReminder {
  workOrderId: number;
  reminderType: ReminderType;
  shownAt: string;
}

function getReminderKey(workOrderId: number, reminderType: ReminderType): string {
  return `${workOrderId}_${reminderType}`;
}

export function AppointmentReminderProvider({ children }: { children: React.ReactNode }) {
  const { workOrders } = useWorkOrders();
  const { user, projectId } = useAuth();
  const [currentReminder, setCurrentReminder] = useState<AppointmentReminder | null>(null);
  const [shownReminders, setShownReminders] = useState<Map<string, ShownReminder>>(new Map());
  const [initialized, setInitialized] = useState(false);
  const reminderQueueRef = useRef<AppointmentReminder[]>([]);
  const previousSessionRef = useRef<{ userId: string | null; projectId: number | null }>({ userId: null, projectId: null });

  useEffect(() => {
    loadShownReminders();
  }, []);

  useEffect(() => {
    const currentUserId = user?.id || null;
    const currentProjectId = projectId || null;
    const prev = previousSessionRef.current;

    if (!initialized) {
      previousSessionRef.current = { userId: currentUserId, projectId: currentProjectId };
      return;
    }

    const userChanged = prev.userId !== null && prev.userId !== currentUserId;
    const projectChanged = prev.projectId !== null && prev.projectId !== currentProjectId;

    if (userChanged || projectChanged) {
      console.log("[AppointmentReminder] Session changed, clearing shown reminders");
      clearShownReminders();
      setCurrentReminder(null);
      reminderQueueRef.current = [];
    }

    previousSessionRef.current = { userId: currentUserId, projectId: currentProjectId };
  }, [user?.id, projectId, initialized]);

  const loadShownReminders = async () => {
    try {
      const stored = await AsyncStorage.getItem(SHOWN_REMINDERS_KEY);
      if (stored) {
        const parsed: ShownReminder[] = JSON.parse(stored);
        const map = new Map<string, ShownReminder>();
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        parsed.forEach((reminder) => {
          const shownDate = new Date(reminder.shownAt);
          if (shownDate > oneDayAgo) {
            map.set(getReminderKey(reminder.workOrderId, reminder.reminderType), reminder);
          }
        });
        setShownReminders(map);
      }
    } catch (error) {
      console.error("[AppointmentReminder] Failed to load shown reminders:", error);
    } finally {
      setInitialized(true);
    }
  };

  const saveShownReminders = async (reminders: Map<string, ShownReminder>) => {
    try {
      const array = Array.from(reminders.values());
      await AsyncStorage.setItem(SHOWN_REMINDERS_KEY, JSON.stringify(array));
    } catch (error) {
      console.error("[AppointmentReminder] Failed to save shown reminders:", error);
    }
  };

  const markReminderShown = useCallback(async (workOrderId: number, reminderType: ReminderType) => {
    const key = getReminderKey(workOrderId, reminderType);
    const newReminder: ShownReminder = {
      workOrderId,
      reminderType,
      shownAt: new Date().toISOString(),
    };
    setShownReminders((prev) => {
      const updated = new Map(prev);
      updated.set(key, newReminder);
      saveShownReminders(updated);
      return updated;
    });
  }, []);

  const hasBeenShown = useCallback((workOrderId: number, reminderType: ReminderType): boolean => {
    return shownReminders.has(getReminderKey(workOrderId, reminderType));
  }, [shownReminders]);

  const checkForReminders = useCallback(() => {
    if (!initialized || workOrders.length === 0) return;

    const now = new Date();
    const pendingReminders: AppointmentReminder[] = [];

    workOrders.forEach((wo) => {
      if (!wo.scheduledDate) return;
      
      const status = wo.status?.toLowerCase();
      if (status === "completed" || status === "closed") return;

      const scheduledDate = new Date(wo.scheduledDate);
      if (isNaN(scheduledDate.getTime())) return;

      const diffMs = scheduledDate.getTime() - now.getTime();
      const diffMinutes = diffMs / (1000 * 60);

      let reminderType: ReminderType | null = null;

      if (diffMs < 0) {
        reminderType = "missed";
      } else if (diffMinutes <= 15) {
        reminderType = "15min";
      } else if (diffMinutes <= 30) {
        reminderType = "30min";
      } else if (diffMinutes <= 60) {
        reminderType = "1hour";
      }

      if (reminderType && !hasBeenShown(wo.id, reminderType)) {
        pendingReminders.push({
          workOrder: wo,
          reminderType,
          scheduledDate,
        });
      }
    });

    pendingReminders.sort((a, b) => {
      const priority: Record<ReminderType, number> = { missed: 0, "15min": 1, "30min": 2, "1hour": 3 };
      return priority[a.reminderType as ReminderType] - priority[b.reminderType as ReminderType];
    });

    reminderQueueRef.current = pendingReminders;

    if (!currentReminder && pendingReminders.length > 0) {
      const next = pendingReminders[0];
      setCurrentReminder(next);
      markReminderShown(next.workOrder.id, next.reminderType);
    }
  }, [initialized, workOrders, hasBeenShown, currentReminder, markReminderShown]);

  useEffect(() => {
    if (!initialized) return;

    checkForReminders();

    const interval = setInterval(checkForReminders, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [initialized, checkForReminders]);

  const dismissReminder = useCallback(() => {
    setCurrentReminder(null);
    setTimeout(() => {
      const queue = reminderQueueRef.current;
      if (queue.length > 1) {
        queue.shift();
        const next = queue[0];
        if (next && !shownReminders.has(getReminderKey(next.workOrder.id, next.reminderType))) {
          setCurrentReminder(next);
          markReminderShown(next.workOrder.id, next.reminderType);
        }
      }
    }, 300);
  }, [shownReminders, markReminderShown]);

  const clearShownReminders = useCallback(async () => {
    setShownReminders(new Map());
    await AsyncStorage.removeItem(SHOWN_REMINDERS_KEY);
  }, []);

  return (
    <AppointmentReminderContext.Provider
      value={{
        currentReminder,
        dismissReminder,
        clearShownReminders,
      }}
    >
      {children}
    </AppointmentReminderContext.Provider>
  );
}
