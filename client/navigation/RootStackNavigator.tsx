import React from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import MainTabNavigator from "@/navigation/MainTabNavigator";
import LoginScreen from "@/screens/LoginScreen";
import WorkOrderDetailScreen from "@/screens/WorkOrderDetailScreen";
import WorkflowWizardScreen from "@/screens/WorkflowWizardScreen";
import FilterScreen from "@/screens/FilterScreen";
import SortScreen from "@/screens/SortScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { WorkOrder } from "@/contexts/WorkOrderContext";

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  WorkOrderDetail: { workOrder: WorkOrder };
  WorkflowWizard: { workOrder: WorkOrder };
  Filter: undefined;
  Sort: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const { isAuthenticated, isLoading } = useAuth();
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
      {!isAuthenticated ? (
        <Stack.Screen
          name="Login"
          component={LoginScreen}
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
            name="Filter"
            component={FilterScreen}
            options={{
              headerTitle: "Filters",
              presentation: "modal",
            }}
          />
          <Stack.Screen
            name="Sort"
            component={SortScreen}
            options={{
              headerTitle: "Sort",
              presentation: "modal",
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
