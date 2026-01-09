import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, Alert, Platform, ActivityIndicator, Pressable, Image, ScrollView, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Icon } from "@/components/Icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as ImageManipulator from "expo-image-manipulator";
import { CameraView, useCameraPermissions, BarcodeScanningResult } from "expo-camera";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { useWorkOrders } from "@/contexts/WorkOrderContext";
import { useAuth } from "@/contexts/AuthContext";
import { useOffline } from "@/contexts/OfflineContext";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { ThemedText } from "@/components/ThemedText";
import { TextInput } from "@/components/TextInput";
import { Button } from "@/components/Button";
import { SelectInput } from "@/components/SelectInput";
import { SignaturePad } from "@/components/SignaturePad";
import { PhotoViewer } from "@/components/PhotoViewer";
import { Spacing, BorderRadius } from "@/constants/theme";
import { checkWorkOrderConflict } from "@/lib/conflict-check";

type RouteProps = RouteProp<RootStackParamList, "WorkflowWizard">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type WizardStep = 
  | "canChange"
  | "oldReading"
  | "beforePhotos"
  | "physicalChange"
  | "newSystemId"
  | "newReading"
  | "afterPhotos"
  | "gps"
  | "signature"
  | "notes"
  | "confirm"
  | "troubleCapture"
  | "troubleConfirm";

interface PhotoAsset {
  uri: string;
  id: string;
}

interface SystemChangeoutData {
  canChange: boolean | null;
  troubleCode: string;
  troubleNote: string;
  troublePhotos: PhotoAsset[];
  oldSystemReading: string;
  oldModuleRead: string;
  beforePhotos: PhotoAsset[];
  newSystemId: string;
  newSystemReading: string;
  newModuleId: string;
  newModuleRead: string;
  afterPhotos: PhotoAsset[];
  gpsCoordinates: string;
  signatureData: string;
  signatureName: string;
  notes: string;
}

const SUCCESS_STEPS: WizardStep[] = [
  "canChange",
  "oldReading", 
  "beforePhotos",
  "physicalChange",
  "newSystemId",
  "newReading",
  "afterPhotos",
  "gps",
  "signature",
  "notes",
  "confirm",
];

const TROUBLE_STEPS: WizardStep[] = [
  "canChange",
  "troubleCapture",
  "troubleConfirm",
];

const STEP_TITLES: Record<WizardStep, string> = {
  canChange: "Can The Changeout Proceed?",
  oldReading: "Capture Old Reading",
  beforePhotos: "Before Photos",
  physicalChange: "Perform Physical Changeout",
  newSystemId: "New System ID",
  newReading: "New System Reading",
  afterPhotos: "After Photos",
  gps: "Capture GPS",
  signature: "Signature",
  notes: "Notes",
  confirm: "Confirm & Submit",
  troubleCapture: "Report Issue",
  troubleConfirm: "Confirm & Submit",
};

export default function WorkflowWizardScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NavigationProp>();
  const { updateWorkOrder, referenceData, claimWorkOrder, deleteLocalWorkOrder } = useWorkOrders();
  const { serverUrl, projectId, user } = useAuth();
  const { isOnline, addPendingAction, addDirectSubmissionHistory } = useOffline();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const workOrder = route.params.workOrder;
  
  const isEditingTrouble = workOrder.status?.toLowerCase() === "trouble";
  const isEditingCompleted = workOrder.status?.toLowerCase() === "completed";
  const isEditing = isEditingTrouble || isEditingCompleted;
  
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [hasClaimed, setHasClaimed] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerType, setScannerType] = useState<"barcode" | "qr">("barcode");
  const [detectedBarcode, setDetectedBarcode] = useState<string | null>(null);
  const [isCapturingGps, setIsCapturingGps] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [oldSystemReadingTouched, setOldSystemReadingTouched] = useState(false);
  const [oldModuleReadingTouched, setOldModuleReadingTouched] = useState(false);
  
  useEffect(() => {
    if (showScanner && !cameraPermission) {
      requestCameraPermission();
    }
  }, [showScanner, cameraPermission, requestCameraPermission]);
  
  const [viewingPhoto, setViewingPhoto] = useState<{ uri: string; type: "before" | "after" | "trouble"; id: string } | null>(null);
  
  const hasUnsyncedDraft = Boolean(workOrder.syncPending);
  
  const convertStoredPhotosToAssets = (photos: Array<{base64: string; filename: string}> | undefined): PhotoAsset[] => {
    if (!photos || photos.length === 0) return [];
    return photos.map((p, idx) => ({
      uri: p.base64,
      id: p.filename || `existing_${idx}`,
    }));
  };
  
  const [formData, setFormData] = useState<SystemChangeoutData>(() => {
    const isEditingStatus = workOrder.status?.toLowerCase() === "trouble" || workOrder.status?.toLowerCase() === "completed";
    
    return {
      canChange: null,
      troubleCode: workOrder.troubleCode || "",
      troubleNote: hasUnsyncedDraft ? (workOrder.notes || workOrder.troubleNote || "") : "",
      troublePhotos: isEditingStatus ? convertStoredPhotosToAssets(workOrder.troublePhotos) : [],
      oldSystemReading: workOrder.oldSystemReading || "",
      oldModuleRead: workOrder.oldModuleRead || "",
      beforePhotos: isEditingStatus ? convertStoredPhotosToAssets(workOrder.beforePhotos) : [],
      newSystemId: workOrder.newSystemId || "",
      newSystemReading: workOrder.newSystemReading || "",
      newModuleId: workOrder.newModuleId || "",
      newModuleRead: workOrder.newModuleRead || "",
      afterPhotos: isEditingStatus ? convertStoredPhotosToAssets(workOrder.afterPhotos) : [],
      gpsCoordinates: workOrder.newGps || "",
      signatureData: workOrder.signatureData || "",
      signatureName: workOrder.signatureName || "",
      notes: hasUnsyncedDraft ? (workOrder.notes || "") : "",
    };
  });

  const getSteps = () => {
    return formData.canChange === false ? TROUBLE_STEPS : SUCCESS_STEPS;
  };
  
  const steps = getSteps();
  const currentStep = steps[currentStepIndex];
  const totalSteps = steps.length;
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === totalSteps - 1;

  const troubleCodeOptions = referenceData?.troubleCodes || [
    { code: "ACCESS_DENIED", label: "Access Denied", description: "" },
    { code: "METER_LOCKED", label: "Meter Locked", description: "" },
    { code: "UNSAFE_CONDITIONS", label: "Unsafe Conditions", description: "" },
    { code: "CUSTOMER_REFUSED", label: "Customer Refused", description: "" },
    { code: "OTHER", label: "Other", description: "" },
  ];
  
  const troubleCodeDisplayStrings = troubleCodeOptions.map(tc => `${tc.code} - ${tc.label}`);
  
  const getTroubleCodeFromDisplay = (displayString: string): string => {
    const code = displayString.split(" - ")[0];
    return code;
  };
  
  const getTroubleCodeDisplay = (code: string): string => {
    const tc = troubleCodeOptions.find(t => t.code === code);
    return tc ? `${tc.code} - ${tc.label}` : code;
  };

  useEffect(() => {
    if (!workOrder.customerWoId || !workOrder.oldSystemId) {
      const missing: string[] = [];
      if (!workOrder.customerWoId) missing.push("Customer WO ID");
      if (!workOrder.oldSystemId) missing.push("Old System ID");
      
      if (Platform.OS === "web") {
        alert(`Cannot start workflow. Missing required fields: ${missing.join(", ")}`);
      } else {
        Alert.alert(
          "Cannot Start Workflow",
          `This work order is missing required fields: ${missing.join(", ")}. Please sync to get the latest data.`,
          [{ text: "OK", onPress: () => navigation.goBack() }]
        );
      }
      if (Platform.OS === "web") {
        navigation.goBack();
      }
      return;
    }
    claimWorkOrderOnStart();
  }, []);
  
  useEffect(() => {
    if (isEditingTrouble && workOrder.troubleCode && !formData.troubleCode.includes(" - ")) {
      const displayString = getTroubleCodeDisplay(workOrder.troubleCode);
      if (displayString !== workOrder.troubleCode) {
        setFormData(prev => ({ ...prev, troubleCode: displayString }));
      }
    }
  }, [referenceData, isEditingTrouble, workOrder.troubleCode]);


  const claimWorkOrderOnStart = async () => {
    if (isEditing) {
      setHasClaimed(true);
      return;
    }
    
    const isAlreadyAssignedToMe = workOrder.assignedUserId === user?.id && !workOrder.assignedGroupId;
    if (isAlreadyAssignedToMe) {
      setHasClaimed(true);
      return;
    }

    if (!isOnline) {
      await addPendingAction({
        type: "claim",
        workOrderId: String(workOrder.id),
        workOrderTitle: workOrder.serviceAddress,
        data: {},
      });
      setHasClaimed(true);
      return;
    }

    if (!serverUrl || !projectId) {
      setClaimError("Server not configured");
      return;
    }

    setIsClaiming(true);
    try {
      await claimWorkOrder(workOrder.id);
      setHasClaimed(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to claim work order";
      setClaimError(message);
    } finally {
      setIsClaiming(false);
    }
  };

  const handleRetryClaimOrCancel = () => {
    setClaimError(null);
    navigation.goBack();
  };

  const openSettings = async () => {
    if (Platform.OS !== "web") {
      try {
        const Linking = require("expo-linking");
        await Linking.openSettings();
      } catch (e) {
        console.error("Could not open settings:", e);
      }
    }
  };

  const convertPhotosToBase64 = async (photos: PhotoAsset[]): Promise<{ base64Photos: string[]; failedCount: number }> => {
    const base64Photos: string[] = [];
    let failedCount = 0;
    
    for (const photo of photos) {
      try {
        if (photo.uri.startsWith('data:image/')) {
          const base64Part = photo.uri.split(',')[1];
          if (base64Part) {
            base64Photos.push(base64Part);
            console.log(`[Photo] Using existing base64 photo, size: ${Math.round(base64Part.length / 1024)}KB`);
          } else {
            console.error("[Photo] Could not extract base64 from data URI");
            failedCount++;
          }
        } else if (Platform.OS === "web") {
          const response = await fetch(photo.uri);
          const blob = await response.blob();
          const reader = new FileReader();
          const base64 = await new Promise<string>((resolve, reject) => {
            reader.onloadend = () => {
              const result = reader.result as string;
              const base64Data = result.split(",")[1];
              resolve(base64Data);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          base64Photos.push(base64);
        } else {
          const manipResult = await ImageManipulator.manipulateAsync(
            photo.uri,
            [{ resize: { width: 1200 } }],
            { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
          );
          if (manipResult.base64) {
            base64Photos.push(manipResult.base64);
            console.log(`[Photo] Converted photo successfully, size: ${Math.round(manipResult.base64.length / 1024)}KB`);
          } else {
            console.error("[Photo] manipulateAsync returned no base64 data");
            failedCount++;
          }
        }
      } catch (error) {
        console.error("[Photo] Error converting photo to base64:", error);
        failedCount++;
      }
    }
    
    console.log(`[Photo] Conversion complete: ${base64Photos.length} success, ${failedCount} failed out of ${photos.length} total`);
    return { base64Photos, failedCount };
  };

  const takePhoto = async (photoType: "before" | "after" | "trouble") => {
    try {
      const permResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (!permResult.granted) {
        if (Platform.OS !== "web") {
          if (!permResult.canAskAgain) {
            Alert.alert(
              "Camera Permission Required",
              "Please enable camera access in Settings to take photos.",
              [
                { text: "Cancel", style: "cancel" },
                { text: "Open Settings", onPress: openSettings },
              ]
            );
          } else {
            Alert.alert("Permission Required", "Camera permission is needed to take photos.");
          }
        }
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets[0]) {
        const newPhoto: PhotoAsset = {
          uri: result.assets[0].uri,
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        };

        if (photoType === "before") {
          setFormData(prev => ({ ...prev, beforePhotos: [...prev.beforePhotos, newPhoto] }));
        } else if (photoType === "after") {
          setFormData(prev => ({ ...prev, afterPhotos: [...prev.afterPhotos, newPhoto] }));
        } else {
          setFormData(prev => ({ ...prev, troublePhotos: [...prev.troublePhotos, newPhoto] }));
        }
      }
    } catch (error) {
      console.error("Photo capture error:", error);
      if (Platform.OS !== "web") {
        Alert.alert("Error", "Could not take photo. Please try again.");
      }
    }
  };

  const removePhoto = (photoType: "before" | "after" | "trouble", photoId: string) => {
    if (photoType === "before") {
      setFormData(prev => ({ ...prev, beforePhotos: prev.beforePhotos.filter(p => p.id !== photoId) }));
    } else if (photoType === "after") {
      setFormData(prev => ({ ...prev, afterPhotos: prev.afterPhotos.filter(p => p.id !== photoId) }));
    } else {
      setFormData(prev => ({ ...prev, troublePhotos: prev.troublePhotos.filter(p => p.id !== photoId) }));
    }
  };

  const handleBarcodeScanned = (result: BarcodeScanningResult) => {
    const scannedValue = result.data?.trim();
    if (scannedValue && scannedValue !== detectedBarcode) {
      setDetectedBarcode(scannedValue);
    }
  };
  
  const handleCaptureBarcode = () => {
    if (detectedBarcode) {
      setFormData(prev => ({ ...prev, newSystemId: detectedBarcode }));
      setShowScanner(false);
      setDetectedBarcode(null);
    }
  };
  
  const handleClearBarcode = () => {
    setDetectedBarcode(null);
  };
  
  const handleCancelScanner = () => {
    setShowScanner(false);
    setDetectedBarcode(null);
  };

  const captureGps = async () => {
    setIsCapturingGps(true);
    try {
      const permResult = await Location.requestForegroundPermissionsAsync();
      
      if (!permResult.granted) {
        if (Platform.OS !== "web") {
          if (!permResult.canAskAgain) {
            Alert.alert(
              "Location Permission Required",
              "Please enable location access in Settings to capture GPS coordinates.",
              [
                { text: "Cancel", style: "cancel" },
                { text: "Open Settings", onPress: openSettings },
              ]
            );
          } else {
            Alert.alert("Permission Required", "Location permission is needed to capture GPS coordinates.");
          }
        }
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
        mayShowUserSettingsDialog: true,
      });

      const coords = `${location.coords.latitude.toFixed(6)},${location.coords.longitude.toFixed(6)}`;
      const accuracy = location.coords.accuracy ? ` (${location.coords.accuracy.toFixed(1)}m)` : "";
      setFormData(prev => ({ ...prev, gpsCoordinates: coords }));
      
      if (Platform.OS !== "web") {
        Alert.alert(
          "GPS Captured",
          `Coordinates: ${coords}${accuracy ? `\nAccuracy: ${location.coords.accuracy?.toFixed(1)}m` : ""}`
        );
      }
    } catch (error) {
      if (Platform.OS !== "web") {
        Alert.alert("GPS Error", "Could not get location from device GPS. Please try again or enter manually.");
      }
    } finally {
      setIsCapturingGps(false);
    }
  };

  const isCurrentStepValid = (): boolean => {
    switch (currentStep) {
      case "canChange": 
        return formData.canChange !== null;
      case "oldReading": {
        const systemReadingValid = formData.oldSystemReading.trim().length > 0 && oldSystemReadingTouched;
        const hasModule = Boolean(workOrder.oldModuleId);
        const moduleReadingValid = !hasModule || (formData.oldModuleRead.trim().length > 0 && oldModuleReadingTouched);
        return systemReadingValid && moduleReadingValid;
      }
      case "beforePhotos":
        return formData.beforePhotos.length >= 1;
      case "physicalChange":
        return true;
      case "newSystemId": 
        return formData.newSystemId.trim().length > 0;
      case "newReading": 
        return formData.newSystemReading.trim().length > 0;
      case "afterPhotos":
        return formData.afterPhotos.length >= 1;
      case "gps":
        return formData.gpsCoordinates.trim().length > 0;
      case "signature": 
        return formData.signatureName.trim().length > 0;
      case "notes":
        return true;
      case "confirm":
        return true;
      case "troubleCapture":
        return formData.troubleCode.length > 0 && formData.troublePhotos.length >= 1;
      case "troubleConfirm":
        return true;
      default: 
        return true;
    }
  };

  const handleNext = () => {
    if (!isCurrentStepValid()) {
      if (Platform.OS !== "web") {
        Alert.alert("Required Field", "Please complete this step before continuing.");
      }
      return;
    }

    if (currentStep === "canChange" && formData.canChange === false) {
      setCurrentStepIndex(1);
      return;
    }

    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStepIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (!isFirstStep) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const handleComplete = async () => {
    setIsSubmitting(true);

    const canChange = formData.canChange === true;
    const completedAt = new Date().toISOString();
    
    const parseReading = (value: string): number | null => {
      if (!value.trim()) return null;
      const parsed = parseFloat(value);
      return Number.isNaN(parsed) ? null : parsed;
    };

    try {
      let troublePhotosBase64: string[] = [];
      let beforePhotosBase64: string[] = [];
      let afterPhotosBase64: string[] = [];
      let totalFailedPhotos = 0;
      
      if (!canChange && formData.troublePhotos.length > 0) {
        const result = await convertPhotosToBase64(formData.troublePhotos);
        troublePhotosBase64 = result.base64Photos;
        totalFailedPhotos += result.failedCount;
      }
      
      if (canChange && formData.beforePhotos.length > 0) {
        const result = await convertPhotosToBase64(formData.beforePhotos);
        beforePhotosBase64 = result.base64Photos;
        totalFailedPhotos += result.failedCount;
      }
      
      if (canChange && formData.afterPhotos.length > 0) {
        const result = await convertPhotosToBase64(formData.afterPhotos);
        afterPhotosBase64 = result.base64Photos;
        totalFailedPhotos += result.failedCount;
      }
      
      if (totalFailedPhotos > 0) {
        const successCount = troublePhotosBase64.length + beforePhotosBase64.length + afterPhotosBase64.length;
        const message = `${totalFailedPhotos} photo(s) could not be processed. ${successCount} photo(s) will be uploaded. Continue anyway?`;
        
        const shouldContinue = await new Promise<boolean>((resolve) => {
          if (Platform.OS === "web") {
            resolve(confirm(message));
          } else {
            Alert.alert(
              "Photo Processing Issue",
              message,
              [
                { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
                { text: "Continue", onPress: () => resolve(true) },
              ]
            );
          }
        });
        
        if (!shouldContinue) {
          setIsSubmitting(false);
          return;
        }
      }
      
      console.log(`[WorkflowWizard] Submitting with photos - trouble: ${troublePhotosBase64.length}, before: ${beforePhotosBase64.length}, after: ${afterPhotosBase64.length}`);

      if (isOnline && serverUrl && projectId && user?.username) {
        const conflictResult = await checkWorkOrderConflict(
          String(workOrder.id),
          serverUrl,
          String(projectId),
          user.username
        );

        if (conflictResult.hasConflict) {
          setIsSubmitting(false);
          
          await deleteLocalWorkOrder(workOrder.id);
          
          const conflictMessage = conflictResult.conflictType === "claimed"
            ? `This work order was already claimed by ${conflictResult.conflictUser}. Your changes cannot be submitted and the work order has been removed from your device.`
            : `This work order was already completed by ${conflictResult.conflictUser}. Your changes cannot be submitted and the work order has been removed from your device.`;

          if (Platform.OS === "web") {
            alert(conflictMessage);
          } else {
            Alert.alert(
              "Work Order Conflict",
              conflictMessage,
              [{ text: "OK", onPress: () => navigation.goBack() }]
            );
          }
          if (Platform.OS === "web") {
            navigation.goBack();
          }
          return;
        }
      }

      const patchPayload = canChange ? {
        status: "Completed",
        old_system_reading: parseReading(formData.oldSystemReading) ?? 0,
        new_system_reading: parseReading(formData.newSystemReading) ?? 0,
        new_system_id: formData.newSystemId,
        old_module_id: workOrder.oldModuleId || null,
        old_module_read: parseReading(formData.oldModuleRead),
        new_module_id: formData.newModuleId || null,
        new_module_read: parseReading(formData.newModuleRead),
        new_gps: formData.gpsCoordinates || null,
        signature_data: formData.signatureData || null,
        signature_name: formData.signatureName,
        trouble: null,
        notes: formData.notes || null,
        completed_at: completedAt,
        completed_by: user?.id || null,
        updated_by: user?.username || null,
        before_photos: beforePhotosBase64.length > 0 ? beforePhotosBase64 : null,
        after_photos: afterPhotosBase64.length > 0 ? afterPhotosBase64 : null,
      } : {
        status: "Trouble",
        old_system_reading: parseReading(formData.oldSystemReading),
        old_module_id: workOrder.oldModuleId || null,
        old_module_read: parseReading(formData.oldModuleRead),
        trouble: getTroubleCodeFromDisplay(formData.troubleCode),
        notes: formData.troubleNote || null,
        completed_at: completedAt,
        updated_by: user?.username || null,
        trouble_photos: troublePhotosBase64.length > 0 ? troublePhotosBase64 : null,
      };

      if (isOnline && serverUrl && projectId) {
        const endpoint = canChange 
          ? `${serverUrl}/api/mobile/workorders/${workOrder.id}/complete`
          : `${serverUrl}/api/mobile/workorders/${workOrder.id}/trouble`;
        
        console.log(`[WorkflowWizard] Submitting to endpoint: ${endpoint}`);
        
        const woIdForFilename = workOrder.customerWoId || String(workOrder.id);
        const formatPhotosForServer = (photos: string[], prefix: string) => {
          return photos.map((b64, idx) => ({
            base64: b64.startsWith('data:') ? b64 : `data:image/jpeg;base64,${b64}`,
            filename: `${woIdForFilename}-${prefix}-${idx + 1}.jpg`,
          }));
        };
        
        const mobilePayload = canChange ? {
          projectId: Number(projectId),
          oldSystemReading: parseReading(formData.oldSystemReading),
          oldModuleId: workOrder.oldModuleId || null,
          oldModuleRead: parseReading(formData.oldModuleRead),
          newSystemId: formData.newSystemId,
          newSystemReading: parseReading(formData.newSystemReading) ?? 0,
          newModuleId: formData.newModuleId || null,
          newModuleRead: parseReading(formData.newModuleRead),
          gpsCoordinates: formData.gpsCoordinates || null,
          signatureData: formData.signatureData || null,
          signatureName: formData.signatureName,
          completedAt: completedAt,
          notes: formData.notes || null,
          beforePhotos: formatPhotosForServer(beforePhotosBase64, 'before'),
          afterPhotos: formatPhotosForServer(afterPhotosBase64, 'after'),
        } : {
          projectId: Number(projectId),
          troubleCode: getTroubleCodeFromDisplay(formData.troubleCode),
          notes: formData.troubleNote || null,
          oldSystemReading: parseReading(formData.oldSystemReading),
          oldModuleId: workOrder.oldModuleId || null,
          oldModuleRead: parseReading(formData.oldModuleRead),
          photos: formatPhotosForServer(troublePhotosBase64, 'trouble'),
        };
        
        const payloadSize = JSON.stringify(mobilePayload).length;
        console.log(`[WorkflowWizard] Payload size: ${Math.round(payloadSize / 1024)}KB`);
        
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
            "Origin": serverUrl,
            "Referer": `${serverUrl}/`,
          },
          credentials: "include",
          body: JSON.stringify(mobilePayload),
        });

        console.log(`[WorkflowWizard] Response status: ${response.status}`);

        if (!response.ok) {
          const errorText = await response.text();
          console.error("[WorkflowWizard] Server error response:", response.status, errorText?.substring(0, 500));
          throw new Error(errorText || "Failed to complete work order");
        }

        const result = await response.json();
        console.log(`[WorkflowWizard] Server response:`, JSON.stringify(result).substring(0, 300));
        
        const totalPhotoCount = troublePhotosBase64.length + beforePhotosBase64.length + afterPhotosBase64.length;
        try {
          await addDirectSubmissionHistory({
            workOrderIds: [String(workOrder.id)],
            workOrderTitles: [workOrder.serviceAddress],
            status: "success",
            successCount: 1,
            failedCount: 0,
            photoCount: totalPhotoCount,
          });
        } catch (historyError) {
          console.warn("[WorkflowWizard] Failed to record sync history:", historyError);
        }
        
        const onlineFormatPhotos = (photos: string[], prefix: string) => {
          return photos.map((b64, idx) => ({
            base64: b64.startsWith('data:') ? b64 : `data:image/jpeg;base64,${b64}`,
            filename: `${woIdForFilename}-${prefix}-${idx + 1}.jpg`,
          }));
        };
        
        updateWorkOrder(workOrder.id, {
          status: result.workOrder?.status || (canChange ? "Completed" : "Trouble"),
          oldSystemReading: formData.oldSystemReading,
          oldModuleRead: formData.oldModuleRead,
          completedAt: completedAt,
          completedBy: user?.id,
          completedByUsername: user?.displayName || user?.username,
          syncPending: false,
          ...(canChange ? {
            newSystemId: formData.newSystemId,
            newSystemReading: formData.newSystemReading,
            newModuleId: formData.newModuleId,
            newModuleRead: formData.newModuleRead,
            newGps: formData.gpsCoordinates,
            notes: formData.notes,
            beforePhotos: onlineFormatPhotos(beforePhotosBase64, 'before'),
            afterPhotos: onlineFormatPhotos(afterPhotosBase64, 'after'),
          } : {
            troubleCode: getTroubleCodeFromDisplay(formData.troubleCode),
            notes: formData.troubleNote,
            troublePhotos: onlineFormatPhotos(troublePhotosBase64, 'trouble'),
          }),
        }, workOrder);
      } else {
        const offlinePhotoCount = troublePhotosBase64.length + beforePhotosBase64.length + afterPhotosBase64.length;
        
        const offlineWoIdForFilename = workOrder.customerWoId || String(workOrder.id);
        const formatPhotosForOffline = (photos: string[], prefix: string) => {
          return photos.map((b64, idx) => ({
            base64: b64.startsWith('data:') ? b64 : `data:image/jpeg;base64,${b64}`,
            filename: `${offlineWoIdForFilename}-${prefix}-${idx + 1}.jpg`,
          }));
        };
        
        const offlineMobilePayload = canChange ? {
          projectId: Number(projectId),
          oldSystemReading: parseReading(formData.oldSystemReading),
          oldModuleId: workOrder.oldModuleId || null,
          oldModuleRead: parseReading(formData.oldModuleRead),
          newSystemId: formData.newSystemId,
          newSystemReading: parseReading(formData.newSystemReading) ?? 0,
          newModuleId: formData.newModuleId || null,
          newModuleRead: parseReading(formData.newModuleRead),
          gpsCoordinates: formData.gpsCoordinates || null,
          signatureData: formData.signatureData || null,
          signatureName: formData.signatureName,
          completedAt: completedAt,
          notes: formData.notes || null,
          beforePhotos: formatPhotosForOffline(beforePhotosBase64, 'before'),
          afterPhotos: formatPhotosForOffline(afterPhotosBase64, 'after'),
        } : {
          projectId: Number(projectId),
          troubleCode: getTroubleCodeFromDisplay(formData.troubleCode),
          notes: formData.troubleNote || null,
          oldSystemReading: parseReading(formData.oldSystemReading),
          oldModuleId: workOrder.oldModuleId || null,
          oldModuleRead: parseReading(formData.oldModuleRead),
          photos: formatPhotosForOffline(troublePhotosBase64, 'trouble'),
        };
        
        await addPendingAction({
          type: "complete",
          workOrderId: String(workOrder.id),
          workOrderTitle: workOrder.serviceAddress,
          data: offlineMobilePayload,
          photoCount: offlinePhotoCount,
          completionMode: canChange ? "complete" : "trouble",
        });
        
        updateWorkOrder(workOrder.id, {
          status: canChange ? "Completed" : "Trouble",
          syncPending: true,
          oldSystemReading: formData.oldSystemReading,
          oldModuleRead: formData.oldModuleRead,
          completedAt: completedAt,
          completedBy: user?.id,
          completedByUsername: user?.displayName || user?.username,
          ...(canChange ? {
            newSystemId: formData.newSystemId,
            newSystemReading: formData.newSystemReading,
            newModuleId: formData.newModuleId,
            newModuleRead: formData.newModuleRead,
            newGps: formData.gpsCoordinates,
            notes: formData.notes,
            beforePhotos: formatPhotosForOffline(beforePhotosBase64, 'before'),
            afterPhotos: formatPhotosForOffline(afterPhotosBase64, 'after'),
          } : {
            troubleCode: getTroubleCodeFromDisplay(formData.troubleCode),
            notes: formData.troubleNote,
            troublePhotos: formatPhotosForOffline(troublePhotosBase64, 'trouble'),
          }),
        }, workOrder);
      }

      // Navigate back to the work orders list
      // Use reset to handle cases where wizard was opened via replace() from scanner
      // Set nested state to ensure Work Orders tab is selected
      navigation.reset({
        index: 0,
        routes: [{ 
          name: "Main",
          state: {
            index: 0,
            routes: [{ name: "WorkOrdersStack" }]
          }
        }],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to complete work order";
      
      if (isOnline && serverUrl && projectId) {
        const totalPhotoCount = (formData.troublePhotos?.length || 0) + 
          (formData.beforePhotos?.length || 0) + 
          (formData.afterPhotos?.length || 0);
        try {
          await addDirectSubmissionHistory({
            workOrderIds: [String(workOrder.id)],
            workOrderTitles: [workOrder.serviceAddress],
            status: "failed",
            successCount: 0,
            failedCount: 1,
            photoCount: totalPhotoCount,
            errorMessage: message,
          });
        } catch (historyError) {
          console.warn("[WorkflowWizard] Failed to record sync history:", historyError);
        }
      }
      
      if (Platform.OS === "web") {
        alert(message);
      } else {
        Alert.alert("Error", message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderPhotoGrid = (photos: PhotoAsset[], photoType: "before" | "after" | "trouble") => (
    <View style={styles.photoGrid}>
      {photos.map((photo) => (
        <Pressable 
          key={photo.id} 
          style={styles.photoContainer}
          onPress={() => setViewingPhoto({ uri: photo.uri, type: photoType, id: photo.id })}
        >
          <Image source={{ uri: photo.uri }} style={styles.photoThumbnail} />
          <View style={styles.photoOverlay}>
            <Icon name="maximize-2" size={16} color="#FFFFFF" />
          </View>
        </Pressable>
      ))}
    </View>
  );

  const handleDeleteViewingPhoto = () => {
    if (viewingPhoto) {
      removePhoto(viewingPhoto.type, viewingPhoto.id);
      setViewingPhoto(null);
    }
  };

  const renderStepInput = () => {
    switch (currentStep) {
      case "canChange":
        return (
          <View style={styles.decisionContainer}>
            <View style={[styles.woDetailsCard, { backgroundColor: theme.backgroundSecondary, padding: Spacing.md }]}>
              <View style={[styles.detailRow, { flexDirection: "row", justifyContent: "space-between" }]}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Work Order</ThemedText>
                <ThemedText type="body" style={{ fontWeight: "500" }}>{workOrder.customerWoId}</ThemedText>
              </View>
              <View style={[styles.detailRow, { flexDirection: "row", justifyContent: "space-between", marginTop: Spacing.sm }]}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Address</ThemedText>
                <ThemedText type="body" style={{ fontWeight: "600", flex: 1, textAlign: "right" }} numberOfLines={2}>{workOrder.serviceAddress}</ThemedText>
              </View>
              <View style={[styles.detailRow, { flexDirection: "row", justifyContent: "space-between", marginTop: Spacing.sm }]}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Old System ID</ThemedText>
                <ThemedText type="body" style={{ fontWeight: "600", color: theme.primary }}>{workOrder.oldSystemId || "N/A"}</ThemedText>
              </View>
              {workOrder.oldModuleId ? (
                <View style={[styles.detailRow, { flexDirection: "row", justifyContent: "space-between", marginTop: Spacing.sm }]}>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>Old Module ID</ThemedText>
                  <ThemedText type="body" style={{ fontWeight: "600", color: theme.primary }}>{workOrder.oldModuleId}</ThemedText>
                </View>
              ) : null}
              <View style={[styles.detailRow, { flexDirection: "row", justifyContent: "space-between", marginTop: Spacing.sm }]}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Status</ThemedText>
                <ThemedText type="body" style={{ color: workOrder.status === "Trouble" ? theme.warning : theme.text, fontWeight: "500" }}>
                  {workOrder.status}
                </ThemedText>
              </View>
              {workOrder.notes?.trim() ? (
                <Pressable 
                  onPress={() => setShowNotesModal(true)}
                  style={({ pressed }) => [
                    { 
                      marginTop: Spacing.md, 
                      paddingVertical: Spacing.xs, 
                      paddingHorizontal: Spacing.sm, 
                      backgroundColor: theme.backgroundDefault, 
                      borderRadius: 6,
                      flexDirection: "row",
                      alignItems: "center",
                      alignSelf: "flex-start",
                      opacity: pressed ? 0.7 : 1,
                    }
                  ]}
                >
                  <Icon name="file-text" size={14} color={theme.primary} style={{ marginRight: Spacing.xs }} />
                  <ThemedText type="small" style={{ color: theme.primary, fontWeight: "500" }}>Notes</ThemedText>
                </Pressable>
              ) : null}
            </View>
            
            <View style={styles.decisionButtons}>
              <Pressable
                style={[
                  styles.decisionButton,
                  { backgroundColor: formData.canChange === false ? theme.error : theme.backgroundSecondary, padding: Spacing.lg }
                ]}
                onPress={() => setFormData(prev => ({ ...prev, canChange: false }))}
              >
                <Icon name="x-circle" size={32} color={formData.canChange === false ? "#FFFFFF" : theme.error} />
                <ThemedText 
                  type="body" 
                  style={{ color: formData.canChange === false ? "#FFFFFF" : theme.text, marginTop: Spacing.sm, textAlign: "center", fontWeight: "600" }}
                >
                  No - Report Issue
                </ThemedText>
              </Pressable>
              
              <Pressable
                style={[
                  styles.decisionButton,
                  { backgroundColor: formData.canChange === true ? theme.success : theme.backgroundSecondary, padding: Spacing.lg }
                ]}
                onPress={() => setFormData(prev => ({ ...prev, canChange: true }))}
              >
                <Icon name="check-circle" size={32} color={formData.canChange === true ? "#FFFFFF" : theme.success} />
                <ThemedText 
                  type="body" 
                  style={{ color: formData.canChange === true ? "#FFFFFF" : theme.text, marginTop: Spacing.sm, textAlign: "center", fontWeight: "600" }}
                >
                  Yes - Proceed
                </ThemedText>
              </Pressable>
            </View>
          </View>
        );

      case "oldReading":
        const hasOldModuleId = Boolean(workOrder.oldModuleId);
        const oldSystemType = workOrder.oldSystemType || (workOrder as any).old_system_type;
        const oldModuleType = workOrder.oldModuleType || (workOrder as any).old_module_type;
        
        return (
          <View>
            <View style={styles.iconHeader}>
              <Icon name="tool" size={48} color={theme.primary} />
            </View>
            <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.lg, textAlign: "center" }}>
              Record the final readings from the old system{hasOldModuleId ? " and module" : ""} before removal.
            </ThemedText>
            
            <ThemedText type="body" style={{ fontWeight: "600", marginBottom: Spacing.xs }}>
              Old System Final Reading
            </ThemedText>
            <TextInput
              value={formData.oldSystemReading}
              onChangeText={(text) => {
                setFormData(prev => ({ ...prev, oldSystemReading: text }));
                setOldSystemReadingTouched(true);
              }}
              onFocus={() => {
                setFormData(prev => ({ ...prev, oldSystemReading: "" }));
                setOldSystemReadingTouched(false);
              }}
              placeholder="Enter reading (e.g., 12345)"
              keyboardType="numeric"
              style={{ fontSize: 24, fontWeight: "600", textAlign: "center", paddingVertical: Spacing.md, minHeight: 50 }}
            />
            {!oldSystemReadingTouched && formData.oldSystemReading.trim().length > 0 ? (
              <ThemedText type="small" style={{ color: theme.warning, marginTop: Spacing.xs }}>
                Tap to clear and re-enter the reading
              </ThemedText>
            ) : null}
            
            {hasOldModuleId ? (
              <View style={{ marginTop: Spacing.lg }}>
                <ThemedText type="body" style={{ fontWeight: "600", marginBottom: Spacing.xs }}>
                  Old Module Final Reading
                </ThemedText>
                <TextInput
                  value={formData.oldModuleRead}
                  onChangeText={(text) => {
                    setFormData(prev => ({ ...prev, oldModuleRead: text }));
                    setOldModuleReadingTouched(true);
                  }}
                  onFocus={() => {
                    setFormData(prev => ({ ...prev, oldModuleRead: "" }));
                    setOldModuleReadingTouched(false);
                  }}
                  placeholder="Enter module reading"
                  keyboardType="numeric"
                  style={{ fontSize: 24, fontWeight: "600", textAlign: "center", paddingVertical: Spacing.md, minHeight: 50 }}
                />
                {!oldModuleReadingTouched && formData.oldModuleRead.trim().length > 0 ? (
                  <ThemedText type="small" style={{ color: theme.warning, marginTop: Spacing.xs }}>
                    Tap to clear and re-enter the reading
                  </ThemedText>
                ) : null}
              </View>
            ) : null}
            
            {oldSystemType ? (
              <View style={{ marginTop: Spacing.lg, padding: Spacing.md, backgroundColor: theme.backgroundSecondary, borderRadius: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
                  <Icon name="check-circle" size={18} color={theme.success} />
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>Verify Old System Type</ThemedText>
                </View>
                <ThemedText type="h4" style={{ fontWeight: "600", marginTop: Spacing.xs }}>{oldSystemType}</ThemedText>
              </View>
            ) : null}
            
            {oldModuleType ? (
              <View style={{ marginTop: Spacing.md, padding: Spacing.md, backgroundColor: theme.backgroundSecondary, borderRadius: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
                  <Icon name="check-circle" size={18} color={theme.success} />
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>Verify Old Module Type</ThemedText>
                </View>
                <ThemedText type="h4" style={{ fontWeight: "600", marginTop: Spacing.xs }}>{oldModuleType}</ThemedText>
              </View>
            ) : null}
          </View>
        );

      case "beforePhotos":
        return (
          <View>
            <View style={styles.iconHeader}>
              <Icon name="camera" size={48} color={theme.primary} />
            </View>
            <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.lg, textAlign: "center" }}>
              Take photos of the old system before removal (minimum 1 required)
            </ThemedText>
            
            <Button
              onPress={() => takePhoto("before")}
              style={{ backgroundColor: theme.primary, marginBottom: Spacing.md }}
            >
              <Icon name="camera" size={18} color="#FFFFFF" style={{ marginRight: Spacing.sm }} />
              Take Before Photo
            </Button>
            
            {formData.beforePhotos.length > 0 && renderPhotoGrid(formData.beforePhotos, "before")}
            
            <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
              {formData.beforePhotos.length} photo(s) captured
            </ThemedText>
          </View>
        );

      case "physicalChange":
        const physicalHasModule = Boolean(workOrder.oldModuleId) && formData.oldModuleRead.trim().length > 0;
        return (
          <View>
            <View style={styles.iconHeader}>
              <Icon name="tool" size={48} color={theme.primary} />
            </View>
            <ThemedText type="h4" style={{ marginBottom: Spacing.lg, textAlign: "center" }}>
              Safely remove the old system and install the new system
            </ThemedText>
            
            <View style={[styles.summaryCard, { backgroundColor: theme.backgroundSecondary, padding: Spacing.lg }]}>
              <View style={styles.summaryRow}>
                <Icon name="check-circle" size={24} color={theme.success} />
                <ThemedText type="body" style={{ fontWeight: "500" }}>Old System Reading: <ThemedText type="body" style={{ fontWeight: "600" }}>{formData.oldSystemReading}</ThemedText></ThemedText>
              </View>
              {physicalHasModule ? (
                <View style={[styles.summaryRow, { marginTop: Spacing.md }]}>
                  <Icon name="check-circle" size={24} color={theme.success} />
                  <ThemedText type="body" style={{ fontWeight: "500" }}>Old Module Reading: <ThemedText type="body" style={{ fontWeight: "600" }}>{formData.oldModuleRead}</ThemedText></ThemedText>
                </View>
              ) : null}
              <View style={[styles.summaryRow, { marginTop: Spacing.md }]}>
                <Icon name="check-circle" size={24} color={theme.success} />
                <ThemedText type="body" style={{ fontWeight: "500" }}>{formData.beforePhotos.length} Before Photo(s) Captured</ThemedText>
              </View>
            </View>
            
            <ThemedText type="body" style={{ color: theme.primary, marginTop: Spacing.xl, textAlign: "center", fontWeight: "500" }}>
              Tap "Next" when the new system is installed
            </ThemedText>
          </View>
        );

      case "newSystemId":
        if (showScanner) {
          const permissionDenied = cameraPermission && !cameraPermission.granted && !cameraPermission.canAskAgain;
          
          return (
            <View style={styles.scannerContainer}>
              {cameraPermission?.granted ? (
                <CameraView
                  style={styles.camera}
                  facing="back"
                  barcodeScannerSettings={{
                    barcodeTypes: scannerType === "barcode" 
                      ? ["code128", "code39", "ean13", "ean8", "upc_a", "upc_e", "itf14", "codabar"]
                      : ["qr", "datamatrix"],
                  }}
                  onBarcodeScanned={handleBarcodeScanned}
                />
              ) : (
                <View style={styles.cameraPlaceholder}>
                  <Icon name="camera-off" size={48} color={theme.textSecondary} />
                  <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md, textAlign: "center" }}>
                    {permissionDenied 
                      ? "Camera access denied. Please enable in Settings."
                      : "Camera permission required"
                    }
                  </ThemedText>
                  {permissionDenied ? (
                    <Button
                      onPress={openSettings}
                      style={{ backgroundColor: theme.primary, marginTop: Spacing.lg }}
                    >
                      Open Settings
                    </Button>
                  ) : (
                    <Button
                      onPress={requestCameraPermission}
                      style={{ backgroundColor: theme.primary, marginTop: Spacing.lg }}
                    >
                      Grant Permission
                    </Button>
                  )}
                </View>
              )}
              {cameraPermission?.granted ? (
                <View style={styles.scannerOverlay}>
                  <View style={[
                    styles.scanRegion, 
                    { 
                      borderColor: detectedBarcode ? theme.success : theme.primary,
                      borderWidth: detectedBarcode ? 3 : 2,
                      width: scannerType === "qr" ? 200 : 280,
                      height: scannerType === "qr" ? 200 : 100,
                    }
                  ]} />
                </View>
              ) : null}
              
              {detectedBarcode ? (
                <View style={styles.detectedBarcodeSection}>
                  <View style={[styles.detectedBarcodeBox, { backgroundColor: theme.backgroundSecondary }]}>
                    <Icon name="check-circle" size={20} color={theme.success} />
                    <ThemedText type="body" style={{ fontWeight: "600", fontSize: 18, marginLeft: Spacing.sm }}>
                      {detectedBarcode}
                    </ThemedText>
                  </View>
                  <ThemedText type="body" style={{ textAlign: "center", marginTop: Spacing.md }}>
                    Is this the correct system ID?
                  </ThemedText>
                  <View style={styles.scannerButtonRow}>
                    <Button
                      onPress={handleClearBarcode}
                      style={{ backgroundColor: theme.backgroundSecondary, flex: 1 }}
                    >
                      <Icon name="refresh-cw" size={18} color={theme.text} style={{ marginRight: Spacing.sm }} />
                      <ThemedText>Scan Again</ThemedText>
                    </Button>
                    <Button
                      onPress={handleCaptureBarcode}
                      style={{ backgroundColor: theme.success, flex: 1 }}
                    >
                      <Icon name="check" size={18} color="#FFFFFF" style={{ marginRight: Spacing.sm }} />
                      <ThemedText style={{ color: "#FFFFFF", fontWeight: "600" }}>Capture</ThemedText>
                    </Button>
                  </View>
                </View>
              ) : (
                <View style={styles.scannerInstructions}>
                  <ThemedText type="body" style={{ textAlign: "center" }}>
                    Position {scannerType === "qr" ? "QR code" : "barcode"} within the frame
                  </ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.xs }}>
                    Waiting to detect code...
                  </ThemedText>
                </View>
              )}
              
              <Button
                onPress={handleCancelScanner}
                style={{ backgroundColor: theme.backgroundSecondary, marginTop: Spacing.md }}
              >
                <ThemedText>Cancel Scan</ThemedText>
              </Button>
            </View>
          );
        }

        return (
          <View>
            <View style={styles.iconHeader}>
              <Icon name="hash" size={48} color={theme.primary} />
            </View>
            <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.lg, textAlign: "center" }}>
              Scan or enter the new system ID
            </ThemedText>
            
            <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
              Scan with camera:
            </ThemedText>
            <View style={styles.scanButtonsRow}>
              <Pressable
                style={[styles.scanButton, { backgroundColor: theme.backgroundSecondary }]}
                onPress={() => { setScannerType("barcode"); setDetectedBarcode(null); setShowScanner(true); }}
              >
                <Icon name="maximize" size={32} color={theme.primary} />
                <ThemedText type="body" style={{ marginTop: Spacing.sm, fontWeight: "500" }}>Scan Barcode</ThemedText>
              </Pressable>
              
              <Pressable
                style={[styles.scanButton, { backgroundColor: theme.backgroundSecondary }]}
                onPress={() => { setScannerType("qr"); setDetectedBarcode(null); setShowScanner(true); }}
              >
                <Icon name="grid" size={32} color={theme.primary} />
                <ThemedText type="body" style={{ marginTop: Spacing.sm, fontWeight: "500" }}>Scan QR Code</ThemedText>
              </Pressable>
            </View>
            
            <ThemedText type="body" style={{ color: theme.textSecondary, marginVertical: Spacing.lg, textAlign: "center" }}>
              or enter manually
            </ThemedText>
            
            <TextInput
              value={formData.newSystemId}
              onChangeText={(text) => setFormData(prev => ({ ...prev, newSystemId: text }))}
              placeholder="Type or use HID scanner"
              autoCapitalize="characters"
              style={{ fontSize: 24, fontWeight: "600", textAlign: "center", paddingVertical: Spacing.lg, minHeight: 60 }}
            />
            <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.sm, textAlign: "center" }}>
              Tap field and scan with Bluetooth/USB barcode gun
            </ThemedText>
          </View>
        );

      case "newReading":
        return (
          <View>
            <View style={styles.iconHeader}>
              <Icon name="activity" size={48} color={theme.primary} />
            </View>
            <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.lg, textAlign: "center" }}>
              Enter the initial reading from the new system (usually 0)
            </ThemedText>
            <TextInput
              value={formData.newSystemReading}
              onChangeText={(text) => setFormData(prev => ({ ...prev, newSystemReading: text }))}
              placeholder="Enter reading (usually 0)"
              keyboardType="numeric"
              style={{ fontSize: 24, fontWeight: "600", textAlign: "center", paddingVertical: Spacing.lg, minHeight: 60 }}
            />
            
            {(workOrder.newSystemType || (workOrder as any).new_system_type) ? (
              <View style={{ marginTop: Spacing.xl, padding: Spacing.lg, backgroundColor: theme.backgroundSecondary, borderRadius: 12 }}>
                <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.xs }}>
                  Verify New System Type
                </ThemedText>
                <ThemedText type="h4" style={{ fontWeight: "600" }}>
                  {workOrder.newSystemType || (workOrder as any).new_system_type}
                </ThemedText>
              </View>
            ) : null}
          </View>
        );

      case "afterPhotos":
        return (
          <View>
            <View style={styles.iconHeader}>
              <Icon name="camera" size={48} color={theme.primary} />
            </View>
            <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.lg, textAlign: "center" }}>
              Take photos of the new system after installation (minimum 1 required)
            </ThemedText>
            
            <Button
              onPress={() => takePhoto("after")}
              style={{ backgroundColor: theme.primary, marginBottom: Spacing.md }}
            >
              <Icon name="camera" size={18} color="#FFFFFF" style={{ marginRight: Spacing.sm }} />
              Take After Photo
            </Button>
            
            {formData.afterPhotos.length > 0 && renderPhotoGrid(formData.afterPhotos, "after")}
            
            <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
              {formData.afterPhotos.length} photo(s) captured
            </ThemedText>
          </View>
        );

      case "gps":
        return (
          <View>
            <View style={styles.iconHeader}>
              <Icon name="map-pin" size={48} color={theme.primary} />
            </View>
            <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.lg, textAlign: "center" }}>
              Capture GPS coordinates of the system location
            </ThemedText>
            
            <Button
              onPress={captureGps}
              style={{ backgroundColor: theme.primary, marginBottom: Spacing.md }}
              disabled={isCapturingGps}
            >
              {isCapturingGps ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Icon name="navigation" size={18} color="#FFFFFF" style={{ marginRight: Spacing.sm }} />
                  Get Current Location
                </>
              )}
            </Button>
            
            {formData.gpsCoordinates ? (
              <View style={[styles.gpsResult, { backgroundColor: theme.backgroundSecondary }]}>
                <Icon name="check-circle" size={20} color={theme.success} />
                <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>{formData.gpsCoordinates}</ThemedText>
              </View>
            ) : null}
            
            <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: Spacing.lg, marginBottom: Spacing.sm }}>
              Or enter manually (lat,lng)
            </ThemedText>
            <TextInput
              value={formData.gpsCoordinates}
              onChangeText={(text) => setFormData(prev => ({ ...prev, gpsCoordinates: text }))}
              placeholder="e.g., 37.7749,-122.4194"
            />
          </View>
        );

      case "signature":
        return (
          <View>
            <View style={styles.iconHeader}>
              <Icon name="edit-3" size={48} color={theme.primary} />
            </View>
            
            <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.lg, textAlign: "center" }}>
              Sign the Work Order
            </ThemedText>
            
            <SignaturePad
              onSignatureChange={(data) => setFormData(prev => ({ ...prev, signatureData: data }))}
              height={180}
            />
            
            <View style={{ marginTop: Spacing.lg }}>
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
                Signed By (Required)
              </ThemedText>
              <TextInput
                value={formData.signatureName}
                onChangeText={(text) => setFormData(prev => ({ ...prev, signatureName: text }))}
                placeholder="Enter printed name"
              />
            </View>
          </View>
        );

      case "notes":
        return (
          <View>
            <View style={styles.iconHeader}>
              <Icon name="file-text" size={48} color={theme.primary} />
            </View>
            
            <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.lg, textAlign: "center" }}>
              Add any additional notes (optional)
            </ThemedText>
            
            <TextInput
              value={formData.notes}
              onChangeText={(text) => setFormData(prev => ({ ...prev, notes: text }))}
              placeholder="Enter notes here..."
              multiline
            />
          </View>
        );

      case "confirm":
        return (
          <View>
            <View style={styles.iconHeader}>
              <Icon name="check-circle" size={48} color={theme.success} />
            </View>
            <ThemedText type="h3" style={{ marginBottom: Spacing.lg, textAlign: "center" }}>Review & Submit</ThemedText>
            
            <View style={[styles.summaryCard, { backgroundColor: theme.backgroundSecondary, padding: Spacing.lg }]}>
              <View style={styles.summaryRow}>
                <Icon name="activity" size={20} color={theme.primary} />
                <ThemedText type="body">Old Reading: <ThemedText type="body" style={{ fontWeight: "600" }}>{formData.oldSystemReading}</ThemedText></ThemedText>
              </View>
              <View style={[styles.summaryRow, { marginTop: Spacing.md }]}>
                <Icon name="camera" size={20} color={theme.primary} />
                <ThemedText type="body">{formData.beforePhotos.length} Before Photo(s)</ThemedText>
              </View>
              <View style={[styles.summaryRow, { marginTop: Spacing.md }]}>
                <Icon name="hash" size={20} color={theme.primary} />
                <ThemedText type="body">New System: <ThemedText type="body" style={{ fontWeight: "600" }}>{formData.newSystemId}</ThemedText></ThemedText>
              </View>
              <View style={[styles.summaryRow, { marginTop: Spacing.md }]}>
                <Icon name="activity" size={20} color={theme.primary} />
                <ThemedText type="body">New Reading: <ThemedText type="body" style={{ fontWeight: "600" }}>{formData.newSystemReading}</ThemedText></ThemedText>
              </View>
              <View style={[styles.summaryRow, { marginTop: Spacing.md }]}>
                <Icon name="camera" size={20} color={theme.primary} />
                <ThemedText type="body">{formData.afterPhotos.length} After Photo(s)</ThemedText>
              </View>
              <View style={[styles.summaryRow, { marginTop: Spacing.md }]}>
                <Icon name="map-pin" size={20} color={theme.primary} />
                <ThemedText type="body" numberOfLines={1}>GPS: {formData.gpsCoordinates}</ThemedText>
              </View>
              <View style={[styles.summaryRow, { marginTop: Spacing.md }]}>
                <Icon name="user" size={20} color={theme.primary} />
                <ThemedText type="body">Signed By: <ThemedText type="body" style={{ fontWeight: "600" }}>{formData.signatureName}</ThemedText></ThemedText>
              </View>
              {formData.notes ? (
                <View style={[styles.summaryRow, { marginTop: Spacing.md }]}>
                  <Icon name="file-text" size={20} color={theme.primary} />
                  <ThemedText type="body" numberOfLines={2}>Notes: {formData.notes}</ThemedText>
                </View>
              ) : null}
            </View>
          </View>
        );

      case "troubleCapture":
        return (
          <View>
            <View style={styles.iconHeader}>
              <Icon name="alert-triangle" size={48} color={theme.warning} />
            </View>
            <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.lg, textAlign: "center" }}>
              Select a trouble code and take at least one photo
            </ThemedText>
            
            <SelectInput
              value={formData.troubleCode}
              options={troubleCodeDisplayStrings}
              onSelect={(displayValue) => setFormData(prev => ({ ...prev, troubleCode: displayValue }))}
              placeholder="Select trouble code"
            />
            
            <View style={{ marginTop: Spacing.lg }}>
              <Button
                onPress={() => takePhoto("trouble")}
                style={{ backgroundColor: theme.primary, marginBottom: Spacing.md }}
              >
                <Icon name="camera" size={18} color="#FFFFFF" style={{ marginRight: Spacing.sm }} />
                Take Photo
              </Button>
              
              {formData.troublePhotos.length > 0 && renderPhotoGrid(formData.troublePhotos, "trouble")}
              
              <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
                {formData.troublePhotos.length} photo(s) captured (minimum 1 required)
              </ThemedText>
            </View>
            
            <View style={{ marginTop: Spacing.lg }}>
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
                Additional Notes (Optional)
              </ThemedText>
              <TextInput
                value={formData.troubleNote}
                onChangeText={(text) => setFormData(prev => ({ ...prev, troubleNote: text }))}
                placeholder="Describe the issue..."
                multiline
              />
            </View>
          </View>
        );

      case "troubleConfirm":
        return (
          <View>
            <View style={styles.iconHeader}>
              <Icon name="alert-triangle" size={48} color={theme.warning} />
            </View>
            <ThemedText type="h3" style={{ marginBottom: Spacing.lg, textAlign: "center" }}>Review & Submit</ThemedText>
            
            <View style={[styles.summaryCard, { backgroundColor: theme.backgroundSecondary, padding: Spacing.lg }]}>
              <View style={styles.summaryRow}>
                <Icon name="alert-triangle" size={20} color={theme.warning} />
                <ThemedText type="body">Trouble: <ThemedText type="body" style={{ fontWeight: "600" }}>{formData.troubleCode}</ThemedText></ThemedText>
              </View>
              <View style={[styles.summaryRow, { marginTop: Spacing.md }]}>
                <Icon name="camera" size={20} color={theme.primary} />
                <ThemedText type="body">{formData.troublePhotos.length} Photo(s) Captured</ThemedText>
              </View>
              {formData.troubleNote ? (
                <View style={[styles.summaryRow, { marginTop: Spacing.md }]}>
                  <Icon name="file-text" size={20} color={theme.primary} />
                  <ThemedText type="body" numberOfLines={2}>{formData.troubleNote}</ThemedText>
                </View>
              ) : null}
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  if (isClaiming) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <ThemedText type="body" style={{ marginTop: Spacing.lg, color: theme.textSecondary }}>
          Claiming work order...
        </ThemedText>
      </View>
    );
  }

  if (claimError) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <Icon name="alert-circle" size={48} color={theme.error} />
        <ThemedText type="h4" style={{ marginTop: Spacing.lg, color: theme.error, textAlign: "center" }}>
          Could not claim work order
        </ThemedText>
        <ThemedText type="body" style={{ marginTop: Spacing.sm, color: theme.textSecondary, textAlign: "center", paddingHorizontal: Spacing.xl }}>
          {claimError}
        </ThemedText>
        <Button
          onPress={handleRetryClaimOrCancel}
          style={{ marginTop: Spacing.xl, backgroundColor: theme.primary }}
        >
          Go Back
        </Button>
      </View>
    );
  }

  const getStepRequiredLabel = () => {
    switch (currentStep) {
      case "physicalChange":
        return null;
      default:
        return (
          <ThemedText type="caption" style={[styles.requiredText, { color: theme.error }]}>
            Required
          </ThemedText>
        );
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.progressContainer, { backgroundColor: theme.backgroundDefault }]}>
        <View style={styles.progressInfo}>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            Step {currentStepIndex + 1} of {totalSteps}
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.primary }}>
            {Math.round(((currentStepIndex + 1) / totalSteps) * 100)}%
          </ThemedText>
        </View>
        <View style={styles.progressDotsContainer}>
          {steps.map((_, index) => (
            <View
              key={index}
              style={[
                styles.progressDot,
                {
                  backgroundColor: index === currentStepIndex 
                    ? theme.primary 
                    : index < currentStepIndex 
                      ? theme.success
                      : theme.border,
                  width: index === currentStepIndex ? 24 : 8,
                  opacity: index < currentStepIndex ? 0.6 : 1,
                }
              ]}
            />
          ))}
        </View>
      </View>

      <KeyboardAwareScrollViewCompat
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Spacing["5xl"] + 80 },
        ]}
      >
        <View style={[styles.stepCard, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText type="h3" style={styles.stepTitle}>{STEP_TITLES[currentStep]}</ThemedText>
          {getStepRequiredLabel()}
          
          <View style={styles.inputContainer}>
            {renderStepInput()}
          </View>
        </View>
      </KeyboardAwareScrollViewCompat>

      <View style={[
        styles.bottomActions,
        { 
          backgroundColor: theme.backgroundRoot,
          paddingBottom: insets.bottom + Spacing.lg,
        }
      ]}>
        <View style={styles.buttonRow}>
          {!isFirstStep ? (
            <Button
              onPress={handlePrevious}
              style={[styles.secondaryButton, { backgroundColor: theme.backgroundSecondary }]}
              disabled={isSubmitting}
            >
              <ThemedText style={{ color: theme.text }}>Previous</ThemedText>
            </Button>
          ) : (
            <View style={styles.buttonPlaceholder} />
          )}
          
          <Button
            onPress={handleNext}
            style={[styles.primaryButton, { backgroundColor: theme.primary }]}
            disabled={!isCurrentStepValid() || isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : isLastStep ? (
              "Submit"
            ) : (
              "Next"
            )}
          </Button>
        </View>
      </View>

      <PhotoViewer
        visible={viewingPhoto !== null}
        photoUri={viewingPhoto?.uri || null}
        onClose={() => setViewingPhoto(null)}
        onDelete={handleDeleteViewingPhoto}
      />

      <Modal
        visible={showNotesModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNotesModal(false)}
      >
        <Pressable 
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: Spacing.lg }}
          onPress={() => setShowNotesModal(false)}
        >
          <Pressable 
            onPress={(e) => e.stopPropagation()}
            style={{ backgroundColor: theme.backgroundRoot, borderRadius: BorderRadius.lg, maxHeight: "70%" }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: theme.border }}>
              <ThemedText type="h4">Notes</ThemedText>
              <Pressable onPress={() => setShowNotesModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Icon name="x" size={24} color={theme.textSecondary} />
              </Pressable>
            </View>
            <ScrollView style={{ padding: Spacing.lg }}>
              <ThemedText type="body" style={{ lineHeight: 22 }}>
                {workOrder.notes || "No notes available."}
              </ThemedText>
            </ScrollView>
            <View style={{ padding: Spacing.lg, borderTopWidth: 1, borderTopColor: theme.border }}>
              <Button onPress={() => setShowNotesModal(false)} style={{ backgroundColor: theme.backgroundSecondary }}>
                <ThemedText>Close</ThemedText>
              </Button>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  progressContainer: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  progressInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressDotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  progressDot: {
    height: 10,
    borderRadius: 5,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  woInfo: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  stepCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  stepTitle: {},
  requiredText: {
    marginBottom: Spacing.md,
  },
  inputContainer: {
    marginTop: Spacing.md,
  },
  decisionContainer: {
    gap: Spacing.lg,
  },
  woDetailsCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  detailRow: {
    gap: Spacing.xs,
  },
  decisionButtons: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  decisionButton: {
    flex: 1,
    padding: Spacing.xl,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  iconHeader: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    justifyContent: "flex-start",
  },
  photoContainer: {
    position: "relative",
    width: 100,
    height: 100,
  },
  photoThumbnail: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius.md,
  },
  photoOverlay: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: BorderRadius.xs,
    padding: 4,
  },
  removePhotoButton: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  scannerContainer: {
    alignItems: "center",
  },
  camera: {
    width: 300,
    height: 300,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  cameraPlaceholder: {
    width: 300,
    height: 300,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
  },
  scannerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 300,
    alignItems: "center",
    justifyContent: "center",
  },
  scanRegion: {
    borderWidth: 2,
    borderRadius: BorderRadius.sm,
    borderStyle: "dashed",
  },
  scanButtonsRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  scanButton: {
    flex: 1,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  gpsResult: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  summaryCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  signaturePlaceholder: {
    height: 120,
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.sm,
  },
  bottomActions: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  buttonRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  secondaryButton: {
    flex: 1,
  },
  primaryButton: {
    flex: 1,
  },
  buttonPlaceholder: {
    flex: 1,
  },
  detectedBarcodeSection: {
    alignItems: "center",
    marginTop: Spacing.lg,
  },
  detectedBarcodeBox: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  scannerButtonRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.md,
    width: "100%",
  },
  scannerInstructions: {
    alignItems: "center",
    marginTop: Spacing.lg,
  },
});
