import React, { useState, useCallback, useEffect } from "react";
import { View, StyleSheet, Pressable, Platform, Linking, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { CameraView, useCameraPermissions, BarcodeScanningResult } from "expo-camera";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/hooks/useTheme";
import { useWorkOrders, WorkOrder } from "@/contexts/WorkOrderContext";
import { useOffline } from "@/contexts/OfflineContext";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius } from "@/constants/theme";

type RouteProps = RouteProp<RootStackParamList, "TapToCaptureScan">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type Phase = "scanning" | "confirming";

type MatchSource = "local" | "server";

export default function TapToCaptureScanScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NavigationProp>();
  const { workOrders, searchWorkOrdersByMeterIdOnServer, claimWorkOrder, fetchSingleWorkOrder } = useWorkOrders();
  const { isOnline } = useOffline();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const scanType = route.params.scanType;
  const isQRMode = scanType === "qrcode";
  
  const [phase, setPhase] = useState<Phase>("scanning");
  const [detectedValue, setDetectedValue] = useState<string | null>(null);
  const [matchedWorkOrders, setMatchedWorkOrders] = useState<WorkOrder[]>([]);
  const [selectedWorkOrderIndex, setSelectedWorkOrderIndex] = useState(0);
  const [matchSource, setMatchSource] = useState<MatchSource>("local");
  const [isSearchingServer, setIsSearchingServer] = useState(false);
  const [serverSearchError, setServerSearchError] = useState<string | null>(null);
  const [isClaimingWorkOrder, setIsClaimingWorkOrder] = useState(false);
  
  const matchedWorkOrder = matchedWorkOrders.length > 0 ? matchedWorkOrders[selectedWorkOrderIndex] : null;
  const hasMultipleMatches = matchedWorkOrders.length > 1;

  const barcodeTypes = isQRMode
    ? ["qr", "datamatrix"]
    : ["code128", "code39", "ean13", "ean8", "upc_a", "upc_e", "itf14", "codabar"];

  useEffect(() => {
    if (!cameraPermission) {
      requestCameraPermission();
    }
  }, [cameraPermission, requestCameraPermission]);

  const openSettings = async () => {
    if (Platform.OS !== "web") {
      try {
        await Linking.openSettings();
      } catch (error) {
        console.error("Failed to open settings:", error);
      }
    }
  };

  const handleBarcodeScanned = useCallback((result: BarcodeScanningResult) => {
    const scannedValue = result.data?.trim();
    if (scannedValue && scannedValue !== detectedValue) {
      setDetectedValue(scannedValue);
    }
  }, [detectedValue]);

  const handleCapture = useCallback(async () => {
    if (!detectedValue) return;
    
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    
    const normalizedValue = detectedValue.trim().toUpperCase();
    
    // First, search locally
    const foundWorkOrders = workOrders.filter(wo => {
      const oldMeterId = (wo.oldMeterId || "").trim().toUpperCase();
      const newMeterId = (wo.newMeterId || "").trim().toUpperCase();
      return oldMeterId === normalizedValue || newMeterId === normalizedValue;
    });
    
    if (foundWorkOrders.length > 0) {
      // Found locally
      setMatchedWorkOrders(foundWorkOrders);
      setSelectedWorkOrderIndex(0);
      setMatchSource("local");
      setServerSearchError(null);
      setPhase("confirming");
      return;
    }
    
    // No local match - search server if online
    if (isOnline) {
      setIsSearchingServer(true);
      setServerSearchError(null);
      setPhase("confirming");
      
      try {
        const serverResults = await searchWorkOrdersByMeterIdOnServer(normalizedValue);
        
        // Filter out Completed and Closed work orders
        const eligibleWorkOrders = serverResults.filter(wo => {
          const status = wo.status?.toLowerCase();
          return status !== "completed" && status !== "closed";
        });
        
        setMatchedWorkOrders(eligibleWorkOrders);
        setSelectedWorkOrderIndex(0);
        setMatchSource("server");
      } catch (error) {
        console.error("[TapToCaptureScan] Server search failed:", error);
        setServerSearchError(error instanceof Error ? error.message : "Server search failed");
        setMatchedWorkOrders([]);
      } finally {
        setIsSearchingServer(false);
      }
    } else {
      // Offline and no local match
      setMatchedWorkOrders([]);
      setMatchSource("local");
      setServerSearchError(null);
      setPhase("confirming");
    }
  }, [detectedValue, workOrders, isOnline, searchWorkOrdersByMeterIdOnServer]);

  const handleClear = useCallback(() => {
    setDetectedValue(null);
  }, []);

  const handleCancel = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleScanAgain = useCallback(() => {
    setDetectedValue(null);
    setMatchedWorkOrders([]);
    setSelectedWorkOrderIndex(0);
    setMatchSource("local");
    setServerSearchError(null);
    setIsSearchingServer(false);
    setIsClaimingWorkOrder(false);
    setPhase("scanning");
  }, []);
  
  const handleNextWorkOrder = useCallback(() => {
    if (selectedWorkOrderIndex < matchedWorkOrders.length - 1) {
      setSelectedWorkOrderIndex(prev => prev + 1);
    }
  }, [selectedWorkOrderIndex, matchedWorkOrders.length]);
  
  const handlePrevWorkOrder = useCallback(() => {
    if (selectedWorkOrderIndex > 0) {
      setSelectedWorkOrderIndex(prev => prev - 1);
    }
  }, [selectedWorkOrderIndex]);

  const handleProceedToWizard = useCallback(() => {
    if (matchedWorkOrder) {
      navigation.replace("WorkflowWizard", { workOrder: matchedWorkOrder });
    }
  }, [matchedWorkOrder, navigation]);

  const handleViewDetails = useCallback(() => {
    if (matchedWorkOrder) {
      navigation.replace("WorkOrderDetail", { workOrder: matchedWorkOrder });
    }
  }, [matchedWorkOrder, navigation]);

  const handleClaimAndStart = useCallback(async () => {
    if (!matchedWorkOrder) return;
    
    setIsClaimingWorkOrder(true);
    try {
      // Claim the work order
      await claimWorkOrder(matchedWorkOrder.id);
      
      // Fetch the full work order data to ensure we have latest
      const fullWorkOrder = await fetchSingleWorkOrder(matchedWorkOrder.id);
      
      if (fullWorkOrder) {
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        navigation.replace("WorkflowWizard", { workOrder: fullWorkOrder });
      } else {
        // Fallback to the existing work order if fetch failed
        navigation.replace("WorkflowWizard", { workOrder: matchedWorkOrder });
      }
    } catch (error) {
      console.error("[TapToCaptureScan] Failed to claim work order:", error);
      const message = error instanceof Error ? error.message : "Failed to claim work order";
      if (Platform.OS === "web") {
        alert(message);
      } else {
        const { Alert } = require("react-native");
        Alert.alert("Error", message);
      }
    } finally {
      setIsClaimingWorkOrder(false);
    }
  }, [matchedWorkOrder, claimWorkOrder, fetchSingleWorkOrder, navigation]);

  if (phase === "confirming") {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
          <Pressable
            onPress={handleCancel}
            style={({ pressed }) => [
              styles.closeButton,
              { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Feather name="x" size={24} color={theme.text} />
          </Pressable>
          <ThemedText type="h4">Scan Result</ThemedText>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.content}>
          <View style={[styles.resultCard, { backgroundColor: theme.backgroundSecondary }]}>
            {isSearchingServer ? (
              <>
                <View style={styles.iconContainer}>
                  <ActivityIndicator size="large" color={theme.primary} />
                </View>
                <ThemedText type="h3" style={styles.resultTitle}>
                  Searching Server...
                </ThemedText>
                <ThemedText type="body" style={[styles.noMatchText, { color: theme.textSecondary }]}>
                  Looking for work orders with this meter ID on the server.
                </ThemedText>
              </>
            ) : (
              <>
                <View style={styles.iconContainer}>
                  <Feather 
                    name={matchedWorkOrder ? "check-circle" : "alert-circle"} 
                    size={56} 
                    color={matchedWorkOrder ? theme.success : theme.warning} 
                  />
                </View>

                <ThemedText type="h3" style={styles.resultTitle}>
                  {matchedWorkOrder 
                    ? hasMultipleMatches 
                      ? `${matchedWorkOrders.length} Work Orders Found` 
                      : matchSource === "server" 
                        ? "Work Order Found on Server"
                        : "Work Order Found" 
                    : serverSearchError
                      ? "Search Failed"
                      : "No Match Found"}
                </ThemedText>
                
                {matchSource === "server" && matchedWorkOrder ? (
                  <View style={[styles.serverBadge, { backgroundColor: theme.primary + "20" }]}>
                    <Feather name="cloud" size={14} color={theme.primary} />
                    <ThemedText type="small" style={{ color: theme.primary, marginLeft: Spacing.xs }}>
                      From Server - Requires Claim
                    </ThemedText>
                  </View>
                ) : null}
            
            {hasMultipleMatches ? (
              <View style={styles.multipleMatchNav}>
                <Pressable 
                  onPress={handlePrevWorkOrder}
                  disabled={selectedWorkOrderIndex === 0}
                  style={({ pressed }) => [
                    styles.navButton,
                    { 
                      backgroundColor: theme.backgroundTertiary,
                      opacity: selectedWorkOrderIndex === 0 ? 0.4 : pressed ? 0.7 : 1 
                    }
                  ]}
                >
                  <Feather name="chevron-left" size={20} color={theme.text} />
                </Pressable>
                <ThemedText type="body" style={{ fontWeight: "500" }}>
                  {selectedWorkOrderIndex + 1} of {matchedWorkOrders.length}
                </ThemedText>
                <Pressable 
                  onPress={handleNextWorkOrder}
                  disabled={selectedWorkOrderIndex === matchedWorkOrders.length - 1}
                  style={({ pressed }) => [
                    styles.navButton,
                    { 
                      backgroundColor: theme.backgroundTertiary,
                      opacity: selectedWorkOrderIndex === matchedWorkOrders.length - 1 ? 0.4 : pressed ? 0.7 : 1 
                    }
                  ]}
                >
                  <Feather name="chevron-right" size={20} color={theme.text} />
                </Pressable>
              </View>
            ) : null}

            <View style={[styles.scannedValueBox, { backgroundColor: theme.backgroundTertiary }]}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Scanned Value
              </ThemedText>
              <ThemedText type="h4" style={{ fontWeight: "600", marginTop: Spacing.xs }}>
                {detectedValue}
              </ThemedText>
            </View>

            {matchedWorkOrder ? (
              <View style={styles.workOrderDetails}>
                <View style={styles.detailRow}>
                  <ThemedText type="body" style={{ color: theme.textSecondary }}>Work Order:</ThemedText>
                  <ThemedText type="body" style={{ fontWeight: "600" }}>
                    {matchedWorkOrder.customerWoId}
                  </ThemedText>
                </View>
                <View style={styles.detailRow}>
                  <ThemedText type="body" style={{ color: theme.textSecondary }}>Address:</ThemedText>
                  <ThemedText type="body" style={{ fontWeight: "500", flex: 1, textAlign: "right" }} numberOfLines={2}>
                    {matchedWorkOrder.serviceAddress}
                  </ThemedText>
                </View>
                <View style={styles.detailRow}>
                  <ThemedText type="body" style={{ color: theme.textSecondary }}>Old Meter:</ThemedText>
                  <ThemedText type="body" style={{ fontWeight: "600", color: theme.primary }}>
                    {matchedWorkOrder.oldMeterId || "N/A"}
                  </ThemedText>
                </View>
                <View style={styles.detailRow}>
                  <ThemedText type="body" style={{ color: theme.textSecondary }}>Status:</ThemedText>
                  <ThemedText 
                    type="body" 
                    style={{ 
                      fontWeight: "500",
                      color: matchedWorkOrder.status === "Trouble" 
                        ? theme.warning 
                        : matchedWorkOrder.status === "Completed" 
                          ? theme.success 
                          : theme.text 
                    }}
                  >
                    {matchedWorkOrder.status}
                  </ThemedText>
                </View>
              </View>
            ) : serverSearchError ? (
              <ThemedText type="body" style={[styles.noMatchText, { color: theme.error || theme.warning }]}>
                {serverSearchError}
              </ThemedText>
            ) : (
              <ThemedText type="body" style={[styles.noMatchText, { color: theme.textSecondary }]}>
                {isOnline 
                  ? "No work order found with this meter ID on the server."
                  : "No work order found locally. Go online to search the server."}
              </ThemedText>
            )}
              </>
            )}
          </View>

          {!isSearchingServer ? (
            <View style={styles.buttonContainer}>
            {matchedWorkOrder ? (
              <>
                {matchSource === "server" ? (
                  <Button
                    onPress={handleClaimAndStart}
                    disabled={isClaimingWorkOrder}
                    style={{ backgroundColor: theme.primary, opacity: isClaimingWorkOrder ? 0.7 : 1 }}
                  >
                    {isClaimingWorkOrder ? (
                      <>
                        <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: Spacing.sm }} />
                        <ThemedText style={{ color: "#FFFFFF", fontWeight: "600" }}>Claiming...</ThemedText>
                      </>
                    ) : (
                      <>
                        <Feather name="download" size={18} color="#FFFFFF" style={{ marginRight: Spacing.sm }} />
                        <ThemedText style={{ color: "#FFFFFF", fontWeight: "600" }}>Claim & Start</ThemedText>
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    onPress={handleProceedToWizard}
                    style={{ backgroundColor: theme.primary }}
                  >
                    <Feather name="arrow-right" size={18} color="#FFFFFF" style={{ marginRight: Spacing.sm }} />
                    <ThemedText style={{ color: "#FFFFFF", fontWeight: "600" }}>Start Wizard</ThemedText>
                  </Button>
                )}
                
                <View style={styles.secondaryButtons}>
                  {matchSource === "local" ? (
                    <Button
                      onPress={handleViewDetails}
                      style={{ backgroundColor: theme.backgroundSecondary, flex: 1 }}
                    >
                      <ThemedText>View Details</ThemedText>
                    </Button>
                  ) : null}
                  
                  <Button
                    onPress={handleScanAgain}
                    disabled={isClaimingWorkOrder}
                    style={{ backgroundColor: theme.backgroundSecondary, flex: matchSource === "local" ? 1 : undefined }}
                  >
                    <Feather name="refresh-cw" size={18} color={theme.text} style={{ marginRight: Spacing.sm }} />
                    <ThemedText>Scan Again</ThemedText>
                  </Button>
                </View>
              </>
            ) : (
              <>
                <Button
                  onPress={handleScanAgain}
                  style={{ backgroundColor: theme.primary }}
                >
                  <Feather name="refresh-cw" size={18} color="#FFFFFF" style={{ marginRight: Spacing.sm }} />
                  <ThemedText style={{ color: "#FFFFFF" }}>Try Again</ThemedText>
                </Button>
                
                <Button
                  onPress={handleCancel}
                  style={{ backgroundColor: theme.backgroundSecondary }}
                >
                  <ThemedText>Cancel</ThemedText>
                </Button>
              </>
            )}
          </View>
          ) : null}
        </View>
      </ThemedView>
    );
  }

  if (!cameraPermission) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <ThemedText type="body" style={{ marginTop: Spacing.md }}>Loading camera...</ThemedText>
      </View>
    );
  }

  if (!cameraPermission.granted) {
    const permissionDenied = cameraPermission.status === "denied" && !cameraPermission.canAskAgain;
    
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.backgroundRoot }]}>
        <View style={[styles.permissionCard, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name="camera-off" size={48} color={theme.textSecondary} />
          <ThemedText type="h4" style={styles.permissionTitle}>
            Camera Permission Required
          </ThemedText>
          <ThemedText type="body" style={[styles.permissionText, { color: theme.textSecondary }]}>
            {permissionDenied
              ? "Camera access was denied. Please enable it in your device settings."
              : "We need camera access to scan barcodes and QR codes."
            }
          </ThemedText>
          
          {permissionDenied ? (
            Platform.OS !== "web" ? (
              <Button
                onPress={openSettings}
                style={{ backgroundColor: theme.primary, marginTop: Spacing.md }}
              >
                <Feather name="settings" size={18} color="#FFFFFF" style={{ marginRight: Spacing.sm }} />
                Open Settings
              </Button>
            ) : null
          ) : (
            <Button
              onPress={requestCameraPermission}
              style={{ backgroundColor: theme.primary, marginTop: Spacing.md }}
            >
              <Feather name="camera" size={18} color="#FFFFFF" style={{ marginRight: Spacing.sm }} />
              Grant Permission
            </Button>
          )}
          
          <Button
            onPress={handleCancel}
            style={{ backgroundColor: theme.backgroundTertiary, marginTop: Spacing.md }}
          >
            <ThemedText>Cancel</ThemedText>
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: "#000" }]}>
      <View style={styles.scannerContainer}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: barcodeTypes as any,
          }}
          onBarcodeScanned={handleBarcodeScanned}
        />
        
        <View style={styles.scannerOverlay}>
          <View style={[
            styles.scanRegion,
            {
              borderColor: detectedValue ? theme.success : theme.primary,
              borderWidth: detectedValue ? 3 : 2,
              width: isQRMode ? 200 : 280,
              height: isQRMode ? 200 : 100,
            }
          ]} />
        </View>
      </View>
      
      <View style={[styles.scannerHeader, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable
          onPress={handleCancel}
          style={({ pressed }) => [
            styles.closeButton,
            { backgroundColor: "rgba(0, 0, 0, 0.5)", opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Feather name="x" size={24} color="#FFFFFF" />
        </Pressable>
        <ThemedText type="h4" style={styles.scannerTitle}>
          {isQRMode ? "Scan QR Code" : "Scan Barcode"}
        </ThemedText>
        <View style={{ width: 44 }} />
      </View>

      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + Spacing.lg }]}>
        {detectedValue ? (
          <View style={styles.captureSection}>
            <View style={[styles.detectedBox, { backgroundColor: "rgba(0, 0, 0, 0.8)" }]}>
              <Feather name="check-circle" size={20} color={theme.success} />
              <ThemedText type="body" style={styles.detectedText}>
                {detectedValue}
              </ThemedText>
            </View>
            
            <ThemedText type="body" style={styles.instructionText}>
              Is this the correct code?
            </ThemedText>
            
            <View style={styles.buttonRow}>
              <Button
                onPress={handleClear}
                style={[styles.actionButton, { backgroundColor: "rgba(255, 255, 255, 0.2)" }]}
              >
                <Feather name="refresh-cw" size={18} color="#FFFFFF" style={{ marginRight: Spacing.sm }} />
                <ThemedText style={{ color: "#FFFFFF" }}>Scan Again</ThemedText>
              </Button>
              
              <Button
                onPress={handleCapture}
                style={[styles.actionButton, { backgroundColor: theme.success }]}
              >
                <Feather name="check" size={18} color="#FFFFFF" style={{ marginRight: Spacing.sm }} />
                <ThemedText style={{ color: "#FFFFFF", fontWeight: "600" }}>Capture</ThemedText>
              </Button>
            </View>
          </View>
        ) : (
          <View style={styles.waitingSection}>
            <ThemedText type="body" style={styles.instructionText}>
              {isQRMode ? "Position QR code within the frame" : "Position barcode within the frame"}
            </ThemedText>
            <ThemedText type="small" style={styles.instructionSubtext}>
              Scanning for meter ID to find work order
            </ThemedText>
            
            <Button
              onPress={handleCancel}
              style={{ backgroundColor: "rgba(255, 255, 255, 0.2)", marginTop: Spacing.lg }}
            >
              <ThemedText style={{ color: "#FFFFFF" }}>Cancel</ThemedText>
            </Button>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  permissionCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    gap: Spacing.md,
    maxWidth: 320,
    width: "100%",
  },
  permissionTitle: {
    textAlign: "center",
  },
  permissionText: {
    textAlign: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  resultCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: "center",
  },
  iconContainer: {
    marginBottom: Spacing.lg,
  },
  resultTitle: {
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  scannedValueBox: {
    width: "100%",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  workOrderDetails: {
    width: "100%",
    gap: Spacing.sm,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  noMatchText: {
    textAlign: "center",
  },
  buttonContainer: {
    marginTop: Spacing.xl,
    gap: Spacing.md,
  },
  secondaryButtons: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  scannerContainer: {
    flex: 1,
    position: "relative",
  },
  scannerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  scanRegion: {
    borderRadius: BorderRadius.sm,
    borderStyle: "dashed",
  },
  scannerHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
  },
  scannerTitle: {
    color: "#FFFFFF",
    textAlign: "center",
  },
  bottomSection: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
  },
  captureSection: {
    alignItems: "center",
  },
  waitingSection: {
    alignItems: "center",
  },
  detectedBox: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  detectedText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 18,
  },
  instructionText: {
    color: "#FFFFFF",
    textAlign: "center",
    fontWeight: "500",
    marginBottom: Spacing.sm,
  },
  instructionSubtext: {
    color: "rgba(255, 255, 255, 0.7)",
    textAlign: "center",
  },
  buttonRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  actionButton: {
    flex: 1,
    minWidth: 140,
  },
  multipleMatchNav: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  serverBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
  },
});
