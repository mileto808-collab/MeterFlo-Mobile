import React from "react";
import { AppointmentReminderModal } from "./AppointmentReminderModal";
import { useAppointmentReminders } from "@/contexts/AppointmentReminderContext";
import { WorkOrder } from "@/contexts/WorkOrderContext";
import { navigate } from "@/lib/navigationRef";

export function AppointmentReminderManager() {
  const { currentReminder, dismissReminder } = useAppointmentReminders();

  const handleViewWorkOrder = (workOrder: WorkOrder) => {
    navigate("WorkOrderDetail", { workOrder });
  };

  return (
    <AppointmentReminderModal
      visible={currentReminder !== null}
      reminder={currentReminder}
      onDismiss={dismissReminder}
      onViewWorkOrder={handleViewWorkOrder}
    />
  );
}
