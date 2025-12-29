import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View } from "react-native";
import WorkOrdersStackNavigator from "@/navigation/WorkOrdersStackNavigator";
import SyncStackNavigator from "@/navigation/SyncStackNavigator";
import AccountStackNavigator from "@/navigation/AccountStackNavigator";
import { useTheme } from "@/hooks/useTheme";
import { useOffline } from "@/contexts/OfflineContext";
import { ThemedText } from "@/components/ThemedText";
import { BorderRadius } from "@/constants/theme";

export type MainTabParamList = {
  WorkOrdersTab: undefined;
  SyncTab: undefined;
  AccountTab: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

function PendingBadge({ count }: { count: number }) {
  const { theme } = useTheme();
  
  if (count === 0) return null;
  
  return (
    <View style={[styles.badge, { backgroundColor: theme.syncPending }]}>
      <ThemedText style={styles.badgeText}>{count > 9 ? "9+" : count}</ThemedText>
    </View>
  );
}

export default function MainTabNavigator() {
  const { theme, isDark } = useTheme();
  const { pendingActions } = useOffline();

  return (
    <Tab.Navigator
      initialRouteName="WorkOrdersTab"
      screenOptions={{
        tabBarActiveTintColor: theme.tabIconSelected,
        tabBarInactiveTintColor: theme.tabIconDefault,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: Platform.select({
            ios: "transparent",
            android: theme.backgroundRoot,
          }),
          borderTopWidth: 0,
          elevation: 0,
        },
        tabBarBackground: () =>
          Platform.OS === "ios" ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : null,
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="WorkOrdersTab"
        component={WorkOrdersStackNavigator}
        options={{
          title: "Work Orders",
          tabBarIcon: ({ color, size }) => (
            <Feather name="clipboard" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="SyncTab"
        component={SyncStackNavigator}
        options={{
          title: "Sync",
          tabBarIcon: ({ color, size }) => (
            <View>
              <Feather name="rotate-ccw" size={size} color={color} />
              <PendingBadge count={pendingActions.length} />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="AccountTab"
        component={AccountStackNavigator}
        options={{
          title: "Account",
          tabBarIcon: ({ color, size }) => (
            <Feather name="settings" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: BorderRadius.full,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
});
