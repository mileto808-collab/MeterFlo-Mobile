import AsyncStorage from "@react-native-async-storage/async-storage";
import { WorkOrder } from "@/contexts/WorkOrderContext";

export type ReminderType = "1hour" | "30min" | "15min" | "missed";

export interface ScheduledReminder {
  workOrderId: number;
  customerWoId: string;
  serviceAddress: string;
  scheduledDate: string;
  reminderType: ReminderType;
  triggerTime: number;
}

interface ShownReminder {
  workOrderId: number;
  reminderType: ReminderType;
  shownAt: number;
}

const SHOWN_REMINDERS_KEY = "@appointment_reminders_shown";

const REMINDER_INTERVALS: { type: ReminderType; minutesBefore: number }[] = [
  { type: "1hour", minutesBefore: 60 },
  { type: "30min", minutesBefore: 30 },
  { type: "15min", minutesBefore: 15 },
];

export class AppointmentReminderService {
  private shownReminders: ShownReminder[] = [];
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private pendingReminders: ScheduledReminder[] = [];
  private onReminderCallback: ((reminder: ScheduledReminder) => void) | null = null;

  async initialize(): Promise<void> {
    await this.loadShownReminders();
  }

  private async loadShownReminders(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(SHOWN_REMINDERS_KEY);
      if (stored) {
        this.shownReminders = JSON.parse(stored);
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        this.shownReminders = this.shownReminders.filter(r => r.shownAt > oneDayAgo);
        await this.saveShownReminders();
      }
    } catch (error) {
      console.error("[AppointmentReminder] Failed to load shown reminders:", error);
      this.shownReminders = [];
    }
  }

  private async saveShownReminders(): Promise<void> {
    try {
      await AsyncStorage.setItem(SHOWN_REMINDERS_KEY, JSON.stringify(this.shownReminders));
    } catch (error) {
      console.error("[AppointmentReminder] Failed to save shown reminders:", error);
    }
  }

  private hasBeenShown(workOrderId: number, reminderType: ReminderType): boolean {
    return this.shownReminders.some(
      r => r.workOrderId === workOrderId && r.reminderType === reminderType
    );
  }

  async markAsShown(workOrderId: number, reminderType: ReminderType): Promise<void> {
    if (!this.hasBeenShown(workOrderId, reminderType)) {
      this.shownReminders.push({
        workOrderId,
        reminderType,
        shownAt: Date.now(),
      });
      await this.saveShownReminders();
    }
  }

  setReminderCallback(callback: (reminder: ScheduledReminder) => void): void {
    this.onReminderCallback = callback;
  }

  scheduleReminders(workOrders: WorkOrder[]): void {
    this.pendingReminders = [];
    const now = Date.now();

    for (const wo of workOrders) {
      if (!wo.scheduledDate) continue;
      
      const status = wo.status?.toLowerCase();
      if (status === "completed" || status === "closed") continue;

      const scheduledTime = new Date(wo.scheduledDate).getTime();
      if (isNaN(scheduledTime)) continue;

      if (scheduledTime < now) {
        if (!this.hasBeenShown(wo.id, "missed")) {
          this.pendingReminders.push({
            workOrderId: wo.id,
            customerWoId: wo.customerWoId || String(wo.id),
            serviceAddress: wo.serviceAddress,
            scheduledDate: wo.scheduledDate,
            reminderType: "missed",
            triggerTime: now,
          });
        }
        continue;
      }

      for (const interval of REMINDER_INTERVALS) {
        const triggerTime = scheduledTime - interval.minutesBefore * 60 * 1000;
        
        if (triggerTime > now && !this.hasBeenShown(wo.id, interval.type)) {
          this.pendingReminders.push({
            workOrderId: wo.id,
            customerWoId: wo.customerWoId || String(wo.id),
            serviceAddress: wo.serviceAddress,
            scheduledDate: wo.scheduledDate,
            reminderType: interval.type,
            triggerTime,
          });
        }
      }
    }

    this.pendingReminders.sort((a, b) => a.triggerTime - b.triggerTime);
  }

  startChecking(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkNow();

    this.checkInterval = setInterval(() => {
      this.checkNow();
    }, 30 * 1000);
  }

  stopChecking(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  private checkNow(): void {
    const now = Date.now();
    
    const dueReminders = this.pendingReminders.filter(r => r.triggerTime <= now);
    
    if (dueReminders.length > 0 && this.onReminderCallback) {
      const highestPriority = this.getHighestPriorityReminder(dueReminders);
      if (highestPriority && !this.hasBeenShown(highestPriority.workOrderId, highestPriority.reminderType)) {
        this.onReminderCallback(highestPriority);
      }
    }

    this.pendingReminders = this.pendingReminders.filter(r => r.triggerTime > now);
  }

  private getHighestPriorityReminder(reminders: ScheduledReminder[]): ScheduledReminder | null {
    const priorityOrder: ReminderType[] = ["missed", "15min", "30min", "1hour"];
    
    for (const type of priorityOrder) {
      const found = reminders.find(r => r.reminderType === type);
      if (found) return found;
    }
    
    return reminders[0] || null;
  }

  checkForMissedAppointments(workOrders: WorkOrder[]): ScheduledReminder | null {
    const now = Date.now();

    for (const wo of workOrders) {
      if (!wo.scheduledDate) continue;
      
      const status = wo.status?.toLowerCase();
      if (status === "completed" || status === "closed") continue;

      const scheduledTime = new Date(wo.scheduledDate).getTime();
      if (isNaN(scheduledTime)) continue;

      if (scheduledTime < now && !this.hasBeenShown(wo.id, "missed")) {
        return {
          workOrderId: wo.id,
          customerWoId: wo.customerWoId || String(wo.id),
          serviceAddress: wo.serviceAddress,
          scheduledDate: wo.scheduledDate,
          reminderType: "missed",
          triggerTime: now,
        };
      }
    }

    return null;
  }

  async clearAllReminders(): Promise<void> {
    this.shownReminders = [];
    this.pendingReminders = [];
    await AsyncStorage.removeItem(SHOWN_REMINDERS_KEY);
  }
}

export const appointmentReminderService = new AppointmentReminderService();
