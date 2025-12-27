import React, { useCallback, useMemo } from "react";
import { View, FlatList, StyleSheet, Pressable, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { useWorkOrders, WorkOrder } from "@/contexts/WorkOrderContext";
import { useOffline } from "@/contexts/OfflineContext";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { ThemedText } from "@/components/ThemedText";
import { SearchBar } from "@/components/SearchBar";
import { WorkOrderCard } from "@/components/WorkOrderCard";
import { OfflineBanner } from "@/components/OfflineBanner";
import { Spacing, BorderRadius } from "@/constants/theme";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function WorkOrdersScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { filters, setFilters, getFilteredWorkOrders, isLoading, refreshWorkOrders } = useWorkOrders();
  const { isOnline } = useOffline();

  const filteredWorkOrders = useMemo(() => getFilteredWorkOrders(), [getFilteredWorkOrders]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.status.length > 0) count++;
    if (filters.priority.length > 0) count++;
    if (filters.assignedTo) count++;
    return count;
  }, [filters]);

  const handleSearchChange = useCallback((text: string) => {
    setFilters({ ...filters, searchQuery: text });
  }, [filters, setFilters]);

  const handleWorkOrderPress = useCallback((workOrder: WorkOrder) => {
    navigation.navigate("WorkOrderDetail", { workOrder });
  }, [navigation]);

  const renderItem = useCallback(({ item }: { item: WorkOrder }) => (
    <WorkOrderCard workOrder={item} onPress={() => handleWorkOrderPress(item)} />
  ), [handleWorkOrderPress]);

  const keyExtractor = useCallback((item: WorkOrder) => item.id, []);

  const ListEmptyComponent = useMemo(() => (
    <View style={styles.emptyContainer}>
      <Feather name="inbox" size={48} color={theme.textSecondary} />
      <ThemedText type="body" style={[styles.emptyText, { color: theme.textSecondary }]}>
        No work orders found
      </ThemedText>
      <ThemedText type="small" style={[styles.emptySubtext, { color: theme.textSecondary }]}>
        {filters.searchQuery || activeFilterCount > 0
          ? "Try adjusting your search or filters"
          : "Pull down to refresh"}
      </ThemedText>
    </View>
  ), [theme, filters.searchQuery, activeFilterCount]);

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {!isOnline ? <OfflineBanner style={{ marginTop: headerHeight }} /> : null}
      
      <View style={[styles.searchContainer, { paddingTop: isOnline ? headerHeight + Spacing.md : Spacing.md }]}>
        <SearchBar
          value={filters.searchQuery}
          onChangeText={handleSearchChange}
          placeholder="Search work orders..."
        />
        <View style={styles.actionButtons}>
          <Pressable
            onPress={() => navigation.navigate("Filter")}
            style={({ pressed }) => [
              styles.iconButton,
              { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Feather name="filter" size={20} color={theme.text} />
            {activeFilterCount > 0 ? (
              <View style={[styles.filterBadge, { backgroundColor: theme.primary }]}>
                <ThemedText style={styles.filterBadgeText}>{activeFilterCount}</ThemedText>
              </View>
            ) : null}
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate("Sort")}
            style={({ pressed }) => [
              styles.iconButton,
              { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Feather name="bar-chart-2" size={20} color={theme.text} style={{ transform: [{ rotate: "-90deg" }] }} />
          </Pressable>
        </View>
      </View>

      <FlatList
        data={filteredWorkOrders}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: tabBarHeight + Spacing.xl },
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refreshWorkOrders}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
        ListEmptyComponent={ListEmptyComponent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  actionButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  filterBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  filterBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.md,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: Spacing["5xl"],
  },
  emptyText: {
    marginTop: Spacing.lg,
  },
  emptySubtext: {
    marginTop: Spacing.sm,
    textAlign: "center",
  },
});
