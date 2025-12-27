import React, { useState, useEffect } from "react";
import { View, ScrollView, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HeaderButton } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { useWorkOrders, FilterConfig } from "@/contexts/WorkOrderContext";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius, StatusColors } from "@/constants/theme";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending", color: StatusColors.pending },
  { value: "in_progress", label: "In Progress", color: StatusColors.inProgress },
  { value: "completed", label: "Completed", color: StatusColors.completed },
  { value: "on_hold", label: "On Hold", color: StatusColors.onHold },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low", color: "#6B7280" },
  { value: "medium", label: "Medium", color: "#F59E0B" },
  { value: "high", label: "High", color: "#EF4444" },
  { value: "urgent", label: "Urgent", color: "#DC2626" },
];

export default function FilterScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { filters, setFilters } = useWorkOrders();

  const [localFilters, setLocalFilters] = useState<FilterConfig>(filters);

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <HeaderButton onPress={() => navigation.goBack()}>
          <ThemedText>Cancel</ThemedText>
        </HeaderButton>
      ),
      headerRight: () => (
        <HeaderButton onPress={handleReset}>
          <ThemedText style={{ color: theme.error }}>Reset</ThemedText>
        </HeaderButton>
      ),
    });
  }, [navigation, theme]);

  const handleReset = () => {
    setLocalFilters({
      status: [],
      priority: [],
      assignedTo: "",
      searchQuery: filters.searchQuery,
      dateRange: { start: null, end: null },
    });
  };

  const handleApply = () => {
    setFilters(localFilters);
    navigation.goBack();
  };

  const toggleStatus = (status: string) => {
    setLocalFilters(prev => ({
      ...prev,
      status: prev.status.includes(status)
        ? prev.status.filter(s => s !== status)
        : [...prev.status, status],
    }));
  };

  const togglePriority = (priority: string) => {
    setLocalFilters(prev => ({
      ...prev,
      priority: prev.priority.includes(priority)
        ? prev.priority.filter(p => p !== priority)
        : [...prev.priority, priority],
    }));
  };

  const activeCount = localFilters.status.length + localFilters.priority.length + (localFilters.assignedTo ? 1 : 0);

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Spacing["5xl"] + 60 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText type="h4" style={styles.sectionTitle}>Status</ThemedText>
          <View style={styles.optionsGrid}>
            {STATUS_OPTIONS.map(option => {
              const isSelected = localFilters.status.includes(option.value);
              return (
                <Pressable
                  key={option.value}
                  onPress={() => toggleStatus(option.value)}
                  style={({ pressed }) => [
                    styles.optionChip,
                    {
                      backgroundColor: isSelected ? option.color : theme.backgroundSecondary,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <ThemedText
                    type="small"
                    style={{ color: isSelected ? "#FFFFFF" : theme.text }}
                  >
                    {option.label}
                  </ThemedText>
                  {isSelected ? (
                    <Feather name="check" size={14} color="#FFFFFF" />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText type="h4" style={styles.sectionTitle}>Priority</ThemedText>
          <View style={styles.optionsGrid}>
            {PRIORITY_OPTIONS.map(option => {
              const isSelected = localFilters.priority.includes(option.value);
              return (
                <Pressable
                  key={option.value}
                  onPress={() => togglePriority(option.value)}
                  style={({ pressed }) => [
                    styles.optionChip,
                    {
                      backgroundColor: isSelected ? option.color : theme.backgroundSecondary,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <ThemedText
                    type="small"
                    style={{ color: isSelected ? "#FFFFFF" : theme.text }}
                  >
                    {option.label}
                  </ThemedText>
                  {isSelected ? (
                    <Feather name="check" size={14} color="#FFFFFF" />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        {activeCount > 0 ? (
          <View style={styles.activeFiltersInfo}>
            <Feather name="filter" size={16} color={theme.primary} />
            <ThemedText type="small" style={{ color: theme.primary }}>
              {activeCount} filter{activeCount !== 1 ? "s" : ""} active
            </ThemedText>
          </View>
        ) : null}
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
          Apply Filters
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
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  optionChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  activeFiltersInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
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
