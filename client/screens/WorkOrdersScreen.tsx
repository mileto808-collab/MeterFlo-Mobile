import React, { useCallback, useMemo, useState, useRef, useEffect } from "react";
import { View, FlatList, StyleSheet, Pressable, RefreshControl, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { useTheme } from "@/hooks/useTheme";
import { useWorkOrders, WorkOrder } from "@/contexts/WorkOrderContext";
import { useOffline } from "@/contexts/OfflineContext";
import { useAuth } from "@/contexts/AuthContext";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { ThemedText } from "@/components/ThemedText";
import { SearchBar } from "@/components/SearchBar";
import { WorkOrderCard } from "@/components/WorkOrderCard";
import { OfflineBanner } from "@/components/OfflineBanner";
import { SearchOptionsModal, SearchOption } from "@/components/SearchOptionsModal";
import { HIDScannerModal } from "@/components/HIDScannerModal";
import { ManualSearchModal } from "@/components/ManualSearchModal";
import { ScanConfirmModal, MatchSource, MatchFieldType, MATCH_FIELD_LABELS, determineMatchFieldType } from "@/components/ScanConfirmModal";
import { Icon } from "@/components/Icons";
import { Spacing, BorderRadius } from "@/constants/theme";

interface ScanResult {
  meterId: string;
  workOrder: WorkOrder | undefined;
  matchSource: MatchSource;
  matchFieldType?: MatchFieldType;
  isSearching: boolean;
  searchError: string | null;
  isAlreadyCompleted?: boolean;
  isManualSearch?: boolean;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function WorkOrdersScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { filters, setFilters, getFilteredWorkOrders, workOrders, isLoading, refreshWorkOrders, error, searchWorkOrdersByMeterIdOnServer, projectConfig } = useWorkOrders();
  const { isOnline } = useOffline();
  const { projectId, projects } = useAuth();

  const currentProjectName = useMemo(() => {
    if (!projectId || !projects.length) return null;
    const project = projects.find(p => p.id === projectId);
    return project?.name || null;
  }, [projectId, projects]);

  const [showSearchOptions, setShowSearchOptions] = useState(false);
  const [showHIDScanner, setShowHIDScanner] = useState(false);
  const [showManualSearch, setShowManualSearch] = useState(false);
  const [scanConfirmResult, setScanConfirmResult] = useState<ScanResult | null>(null);
  const [hidInitialValue, setHidInitialValue] = useState("");
  
  const hiddenInputRef = useRef<TextInput>(null);
  const hidBufferRef = useRef("");
  const hidTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKeyTimeRef = useRef(0);

  const isHidScannerEnabled = projectConfig.searchShowHidScanner;
  const isAnyModalOpen = showSearchOptions || showHIDScanner || showManualSearch || scanConfirmResult !== null;
  const isAnyModalOpenRef = useRef(isAnyModalOpen);
  isAnyModalOpenRef.current = isAnyModalOpen;

  const focusHiddenInput = useCallback(() => {
    if (isHidScannerEnabled && !isAnyModalOpenRef.current) {
      setTimeout(() => {
        hiddenInputRef.current?.focus();
      }, 50);
    }
  }, [isHidScannerEnabled]);

  useFocusEffect(
    useCallback(() => {
      focusHiddenInput();
    }, [focusHiddenInput])
  );

  useEffect(() => {
    if (isHidScannerEnabled && !isAnyModalOpen) {
      focusHiddenInput();
    }
  }, [isHidScannerEnabled, isAnyModalOpen, focusHiddenInput]);

  const handleHiddenInputBlur = useCallback(() => {
    if (isHidScannerEnabled && !isAnyModalOpenRef.current) {
      setTimeout(() => {
        if (!isAnyModalOpenRef.current) {
          hiddenInputRef.current?.focus();
        }
      }, 100);
    }
  }, [isHidScannerEnabled]);

  const handleHiddenInputChange = useCallback((text: string) => {
    if (!isHidScannerEnabled) return;
    
    const now = Date.now();
    const timeSinceLastKey = now - lastKeyTimeRef.current;
    lastKeyTimeRef.current = now;

    if (timeSinceLastKey < 100) {
      hidBufferRef.current = text;
    } else {
      hidBufferRef.current = text;
    }

    if (hidTimeoutRef.current) {
      clearTimeout(hidTimeoutRef.current);
    }

    hidTimeoutRef.current = setTimeout(() => {
      const scannedValue = hidBufferRef.current.trim();
      if (scannedValue.length >= 3) {
        setHidInitialValue(scannedValue);
        setShowHIDScanner(true);
        hidBufferRef.current = "";
        if (hiddenInputRef.current) {
          hiddenInputRef.current.clear();
        }
      }
    }, 150);
  }, [isHidScannerEnabled]);

  const handleHiddenInputKeyPress = useCallback((e: any) => {
    if (e.nativeEvent.key === "Enter" && hidBufferRef.current.trim().length >= 3) {
      if (hidTimeoutRef.current) {
        clearTimeout(hidTimeoutRef.current);
      }
      const scannedValue = hidBufferRef.current.trim();
      setHidInitialValue(scannedValue);
      setShowHIDScanner(true);
      hidBufferRef.current = "";
      if (hiddenInputRef.current) {
        hiddenInputRef.current.clear();
      }
    }
  }, []);

  const filteredWorkOrders = useMemo(() => getFilteredWorkOrders(), [getFilteredWorkOrders]);

  const findWorkOrdersBySearchTerm = useCallback((searchTerm: string): WorkOrder[] => {
    const normalizedTerm = searchTerm.trim().toLowerCase();
    if (!normalizedTerm) return [];
    
    return workOrders.filter(wo => {
      // Exact match on system IDs
      const oldSystemId = wo.oldSystemId?.trim().toLowerCase() || "";
      const newSystemId = wo.newSystemId?.trim().toLowerCase() || "";
      if (oldSystemId === normalizedTerm || newSystemId === normalizedTerm) {
        return true;
      }
      
      // Exact match on module IDs
      const oldModuleId = wo.oldModuleId?.trim().toLowerCase() || "";
      const newModuleId = wo.newModuleId?.trim().toLowerCase() || "";
      if (oldModuleId === normalizedTerm || newModuleId === normalizedTerm) {
        return true;
      }
      
      // Exact match on work order ID: match either customerWoId or internal id
      const customerWoId = wo.customerWoId?.trim().toLowerCase() || "";
      const internalId = String(wo.id).toLowerCase();
      if (customerWoId === normalizedTerm || internalId === normalizedTerm) {
        return true;
      }
      
      // Partial match on service address (case-insensitive)
      const serviceAddress = wo.serviceAddress?.trim().toLowerCase() || "";
      if (serviceAddress.includes(normalizedTerm)) {
        return true;
      }
      
      return false;
    });
  }, [workOrders]);

  const handleScanResult = useCallback(async (scannedValue: string, isManualSearch: boolean = false) => {
    const normalizedValue = scannedValue.trim();
    const normalizedLower = normalizedValue.toLowerCase();
    
    // Helper to check if work order is completed/closed
    const isCompletedOrClosed = (wo: WorkOrder) => {
      const status = wo.status?.toLowerCase();
      return status === "completed" || status === "closed";
    };
    
    // Use shared helper for consistent match type detection
    const getMatchFieldType = (wo: WorkOrder): MatchFieldType => {
      return determineMatchFieldType(wo, normalizedValue);
    };
    
    // First, show the modal in searching state
    setScanConfirmResult({
      meterId: normalizedValue,
      workOrder: undefined,
      matchSource: "none",
      isSearching: true,
      searchError: null,
      isManualSearch,
    });
    
    // Search locally first (by meter ID, customer ID, or address)
    const localMatches = findWorkOrdersBySearchTerm(normalizedValue);
    
    // First try to find an eligible (non-completed) work order
    const eligibleLocalWo = localMatches.find(wo => !isCompletedOrClosed(wo));
    if (eligibleLocalWo) {
      setScanConfirmResult({
        meterId: normalizedValue,
        workOrder: eligibleLocalWo,
        matchSource: "local",
        matchFieldType: getMatchFieldType(eligibleLocalWo),
        isSearching: false,
        searchError: null,
        isAlreadyCompleted: false,
        isManualSearch,
      });
      return;
    }
    
    // Check if there's a completed work order locally
    const completedLocalWo = localMatches.find(wo => isCompletedOrClosed(wo));
    if (completedLocalWo) {
      setScanConfirmResult({
        meterId: normalizedValue,
        workOrder: completedLocalWo,
        matchSource: "local",
        matchFieldType: getMatchFieldType(completedLocalWo),
        isSearching: false,
        searchError: null,
        isAlreadyCompleted: true,
        isManualSearch,
      });
      return;
    }
    
    // No local match - search server if online
    if (isOnline) {
      try {
        const serverResults = await searchWorkOrdersByMeterIdOnServer(normalizedValue);
        
        // First try to find an eligible work order
        const eligibleServerWo = serverResults.find(wo => !isCompletedOrClosed(wo));
        if (eligibleServerWo) {
          setScanConfirmResult({
            meterId: normalizedValue,
            workOrder: eligibleServerWo,
            matchSource: "server",
            matchFieldType: getMatchFieldType(eligibleServerWo),
            isSearching: false,
            searchError: null,
            isAlreadyCompleted: false,
            isManualSearch,
          });
          return;
        }
        
        // Check if there's a completed work order on server
        const completedServerWo = serverResults.find(wo => isCompletedOrClosed(wo));
        if (completedServerWo) {
          setScanConfirmResult({
            meterId: normalizedValue,
            workOrder: completedServerWo,
            matchSource: "server",
            matchFieldType: getMatchFieldType(completedServerWo),
            isSearching: false,
            searchError: null,
            isAlreadyCompleted: true,
            isManualSearch,
          });
          return;
        }
        
        // No match at all
        setScanConfirmResult({
          meterId: normalizedValue,
          workOrder: undefined,
          matchSource: "none",
          isSearching: false,
          searchError: null,
          isManualSearch,
        });
      } catch (err) {
        setScanConfirmResult({
          meterId: normalizedValue,
          workOrder: undefined,
          matchSource: "none",
          isSearching: false,
          searchError: err instanceof Error ? err.message : "Server search failed",
          isManualSearch,
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
        isManualSearch,
      });
    }
  }, [findWorkOrdersBySearchTerm, isOnline, searchWorkOrdersByMeterIdOnServer]);

  const handleConfirmScan = useCallback(() => {
    if (scanConfirmResult?.workOrder && !scanConfirmResult?.isAlreadyCompleted) {
      setScanConfirmResult(null);
      navigation.navigate("WorkflowWizard", { workOrder: scanConfirmResult.workOrder });
    }
  }, [scanConfirmResult, navigation]);

  const handleScanAgain = useCallback(() => {
    setScanConfirmResult(null);
    setHidInitialValue("");
    setShowHIDScanner(true);
  }, []);

  const handleEditSearch = useCallback(() => {
    setScanConfirmResult(null);
    setShowManualSearch(true);
  }, []);

  const handleManualSearchResult = useCallback((scannedValue: string) => {
    handleScanResult(scannedValue, true);
  }, [handleScanResult]);

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

  const handleSearchPress = useCallback(() => {
    const enabledOptions: SearchOption[] = [];
    if (projectConfig.searchShowBarcodeScan) enabledOptions.push("barcode");
    if (projectConfig.searchShowQrCodeScan) enabledOptions.push("qrcode");
    if (projectConfig.searchShowHidScanner) enabledOptions.push("hid");
    if (projectConfig.searchShowManualEntry) enabledOptions.push("manual");

    if (enabledOptions.length === 1) {
      handleSearchOptionSelect(enabledOptions[0]);
    } else if (enabledOptions.length > 1) {
      setShowSearchOptions(true);
    } else {
      setShowSearchOptions(true);
    }
  }, [projectConfig, handleSearchOptionSelect]);

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
      
      {currentProjectName ? (
        <View style={[styles.projectBanner, { paddingTop: isOnline ? headerHeight + Spacing.sm : Spacing.sm, backgroundColor: theme.backgroundSecondary }]}>
          <Icon name="folder" size={14} color={theme.textSecondary} />
          <ThemedText type="small" style={styles.projectName} numberOfLines={2}>
            {currentProjectName}
          </ThemedText>
        </View>
      ) : null}

      <View style={[styles.searchContainer, { paddingTop: currentProjectName ? Spacing.sm : (isOnline ? headerHeight + Spacing.md : Spacing.md) }]}>
        <SearchBar
          value={filters.searchQuery}
          onChangeText={handleSearchChange}
          placeholder="Scan Asset ID..."
          onSearchPress={handleSearchPress}
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
            onPress={() => navigation.navigate("Files")}
            style={({ pressed }) => [
              styles.iconButton,
              { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Icon name="folder" size={20} color={theme.text} />
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
        allowedOptions={{
          barcode: projectConfig.searchShowBarcodeScan,
          qrcode: projectConfig.searchShowQrCodeScan,
          hid: projectConfig.searchShowHidScanner,
          manual: projectConfig.searchShowManualEntry,
        }}
      />

      <HIDScannerModal
        visible={showHIDScanner}
        onClose={() => {
          setShowHIDScanner(false);
          setHidInitialValue("");
        }}
        onScan={handleScanResult}
        initialValue={hidInitialValue}
      />

      {isHidScannerEnabled && !isAnyModalOpen ? (
        <TextInput
          ref={hiddenInputRef}
          onChangeText={handleHiddenInputChange}
          onKeyPress={handleHiddenInputKeyPress}
          onBlur={handleHiddenInputBlur}
          style={styles.hiddenInput}
          autoCapitalize="none"
          autoCorrect={false}
          showSoftInputOnFocus={false}
          caretHidden={true}
          blurOnSubmit={false}
          autoFocus={true}
        />
      ) : null}

      <ManualSearchModal
        visible={showManualSearch}
        value={filters.searchQuery}
        onClose={() => setShowManualSearch(false)}
        onChangeText={handleSearchChange}
        onFindWorkOrder={handleManualSearchResult}
      />

      <ScanConfirmModal
        visible={scanConfirmResult !== null}
        meterId={scanConfirmResult?.meterId || ""}
        workOrder={scanConfirmResult?.workOrder}
        matchSource={scanConfirmResult?.matchSource || "none"}
        matchFieldType={scanConfirmResult?.matchFieldType || "none"}
        isSearching={scanConfirmResult?.isSearching || false}
        searchError={scanConfirmResult?.searchError || null}
        isOffline={!isOnline}
        isAlreadyCompleted={scanConfirmResult?.isAlreadyCompleted || false}
        isManualSearch={scanConfirmResult?.isManualSearch || false}
        onConfirm={handleConfirmScan}
        onScanAgain={handleScanAgain}
        onEditSearch={handleEditSearch}
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
  projectBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xs,
    gap: Spacing.xs,
  },
  projectName: {
    flex: 1,
    flexShrink: 1,
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
  hiddenInput: {
    position: "absolute",
    opacity: 0,
    width: 1,
    height: 1,
    top: -1000,
  },
});
