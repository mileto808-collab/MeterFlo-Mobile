import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useWorkOrders } from "@/contexts/WorkOrderContext";
import { useAuth } from "@/contexts/AuthContext";
import { AppointmentReminderModal, ReminderType } from "@/components/AppointmentReminderModal";
import { appointmentReminderService, ScheduledReminder } from "@/services/appointmentReminderService";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface CurrentReminder {
  workOrderId: number;
  customerWoId: string;
  serviceAddress: string;
  scheduledDate: string;
  reminderType: ReminderType;
}

export function AppointmentReminderManager() {
  const { workOrders } = useWorkOrders();
  const { isAuthenticated } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  
  const [currentReminder, setCurrentReminder] = useState<CurrentReminder | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isServiceReady, setIsServiceReady] = useState(false);
  const initializingRef = useRef(false);

  const handleReminderTriggered = useCallback((reminder: ScheduledReminder) => {
    setCurrentReminder({
      workOrderId: reminder.workOrderId,
      customerWoId: reminder.customerWoId,
      serviceAddress: reminder.serviceAddress,
      scheduledDate: reminder.scheduledDate,
      reminderType: reminder.reminderType,
    });
    setIsVisible(true);
  }, []);

  const handleDismiss = useCallback(async () => {
    if (currentReminder) {
      await appointmentReminderService.markAsShown(
        currentReminder.workOrderId,
        currentReminder.reminderType
      );
    }
    setIsVisible(false);
    setCurrentReminder(null);
  }, [currentReminder]);

  const handleViewWorkOrder = useCallback(async () => {
    if (currentReminder) {
      await appointmentReminderService.markAsShown(
        currentReminder.workOrderId,
        currentReminder.reminderType
      );
      
      const workOrder = workOrders.find(wo => wo.id === currentReminder.workOrderId);
      if (workOrder) {
        setIsVisible(false);
        setCurrentReminder(null);
        navigation.navigate("WorkOrderDetail", { workOrder });
      } else {
        setIsVisible(false);
        setCurrentReminder(null);
      }
    }
  }, [currentReminder, workOrders, navigation]);

  useEffect(() => {
    if (isAuthenticated && !initializingRef.current) {
      initializingRef.current = true;
      setIsServiceReady(false);
      
      (async () => {
        await appointmentReminderService.initialize();
        appointmentReminderService.setReminderCallback(handleReminderTriggered);
        setIsServiceReady(true);
      })();
    }
    
    if (!isAuthenticated) {
      initializingRef.current = false;
      setIsServiceReady(false);
    }
    
    return () => {
      appointmentReminderService.stopChecking();
    };
  }, [isAuthenticated, handleReminderTriggered]);

  useEffect(() => {
    if (isAuthenticated && isServiceReady && workOrders.length > 0) {
      appointmentReminderService.scheduleReminders(workOrders);
      appointmentReminderService.startChecking();
      
      const missedReminder = appointmentReminderService.checkForMissedAppointments(workOrders);
      if (missedReminder && !isVisible) {
        handleReminderTriggered(missedReminder);
      }
    }
  }, [isAuthenticated, isServiceReady, workOrders, handleReminderTriggered, isVisible]);

  if (!currentReminder) {
    return null;
  }

  return (
    <AppointmentReminderModal
      visible={isVisible}
      reminderType={currentReminder.reminderType}
      workOrderId={String(currentReminder.workOrderId)}
      customerWoId={currentReminder.customerWoId}
      serviceAddress={currentReminder.serviceAddress}
      scheduledDate={currentReminder.scheduledDate}
      onDismiss={handleDismiss}
      onViewWorkOrder={handleViewWorkOrder}
    />
  );
}
