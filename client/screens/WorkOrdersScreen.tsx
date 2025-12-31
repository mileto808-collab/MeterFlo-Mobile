import React, { useCallback, useMemo, useState } from "react";
import { View, FlatList, StyleSheet, Pressable, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

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
import { ScanConfirmModal, MatchSource } from "@/components/ScanConfirmModal";
import { Icon } from "@/components/Icons";
import { Spacing, BorderRadius } from "@/constants/theme";

interface ScanResult {
  meterId: string;
  workOrder: WorkOrder | undefined;
  matchSource: MatchSource;
  isSearching: boolean;
  searchError: string | null;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function WorkOrdersScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { filters, setFilters, getFilteredWorkOrders, workOrders, isLoading, refreshWorkOrders, error, searchWorkOrdersByMeterIdOnServer } = useWorkOrders();
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

  const handleScanResult = useCallback(async (scannedValue: string) => {
    const normalizedValue = scannedValue.trim();
    
    // First, show the modal in searching state
    setScanConfirmResult({
      meterId: normalizedValue,
      workOrder: undefined,
      matchSource: "none",
      isSearching: true,
      searchError: null,
    });
    
    // Search locally first
    const localWorkOrder = findWorkOrderByMeterId(normalizedValue);
    if (localWorkOrder) {
      setScanConfirmResult({
        meterId: normalizedValue,
        workOrder: localWorkOrder,
        matchSource: "local",
        isSearching: false,
        searchError: null,
      });
      return;
    }
    
    // No local match - search server if online
    if (isOnline) {
      try {
        const serverResults = await searchWorkOrdersByMeterIdOnServer(normalizedValue);
        const eligibleWorkOrder = serverResults.find(wo => {
          const status = wo.status?.toLowerCase();
          return status !== "completed" && status !== "closed";
        });
        
        setScanConfirmResult({
          meterId: normalizedValue,
          workOrder: eligibleWorkOrder,
          matchSource: eligibleWorkOrder ? "server" : "none",
          isSearching: false,
          searchError: null,
        });
      } catch (err) {
        setScanConfirmResult({
          meterId: normalizedValue,
          workOrder: undefined,
          matchSource: "none",
          isSearching: false,
          searchError: err instanceof Error ? err.message : "Server search failed",
        });
      }
    } else {
      // Offline and no local match
      setScanConfirmResult({
        meterId: normalizedValue,
        workOrder: undefined,
        matchSource: "none",
        isSearching: false,
        searchError: null,
      });
    }
  }, [findWorkOrderByMeterId, isOnline, searchWorkOrdersByMeterIdOnServer]);

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

  const ListEmptyComponent = useMemo(() => {
    const hasSearchOrFilters = filters.searchQuery || activeFilterCount > 0;
    
    const getSubtext = () => {
      if (error) return error;
      if (hasSearchOrFilters) {
        if (isOnline) {
          return "No matches in cached work orders. Use scan to search the server.";
        } else {
          return "No matches in cached work orders. Go online to search the server.";
        }
      }
      return "Pull down to refresh";
    };
    
    return (
      <View style={styles.emptyContainer}>
        <Icon name="inbox" size={48} color={theme.textSecondary} />
        <ThemedText type="body" style={[styles.emptyText, { color: theme.textSecondary }]}>
          {error ? "Failed to load work orders" : "No work orders found"}
        </ThemedText>
        <ThemedText type="small" style={[styles.emptySubtext, { color: theme.textSecondary }]}>
          {getSubtext()}
        </ThemedText>
      </View>
    );
  }, [theme, filters.searchQuery, activeFilterCount, error, isOnline]);

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {!isOnline ? <OfflineBanner style={{ marginTop: headerHeight }} /> : null}
      
      <View style={[styles.searchContainer, { paddingTop: isOnline ? headerHeight + Spacing.md : Spacing.md }]}>
        <SearchBar
          value={filters.searchQuery}
          onChangeText={handleSearchChange}
          placeholder="Scan Meter ID..."
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
            <Icon name="filter" size={20} color={theme.text} />
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
            <View style={{ transform: [{ rotate: "-90deg" }] }}>
              <Icon name="bar-chart-2" size={20} color={theme.text} />
            </View>
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
        onFindWorkOrder={handleScanResult}
      />

      <ScanConfirmModal
        visible={scanConfirmResult !== null}
        meterId={scanConfirmResult?.meterId || ""}
        workOrder={scanConfirmResult?.workOrder}
        matchSource={scanConfirmResult?.matchSource || "none"}
        isSearching={scanConfirmResult?.isSearching || false}
        searchError={scanConfirmResult?.searchError || null}
        isOffline={!isOnline}
        onConfirm={handleConfirmScan}
        onScanAgain={handleScanAgain}
        onClose={handleCloseScanConfirm}
      />

      {!isOnline ? (
        <Pressable
          onPress={() => navigation.navigate("NewWorkOrderWizard")}
          style={({ pressed }) => [
            styles.fab,
            { 
              backgroundColor: theme.primary, 
              opacity: pressed ? 0.8 : 1,
              bottom: tabBarHeight + Spacing.lg,
            },
          ]}
        >
          <Icon name="plus" size={28} color="#FFFFFF" />
        </Pressable>
      ) : null}
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
  fab: {
    position: "absolute",
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
});
