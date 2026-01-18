import React, { useState } from "react";
import { View, ScrollView, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useHeaderHeight } from "@react-navigation/elements";
import { Icon } from "@/components/Icons";

import { useTheme } from "@/hooks/useTheme";
import { useWorkOrders, SortConfig, SortCriterion } from "@/contexts/WorkOrderContext";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius } from "@/constants/theme";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const SORT_FIELDS = [
  { value: "status", label: "Status", icon: "check-circle" as const },
  { value: "serviceAddress", label: "Address", icon: "map-pin" as const },
  { value: "route", label: "Route", icon: "navigation" as const },
  { value: "zone", label: "Zone", icon: "grid" as const },
];

export default function SortScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { sort, setSort } = useWorkOrders();

  const [localSort, setLocalSort] = useState<SortConfig>(Array.isArray(sort) ? [...sort] : []);

  const handleApply = () => {
    setSort(localSort);
    navigation.goBack();
  };

  const handleClear = () => {
    setLocalSort([]);
  };

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

  const availableFields = SORT_FIELDS.filter(f => !localSort.some(s => s.field === f.value));

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
        {localSort.length > 0 ? (
          <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.sectionHeader}>
              <ThemedText type="h4">Sort Order</ThemedText>
              <Pressable onPress={handleClear} hitSlop={8}>
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

        {availableFields.length > 0 ? (
          <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText type="h4" style={styles.sectionTitle}>
              {localSort.length > 0 ? "Add Another Sort" : "Sort By"}
            </ThemedText>
            <View style={styles.optionsList}>
              {availableFields.map(field => (
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

        {localSort.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: theme.backgroundDefault }]}>
            <Icon name="sliders" size={48} color={theme.textSecondary} />
            <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center" }}>
              No sort criteria selected. Tap an option above to add sorting.
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
          {localSort.length > 0 ? `Apply Sort (${localSort.length})` : "Clear Sort"}
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
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {},
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
  emptyState: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
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
