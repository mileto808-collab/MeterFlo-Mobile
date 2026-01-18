import React, { useState, useLayoutEffect } from "react";
import { View, ScrollView, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useHeaderHeight } from "@react-navigation/elements";
import { Icon } from "@/components/Icons";

import { useTheme } from "@/hooks/useTheme";
import { useWorkOrders, FilterConfig, SortConfig, SortCriterion } from "@/contexts/WorkOrderContext";
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

const SORT_FIELDS = [
  { value: "status", label: "Status", icon: "check-circle" as const },
  { value: "serviceAddress", label: "Address", icon: "map-pin" as const },
  { value: "route", label: "Route", icon: "navigation" as const },
  { value: "zone", label: "Zone", icon: "grid" as const },
];

export default function FilterScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { filters, setFilters, sort, setSort, referenceData } = useWorkOrders();

  const [localFilters, setLocalFilters] = useState<FilterConfig>(filters);
  const [localSort, setLocalSort] = useState<SortConfig>(Array.isArray(sort) ? [...sort] : []);
  
  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: "Filters | Sorting",
    });
  }, [navigation]);

  const statusOptions = (referenceData?.statuses?.filter(status => 
    status.label.toLowerCase() !== 'closed' && status.code.toLowerCase() !== 'closed'
  ).map(status => ({
    value: status.label,
    label: status.label,
    color: status.color,
  }))) || DEFAULT_STATUS_OPTIONS;

  const handleApply = () => {
    setFilters(localFilters);
    setSort(localSort);
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
  
  const addSortCriterion = (field: string) => {
    const isAlreadyAdded = localSort.some(s => s.field === field);
    if (!isAlreadyAdded) {
      setLocalSort([...localSort, { field, direction: "asc" }]);
    }
  };

  const removeSortCriterion = (field: string) => {
    setLocalSort(localSort.filter(s => s.field !== field));
  };

  const toggleDirection = (field: string) => {
    setLocalSort(localSort.map(s => 
      s.field === field 
        ? { ...s, direction: s.direction === "asc" ? "desc" : "asc" }
        : s
    ));
  };

  const moveCriterion = (index: number, direction: "up" | "down") => {
    const newSort = [...localSort];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newSort.length) return;
    [newSort[index], newSort[targetIndex]] = [newSort[targetIndex], newSort[index]];
    setLocalSort(newSort);
  };

  const getFieldLabel = (field: string) => {
    return SORT_FIELDS.find(f => f.value === field)?.label || field;
  };

  const getFieldIcon = (field: string) => {
    return SORT_FIELDS.find(f => f.value === field)?.icon || "hash";
  };

  const availableSortFields = SORT_FIELDS.filter(f => !localSort.some(s => s.field === f.value));

  const handleClearSort = () => {
    setLocalSort([]);
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

        {localSort.length > 0 ? (
          <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.sectionHeader}>
              <ThemedText type="h4">Sort Order</ThemedText>
              <Pressable onPress={handleClearSort} hitSlop={8}>
                <ThemedText style={{ color: theme.error }}>Clear All</ThemedText>
              </Pressable>
            </View>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Work orders are sorted by the first criterion, then by the second, and so on.
            </ThemedText>
            <View style={styles.sortList}>
              {localSort.map((criterion, index) => (
                <View
                  key={criterion.field}
                  style={[styles.sortItem, { backgroundColor: theme.backgroundSecondary }]}
                >
                  <View style={styles.sortItemLeft}>
                    <View style={[styles.orderBadge, { backgroundColor: theme.primary }]}>
                      <ThemedText style={{ color: "#fff", fontWeight: "600" }}>
                        {index + 1}
                      </ThemedText>
                    </View>
                    <Icon
                      name={getFieldIcon(criterion.field) as any}
                      size={18}
                      color={theme.text}
                    />
                    <ThemedText type="body">{getFieldLabel(criterion.field)}</ThemedText>
                  </View>
                  <View style={styles.sortItemActions}>
                    <Pressable
                      onPress={() => toggleDirection(criterion.field)}
                      style={[styles.actionButton, { backgroundColor: theme.backgroundRoot }]}
                      hitSlop={4}
                    >
                      <Icon
                        name={criterion.direction === "asc" ? "arrow-up" : "arrow-down"}
                        size={16}
                        color={theme.primary}
                      />
                    </Pressable>
                    {index > 0 ? (
                      <Pressable
                        onPress={() => moveCriterion(index, "up")}
                        style={[styles.actionButton, { backgroundColor: theme.backgroundRoot }]}
                        hitSlop={4}
                      >
                        <Icon name="chevron-up" size={16} color={theme.textSecondary} />
                      </Pressable>
                    ) : null}
                    {index < localSort.length - 1 ? (
                      <Pressable
                        onPress={() => moveCriterion(index, "down")}
                        style={[styles.actionButton, { backgroundColor: theme.backgroundRoot }]}
                        hitSlop={4}
                      >
                        <Icon name="chevron-down" size={16} color={theme.textSecondary} />
                      </Pressable>
                    ) : null}
                    <Pressable
                      onPress={() => removeSortCriterion(criterion.field)}
                      style={[styles.actionButton, { backgroundColor: theme.backgroundRoot }]}
                      hitSlop={4}
                    >
                      <Icon name="x" size={16} color={theme.error} />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {availableSortFields.length > 0 ? (
          <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText type="h4" style={styles.sectionTitle}>
              {localSort.length > 0 ? "Add Another Sort" : "Sort By"}
            </ThemedText>
            <View style={styles.optionsList}>
              {availableSortFields.map(field => (
                <Pressable
                  key={field.value}
                  onPress={() => addSortCriterion(field.value)}
                  style={({ pressed }) => [
                    styles.optionRow,
                    {
                      backgroundColor: pressed ? theme.primary + "15" : "transparent",
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <View style={styles.optionContent}>
                    <Icon
                      name={field.icon}
                      size={20}
                      color={theme.textSecondary}
                    />
                    <ThemedText type="body">{field.label}</ThemedText>
                  </View>
                  <Icon name="plus" size={20} color={theme.primary} />
                </Pressable>
              ))}
            </View>
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
          Apply
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
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sortList: {
    gap: Spacing.sm,
  },
  sortItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  sortItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  orderBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  sortItemActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  actionButton: {
    padding: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
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
});
