import React, { useState, useCallback, useRef, useEffect } from "react";
import { View, StyleSheet, Pressable, Platform } from "react-native";
import { CameraView, useCameraPermissions, BarcodeScanningResult } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { Linking } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { useWorkOrders, WorkOrder } from "@/contexts/WorkOrderContext";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { Spacing, BorderRadius } from "@/constants/theme";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ScannerRouteProp = RouteProp<RootStackParamList, "BarcodeScanner">;

interface ScanResult {
  meterId: string;
  workOrder: WorkOrder | undefined;
}

const HOLD_STEADY_DURATION = 700;

export default function BarcodeScannerScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScannerRouteProp>();
  const { workOrders } = useWorkOrders();
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(true);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [detectedBarcode, setDetectedBarcode] = useState<string | null>(null);

  const lastBarcodeRef = useRef<string | null>(null);
  const lastBarcodeTimeRef = useRef<number>(0);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scanType = route.params?.scanType || "barcode";
  const isQRMode = scanType === "qrcode";

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
      }
    };
  }, []);

  const findWorkOrderByMeterId = useCallback((meterId: string): WorkOrder | undefined => {
    const normalizedMeterId = meterId.trim().toLowerCase();
    return workOrders.find(wo => {
      const oldMeterId = wo.oldMeterId?.trim().toLowerCase();
      return oldMeterId === normalizedMeterId;
    });
  }, [workOrders]);

  const confirmScan = useCallback((scannedValue: string) => {
    setIsScanning(false);
    setDetectedBarcode(null);
    const workOrder = findWorkOrderByMeterId(scannedValue);
    setScanResult({
      meterId: scannedValue,
      workOrder,
    });
  }, [findWorkOrderByMeterId]);

  const handleBarcodeScanned = useCallback((result: BarcodeScanningResult) => {
    if (!isScanning) return;

    const scannedValue = result.data;
    const now = Date.now();

    if (scannedValue !== lastBarcodeRef.current) {
      lastBarcodeRef.current = scannedValue;
      lastBarcodeTimeRef.current = now;
      setDetectedBarcode(scannedValue);

      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
      }

      holdTimerRef.current = setTimeout(() => {
        if (lastBarcodeRef.current === scannedValue) {
          confirmScan(scannedValue);
        }
      }, HOLD_STEADY_DURATION);
    }
  }, [isScanning, confirmScan]);

  const handleConfirm = useCallback(() => {
    if (scanResult?.workOrder) {
      navigation.goBack();
      setTimeout(() => {
        navigation.navigate("WorkflowWizard", { workOrder: scanResult.workOrder! });
      }, 100);
    }
  }, [scanResult, navigation]);

  const handleScanAgain = useCallback(() => {
    setScanResult(null);
    setDetectedBarcode(null);
    lastBarcodeRef.current = null;
    lastBarcodeTimeRef.current = 0;
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setIsScanning(true);
  }, []);

  const handleCancel = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  if (!permission) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.backgroundRoot }]}>
        <ThemedText>Loading camera...</ThemedText>
      </View>
    );
  }

  const permissionDenied = permission && !permission.granted && !permission.canAskAgain;

  if (!permission.granted) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.backgroundRoot }]}>
        <View style={[styles.permissionCard, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name={permissionDenied ? "camera-off" : "camera"} size={48} color={permissionDenied ? theme.textSecondary : theme.primary} />
          <ThemedText type="h4" style={styles.permissionTitle}>
            {permissionDenied ? "Camera Access Required" : "Camera Permission"}
          </ThemedText>
          <ThemedText type="body" style={[styles.permissionText, { color: theme.textSecondary }]}>
            {permissionDenied 
              ? "Camera access denied. Please enable in Settings."
              : `We need camera access to scan ${isQRMode ? "QR codes" : "barcodes"} and find work orders.`
            }
          </ThemedText>
          {permissionDenied ? (
            Platform.OS !== "web" ? (
              <Button
                onPress={async () => {
                  try {
                    await Linking.openSettings();
                  } catch (error) {}
                }}
                style={{ backgroundColor: theme.primary }}
              >
                Open Settings
              </Button>
            ) : null
          ) : (
            <Button
              onPress={requestPermission}
              style={{ backgroundColor: theme.primary }}
            >
              Grant Permission
            </Button>
          )}
          <Button
            onPress={handleCancel}
            style={{ backgroundColor: theme.backgroundTertiary }}
          >
            <ThemedText>Cancel</ThemedText>
          </Button>
        </View>
      </View>
    );
  }

  const barcodeTypes = isQRMode 
    ? ["qr", "datamatrix"] as const
    : ["code128", "code39", "ean13", "ean8", "upc_a", "upc_e", "itf14", "codabar"] as const;

  if (scanResult) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.backgroundRoot }]}>
        <View style={[styles.resultCard, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather 
            name={scanResult.workOrder ? "check-circle" : "alert-circle"} 
            size={56} 
            color={scanResult.workOrder ? theme.success : theme.warning} 
          />
          
          <ThemedText type="h4" style={styles.resultTitle}>
            {scanResult.workOrder ? "Work Order Found" : "No Match Found"}
          </ThemedText>
          
          <View style={[styles.meterIdBox, { backgroundColor: theme.backgroundTertiary }]}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Scanned Meter ID
            </ThemedText>
            <ThemedText type="h3" style={{ fontWeight: "700", marginTop: Spacing.xs }}>
              {scanResult.meterId}
            </ThemedText>
          </View>

          {scanResult.workOrder ? (
            <View style={styles.workOrderInfo}>
              <View style={styles.infoRow}>
                <ThemedText type="body" style={{ color: theme.textSecondary }}>Work Order:</ThemedText>
                <ThemedText type="body" style={{ fontWeight: "600" }}>{scanResult.workOrder.customerWoId || `#${scanResult.workOrder.id}`}</ThemedText>
              </View>
              <View style={styles.infoRow}>
                <ThemedText type="body" style={{ color: theme.textSecondary }}>Address:</ThemedText>
                <ThemedText type="body" style={{ fontWeight: "500", flex: 1, textAlign: "right" }} numberOfLines={2}>
                  {scanResult.workOrder.serviceAddress || "No address"}
                </ThemedText>
              </View>
              <View style={styles.infoRow}>
                <ThemedText type="body" style={{ color: theme.textSecondary }}>Status:</ThemedText>
                <ThemedText type="body" style={{ fontWeight: "500" }}>{scanResult.workOrder.status}</ThemedText>
              </View>
            </View>
          ) : (
            <ThemedText type="body" style={[styles.noMatchText, { color: theme.textSecondary }]}>
              No work order found with this meter ID. Please try scanning again or search manually.
            </ThemedText>
          )}

          <View style={styles.buttonRow}>
            {scanResult.workOrder ? (
              <Button
                onPress={handleConfirm}
                style={{ backgroundColor: theme.primary, flex: 1 }}
              >
                <Feather name="arrow-right" size={18} color="#FFFFFF" style={{ marginRight: Spacing.sm }} />
                Start Wizard
              </Button>
            ) : (
              <Button
                onPress={handleCancel}
                style={{ backgroundColor: theme.backgroundTertiary, flex: 1 }}
              >
                <Feather name="x" size={18} color={theme.text} style={{ marginRight: Spacing.sm }} />
                <ThemedText>Close</ThemedText>
              </Button>
            )}
            <Button
              onPress={handleScanAgain}
              style={{ backgroundColor: scanResult.workOrder ? theme.backgroundTertiary : theme.primary, flex: 1, minWidth: 120 }}
            >
              <Feather name="refresh-cw" size={18} color={scanResult.workOrder ? theme.text : "#FFFFFF"} style={{ marginRight: Spacing.sm }} />
              <ThemedText style={{ color: scanResult.workOrder ? theme.text : "#FFFFFF" }}>Scan Again</ThemedText>
            </Button>
          </View>
          
          {scanResult.workOrder ? (
            <Pressable onPress={handleCancel} style={styles.cancelLink}>
              <ThemedText type="body" style={{ color: theme.textSecondary }}>Cancel</ThemedText>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: "#000" }]}>
      <View style={styles.scannerContainer}>
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: barcodeTypes as any,
          }}
          onBarcodeScanned={isScanning ? handleBarcodeScanned : undefined}
        />
        <View style={styles.scannerOverlay}>
          <View style={[
            styles.scanRegion, 
            { 
              borderColor: detectedBarcode ? theme.success : theme.primary,
              borderWidth: detectedBarcode ? 3 : 2,
              width: isQRMode ? 200 : 280,
              height: isQRMode ? 200 : 100,
            }
          ]} />
        </View>
      </View>
      
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable
          onPress={handleCancel}
          style={({ pressed }) => [
            styles.closeButton,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Feather name="x" size={24} color="#FFFFFF" />
        </Pressable>
        <ThemedText type="h4" style={styles.headerTitle}>
          {isQRMode ? "Scan QR Code" : "Scan Barcode"}
        </ThemedText>
        <View style={{ width: 44 }} />
      </View>

      {detectedBarcode ? (
        <View style={styles.detectedBarcodeContainer}>
          <View style={[styles.detectedBarcodeBox, { backgroundColor: "rgba(0, 0, 0, 0.7)" }]}>
            <Feather name="loader" size={16} color={theme.success} style={{ marginRight: Spacing.sm }} />
            <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600" }}>
              {detectedBarcode}
            </ThemedText>
          </View>
          <ThemedText type="small" style={{ color: "rgba(255, 255, 255, 0.8)", marginTop: Spacing.xs }}>
            Hold steady...
          </ThemedText>
        </View>
      ) : null}

      <View style={[styles.instructions, { paddingBottom: insets.bottom + Spacing.xl }]}>
        <ThemedText type="body" style={styles.instructionText}>
          {detectedBarcode 
            ? "Hold steady to capture" 
            : isQRMode ? "Position QR code within the frame" : "Position barcode within the frame"
          }
        </ThemedText>
        <ThemedText type="small" style={styles.instructionSubtext}>
          {detectedBarcode ? "Locking on to barcode..." : "Scanning for meter ID to find work order"}
        </ThemedText>
        
        <Button
          onPress={handleCancel}
          style={{ backgroundColor: "rgba(255, 255, 255, 0.2)", marginTop: Spacing.lg }}
        >
          <ThemedText style={{ color: "#FFFFFF" }}>Cancel Scan</ThemedText>
        </Button>
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
  scannerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  camera: {
    width: 300,
    height: 300,
    borderRadius: BorderRadius.md,
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
    borderWidth: 2,
    borderRadius: BorderRadius.sm,
    borderStyle: "dashed",
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
  },
  headerTitle: {
    color: "#FFFFFF",
    textAlign: "center",
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  instructions: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
  },
  instructionText: {
    color: "#FFFFFF",
    textAlign: "center",
    fontWeight: "500",
  },
  instructionSubtext: {
    color: "rgba(255, 255, 255, 0.7)",
    textAlign: "center",
    marginTop: Spacing.xs,
  },
  resultCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    gap: Spacing.lg,
    maxWidth: 360,
    width: "100%",
  },
  resultTitle: {
    textAlign: "center",
  },
  meterIdBox: {
    width: "100%",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  workOrderInfo: {
    width: "100%",
    gap: Spacing.sm,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  noMatchText: {
    textAlign: "center",
  },
  buttonRow: {
    flexDirection: "row",
    gap: Spacing.md,
    width: "100%",
  },
  cancelLink: {
    paddingVertical: Spacing.sm,
  },
  detectedBarcodeContainer: {
    position: "absolute",
    top: "45%",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  detectedBarcodeBox: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
});
