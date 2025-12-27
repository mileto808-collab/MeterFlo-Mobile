import React, { useState } from "react";
import { View, ScrollView, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { useWorkOrders, SortConfig } from "@/contexts/WorkOrderContext";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius } from "@/constants/theme";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const SORT_FIELDS = [
  { value: "dueDate", label: "Due Date", icon: "calendar" as const },
  { value: "priority", label: "Priority", icon: "alert-circle" as const },
  { value: "status", label: "Status", icon: "check-circle" as const },
  { value: "title", label: "Title", icon: "file-text" as const },
  { value: "createdAt", label: "Created Date", icon: "clock" as const },
  { value: "updatedAt", label: "Last Updated", icon: "refresh-cw" as const },
];

export default function SortScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { sort, setSort } = useWorkOrders();

  const [localSort, setLocalSort] = useState<SortConfig>(sort);

  const handleApply = () => {
    setSort(localSort);
    navigation.goBack();
  };

  const toggleDirection = () => {
    setLocalSort(prev => ({
      ...prev,
      direction: prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        style={{ marginTop: headerHeight }}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Spacing["5xl"] + 60 },
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
      >
        <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText type="h4" style={styles.sectionTitle}>Sort By</ThemedText>
          <View style={styles.optionsList}>
            {SORT_FIELDS.map(field => {
              const isSelected = localSort.field === field.value;
              return (
                <Pressable
                  key={field.value}
                  onPress={() => setLocalSort(prev => ({ ...prev, field: field.value }))}
                  style={({ pressed }) => [
                    styles.optionRow,
                    {
                      backgroundColor: isSelected ? theme.primary + "15" : "transparent",
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <View style={styles.optionContent}>
                    <Feather
                      name={field.icon}
                      size={20}
                      color={isSelected ? theme.primary : theme.textSecondary}
                    />
                    <ThemedText
                      type="body"
                      style={{ color: isSelected ? theme.primary : theme.text }}
                    >
                      {field.label}
                    </ThemedText>
                  </View>
                  {isSelected ? (
                    <Feather name="check" size={20} color={theme.primary} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText type="h4" style={styles.sectionTitle}>Direction</ThemedText>
          <Pressable
            onPress={toggleDirection}
            style={({ pressed }) => [
              styles.directionButton,
              {
                backgroundColor: theme.backgroundSecondary,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Feather
              name={localSort.direction === "asc" ? "arrow-up" : "arrow-down"}
              size={20}
              color={theme.primary}
            />
            <ThemedText type="body">
              {localSort.direction === "asc" ? "Ascending" : "Descending"}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {localSort.direction === "asc" ? "(A-Z, Oldest first)" : "(Z-A, Newest first)"}
            </ThemedText>
          </Pressable>
        </View>
      </ScrollView>

      <View style={[
        styles.bottomAction,
        { 
          backgroundColor: theme.backgroundRoot,
          paddingBottom: insets.bottom + Spacing.lg,
        }
      ]}>
        <Button
          onPress={handleApply}
          style={{ backgroundColor: theme.primary }}
        >
          Apply Sort
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  section: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  sectionTitle: {},
  optionsList: {
    gap: Spacing.xs,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  optionContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  directionButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
    gap: Spacing.md,
  },
  bottomAction: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
});
