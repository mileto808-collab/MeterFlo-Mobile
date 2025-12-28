import React, { useState, useCallback } from "react";
import { View, StyleSheet, Pressable, Alert, Platform } from "react-native";
import { CameraView, useCameraPermissions, BarcodeScanningResult } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { Linking } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { useWorkOrders, WorkOrder } from "@/contexts/WorkOrderContext";
import { ThemedText } from "@/components/ThemedText";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { Spacing, BorderRadius } from "@/constants/theme";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ScannerRouteProp = RouteProp<RootStackParamList, "BarcodeScanner">;

export default function BarcodeScannerScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScannerRouteProp>();
  const { workOrders } = useWorkOrders();
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(true);

  const scanType = route.params?.scanType || "barcode";
  const isQRMode = scanType === "qrcode";

  const findWorkOrderByMeterId = useCallback((meterId: string): WorkOrder | undefined => {
    const normalizedMeterId = meterId.trim().toLowerCase();
    return workOrders.find(wo => {
      const oldMeterId = wo.oldMeterId?.trim().toLowerCase();
      return oldMeterId === normalizedMeterId;
    });
  }, [workOrders]);

  const handleBarcodeScanned = useCallback((result: BarcodeScanningResult) => {
    if (!isScanning) return;
    setIsScanning(false);

    const scannedValue = result.data;
    const workOrder = findWorkOrderByMeterId(scannedValue);

    if (workOrder) {
      navigation.goBack();
      setTimeout(() => {
        navigation.navigate("WorkflowWizard", { workOrder });
      }, 100);
    } else {
      Alert.alert(
        "Work Order Not Found",
        `No work order found with meter ID: ${scannedValue}`,
        [
          { 
            text: "Scan Again", 
            onPress: () => setIsScanning(true) 
          },
          { 
            text: "Close", 
            style: "cancel",
            onPress: () => navigation.goBack()
          },
        ]
      );
    }
  }, [isScanning, findWorkOrderByMeterId, navigation]);

  if (!permission) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <ThemedText>Loading camera...</ThemedText>
      </View>
    );
  }

  if (!permission.granted) {
    if (permission.status === "denied" && !permission.canAskAgain) {
      return (
        <View style={[styles.container, styles.centered, { backgroundColor: theme.backgroundRoot }]}>
          <View style={[styles.permissionCard, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="camera-off" size={48} color={theme.textSecondary} />
            <ThemedText type="h4" style={styles.permissionTitle}>
              Camera Access Required
            </ThemedText>
            <ThemedText type="body" style={[styles.permissionText, { color: theme.textSecondary }]}>
              Camera permission is needed to scan barcodes. Please enable it in Settings.
            </ThemedText>
            {Platform.OS !== "web" ? (
              <Pressable
                onPress={async () => {
                  try {
                    await Linking.openSettings();
                  } catch (error) {
                  }
                }}
                style={({ pressed }) => [
                  styles.button,
                  { backgroundColor: theme.primary, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <ThemedText style={{ color: "#FFFFFF" }}>Open Settings</ThemedText>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => navigation.goBack()}
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: theme.backgroundTertiary, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <ThemedText>Go Back</ThemedText>
            </Pressable>
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.backgroundRoot }]}>
        <View style={[styles.permissionCard, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name="camera" size={48} color={theme.primary} />
          <ThemedText type="h4" style={styles.permissionTitle}>
            Camera Permission
          </ThemedText>
          <ThemedText type="body" style={[styles.permissionText, { color: theme.textSecondary }]}>
            We need camera access to scan {isQRMode ? "QR codes" : "barcodes"} and find work orders.
          </ThemedText>
          <Pressable
            onPress={requestPermission}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.primary, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <ThemedText style={{ color: "#FFFFFF" }}>Enable Camera</ThemedText>
          </Pressable>
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.backgroundTertiary, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <ThemedText>Cancel</ThemedText>
          </Pressable>
        </View>
      </View>
    );
  }

  const barcodeTypes = isQRMode 
    ? ["qr"] as const
    : ["code128", "code39", "code93", "ean13", "ean8", "upc_a", "upc_e", "itf14", "codabar"] as const;

  return (
    <View style={[styles.container, { backgroundColor: "#000" }]}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: barcodeTypes as any,
        }}
        onBarcodeScanned={isScanning ? handleBarcodeScanned : undefined}
      />
      
      <View style={[styles.overlay, { paddingTop: insets.top }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [
            styles.closeButton,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Feather name="x" size={28} color="#FFFFFF" />
        </Pressable>

        <View style={styles.scanArea}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
        </View>

        <View style={styles.instructions}>
          <ThemedText type="body" style={styles.instructionText}>
            {isQRMode ? "Position QR code within the frame" : "Position barcode within the frame"}
          </ThemedText>
          <ThemedText type="small" style={styles.instructionSubtext}>
            Scanning for meter ID to find work order
          </ThemedText>
        </View>
      </View>
    </View>
  );
}

const CORNER_SIZE = 30;
const CORNER_WIDTH = 4;

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
  },
  permissionTitle: {
    textAlign: "center",
  },
  permissionText: {
    textAlign: "center",
  },
  button: {
    width: "100%",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.lg,
  },
  closeButton: {
    alignSelf: "flex-start",
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  scanArea: {
    width: 280,
    height: 200,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: CORNER_SIZE,
    height: CORNER_SIZE,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderColor: "#FFFFFF",
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderColor: "#FFFFFF",
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderColor: "#FFFFFF",
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderColor: "#FFFFFF",
  },
  instructions: {
    alignItems: "center",
    paddingBottom: Spacing.xl,
  },
  instructionText: {
    color: "#FFFFFF",
    textAlign: "center",
  },
  instructionSubtext: {
    color: "rgba(255, 255, 255, 0.7)",
    textAlign: "center",
    marginTop: Spacing.xs,
  },
});
