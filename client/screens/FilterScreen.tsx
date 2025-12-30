import React, { useState } from "react";
import { View, ScrollView, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useHeaderHeight } from "@react-navigation/elements";
import { Icon } from "@/components/Icons";

import { useTheme } from "@/hooks/useTheme";
import { useWorkOrders, FilterConfig } from "@/contexts/WorkOrderContext";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius } from "@/constants/theme";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const DEFAULT_STATUS_OPTIONS = [
  { value: "Open", label: "Open", color: "#3B82F6" },
  { value: "In Progress", label: "In Progress", color: "#F59E0B" },
  { value: "Completed", label: "Completed", color: "#10B981" },
  { value: "Trouble", label: "Trouble", color: "#EF4444" },
];

export default function FilterScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { filters, setFilters, referenceData } = useWorkOrders();

  const [localFilters, setLocalFilters] = useState<FilterConfig>(filters);

  const statusOptions = (referenceData?.statuses?.filter(status => 
    status.label.toLowerCase() !== 'closed' && status.code.toLowerCase() !== 'closed'
  ).map(status => ({
    value: status.label,
    label: status.label,
    color: status.color,
  }))) || DEFAULT_STATUS_OPTIONS;

  const handleApply = () => {
    setFilters(localFilters);
    navigation.goBack();
  };

  const isStatusSelected = (status: string) => {
    return localFilters.status.some(s => s.toLowerCase() === status.toLowerCase());
  };

  const toggleStatus = (status: string) => {
    setLocalFilters(prev => ({
      ...prev,
      status: isStatusSelected(status)
        ? prev.status.filter(s => s.toLowerCase() !== status.toLowerCase())
        : [...prev.status, status],
    }));
  };

  const activeCount = localFilters.status.length + (localFilters.assignedTo ? 1 : 0);

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
          <ThemedText type="h4" style={styles.sectionTitle}>Status</ThemedText>
          <View style={styles.optionsGrid}>
            {statusOptions.map(option => {
              const isSelected = isStatusSelected(option.value);
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
                    {option.value}
                  </ThemedText>
                  {isSelected ? (
                    <Icon name="check" size={14} color="#FFFFFF" />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        {activeCount > 0 ? (
          <View style={styles.activeFiltersInfo}>
            <Icon name="filter" size={16} color={theme.primary} />
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
