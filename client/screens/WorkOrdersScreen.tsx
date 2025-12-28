import React, { useCallback, useMemo, useState } from "react";
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
import { SearchOptionsModal, SearchOption } from "@/components/SearchOptionsModal";
import { HIDScannerModal } from "@/components/HIDScannerModal";
import { ManualSearchModal } from "@/components/ManualSearchModal";
import { ScanConfirmModal } from "@/components/ScanConfirmModal";
import { Spacing, BorderRadius } from "@/constants/theme";

interface ScanResult {
  meterId: string;
  workOrder: WorkOrder | undefined;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function WorkOrdersScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { filters, setFilters, getFilteredWorkOrders, workOrders, isLoading, refreshWorkOrders, error } = useWorkOrders();
  const { isOnline } = useOffline();

  const [showSearchOptions, setShowSearchOptions] = useState(false);
  const [showHIDScanner, setShowHIDScanner] = useState(false);
  const [showManualSearch, setShowManualSearch] = useState(false);
  const [scanConfirmResult, setScanConfirmResult] = useState<ScanResult | null>(null);

  const filteredWorkOrders = useMemo(() => getFilteredWorkOrders(), [getFilteredWorkOrders]);

  const findWorkOrderByMeterId = useCallback((meterId: string): WorkOrder | undefined => {
    const normalizedMeterId = meterId.trim().toLowerCase();
    return workOrders.find(wo => {
      const oldMeterId = wo.oldMeterId?.trim().toLowerCase();
      return oldMeterId === normalizedMeterId;
    });
  }, [workOrders]);

  const handleScanResult = useCallback((scannedValue: string) => {
    const workOrder = findWorkOrderByMeterId(scannedValue);
    setScanConfirmResult({
      meterId: scannedValue,
      workOrder,
    });
  }, [findWorkOrderByMeterId]);

  const handleConfirmScan = useCallback(() => {
    if (scanConfirmResult?.workOrder) {
      setScanConfirmResult(null);
      navigation.navigate("WorkflowWizard", { workOrder: scanConfirmResult.workOrder });
    }
  }, [scanConfirmResult, navigation]);

  const handleScanAgain = useCallback(() => {
    setScanConfirmResult(null);
    setShowHIDScanner(true);
  }, []);

  const handleCloseScanConfirm = useCallback(() => {
    setScanConfirmResult(null);
  }, []);

  const handleSearchOptionSelect = useCallback((option: SearchOption) => {
    switch (option) {
      case "barcode":
        navigation.navigate("TapToCaptureScan", { scanType: "barcode" });
        break;
      case "qrcode":
        navigation.navigate("TapToCaptureScan", { scanType: "qrcode" });
        break;
      case "hid":
        setShowHIDScanner(true);
        break;
      case "manual":
        setShowManualSearch(true);
        break;
    }
  }, [navigation]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.status.length > 0) count++;
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

  const keyExtractor = useCallback((item: WorkOrder) => String(item.id), []);

  const ListEmptyComponent = useMemo(() => (
    <View style={styles.emptyContainer}>
      <Feather name="inbox" size={48} color={theme.textSecondary} />
      <ThemedText type="body" style={[styles.emptyText, { color: theme.textSecondary }]}>
        {error ? "Failed to load work orders" : "No work orders found"}
      </ThemedText>
      <ThemedText type="small" style={[styles.emptySubtext, { color: theme.textSecondary }]}>
        {error 
          ? error 
          : filters.searchQuery || activeFilterCount > 0
            ? "Try adjusting your search or filters"
            : "Pull down to refresh"}
      </ThemedText>
    </View>
  ), [theme, filters.searchQuery, activeFilterCount, error]);

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {!isOnline ? <OfflineBanner style={{ marginTop: headerHeight }} /> : null}
      
      <View style={[styles.searchContainer, { paddingTop: isOnline ? headerHeight + Spacing.md : Spacing.md }]}>
        <SearchBar
          value={filters.searchQuery}
          onChangeText={handleSearchChange}
          placeholder="Search work orders..."
          onSearchPress={() => setShowSearchOptions(true)}
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

      <View style={styles.countContainer}>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          {filteredWorkOrders.length} {filteredWorkOrders.length === 1 ? "work order" : "work orders"}
        </ThemedText>
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
            onRefresh={() => refreshWorkOrders(true, true)}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
        ListEmptyComponent={ListEmptyComponent}
        showsVerticalScrollIndicator={false}
      />

      <SearchOptionsModal
        visible={showSearchOptions}
        onClose={() => setShowSearchOptions(false)}
        onSelectOption={handleSearchOptionSelect}
      />

      <HIDScannerModal
        visible={showHIDScanner}
        onClose={() => setShowHIDScanner(false)}
        onScan={handleScanResult}
      />

      <ManualSearchModal
        visible={showManualSearch}
        value={filters.searchQuery}
        onClose={() => setShowManualSearch(false)}
        onChangeText={handleSearchChange}
      />

      <ScanConfirmModal
        visible={scanConfirmResult !== null}
        meterId={scanConfirmResult?.meterId || ""}
        workOrder={scanConfirmResult?.workOrder}
        onConfirm={handleConfirmScan}
        onScanAgain={handleScanAgain}
        onClose={handleCloseScanConfirm}
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
  countContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xs,
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
    paddingHorizontal: Spacing.xl,
  },
});
