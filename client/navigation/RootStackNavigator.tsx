import React from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import MainTabNavigator from "@/navigation/MainTabNavigator";
import LoginScreen from "@/screens/LoginScreen";
import ProjectSelectScreen from "@/screens/ProjectSelectScreen";
import WorkOrderDetailScreen from "@/screens/WorkOrderDetailScreen";
import WorkflowWizardScreen from "@/screens/WorkflowWizardScreen";
import NewWorkOrderWizardScreen from "@/screens/NewWorkOrderWizardScreen";
import FilterScreen from "@/screens/FilterScreen";
import FilesScreen from "@/screens/FilesScreen";
import TapToCaptureScanScreen from "@/screens/TapToCaptureScanScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { WorkOrder } from "@/contexts/WorkOrderContext";

export type RootStackParamList = {
  Login: undefined;
  ProjectSelect: undefined;
  Main: undefined;
  WorkOrderDetail: { workOrder: WorkOrder };
  WorkflowWizard: { workOrder: WorkOrder };
  NewWorkOrderWizard: undefined;
  Filter: undefined;
  Files: undefined;
  TapToCaptureScan: { scanType: "barcode" | "qrcode" };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const { isAuthenticated, isLoading, needsProjectSelection } = useAuth();
  const { theme } = useTheme();
  const screenOptions = useScreenOptions();

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      {!isAuthenticated && !needsProjectSelection ? (
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
      ) : needsProjectSelection ? (
        <Stack.Screen
          name="ProjectSelect"
          component={ProjectSelectScreen}
          options={{ headerShown: false }}
        />
      ) : (
        <>
          <Stack.Screen
            name="Main"
            component={MainTabNavigator}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="ProjectSelect"
            component={ProjectSelectScreen}
            options={{ 
              headerShown: false,
              presentation: "modal",
            }}
          />
          <Stack.Screen
            name="WorkOrderDetail"
            component={WorkOrderDetailScreen}
            options={{
              headerTitle: "Work Order",
              presentation: "card",
            }}
          />
          <Stack.Screen
            name="WorkflowWizard"
            component={WorkflowWizardScreen}
            options={{
              headerTitle: "Process Work Order",
              presentation: "modal",
            }}
          />
          <Stack.Screen
            name="NewWorkOrderWizard"
            component={NewWorkOrderWizardScreen}
            options={{
              headerTitle: "New Work Order",
              presentation: "modal",
            }}
          />
          <Stack.Screen
            name="Filter"
            component={FilterScreen}
            options={{
              headerTitle: "Filters",
              presentation: "modal",
            }}
          />
          <Stack.Screen
            name="Files"
            component={FilesScreen}
            options={{
              headerTitle: "Files",
              presentation: "modal",
            }}
          />
          <Stack.Screen
            name="TapToCaptureScan"
            component={TapToCaptureScanScreen}
            options={{
              headerShown: false,
              presentation: "fullScreenModal",
            }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
