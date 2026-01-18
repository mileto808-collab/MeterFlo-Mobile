import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, Alert, Platform, ActivityIndicator, Pressable, Image, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Icon } from "@/components/Icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as ImageManipulator from "expo-image-manipulator";
import { CameraView, useCameraPermissions, BarcodeScanningResult } from "expo-camera";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { useWorkOrders, WizardMode } from "@/contexts/WorkOrderContext";
import { useAuth } from "@/contexts/AuthContext";
import { useOffline } from "@/contexts/OfflineContext";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { ThemedText } from "@/components/ThemedText";
import { TextInput } from "@/components/TextInput";
import { Button } from "@/components/Button";
import { SelectInput } from "@/components/SelectInput";
import { SignaturePad } from "@/components/SignaturePad";
import { PhotoViewer } from "@/components/PhotoViewer";
import { WorkflowModeModal, WorkflowModeChoice } from "@/components/WorkflowModeModal";
import { Spacing, BorderRadius } from "@/constants/theme";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type WizardStep = 
  | "workflowMode"
  | "captureType"
  | "oldIds"
  | "canChange"
  | "oldReading"
  | "beforePhotos"
  | "physicalChange"
  | "newIds"
  | "newReading"
  | "afterPhotos"
  | "gps"
  | "notes"
  | "signature"
  | "confirm"
  | "troubleCapture"
  | "troubleConfirm"
  | "readingCapture"
  | "readingConfirm";

type SelectedWorkflowMode = "changeout" | "reading_only";

type CaptureType = "system" | "module" | "both";

interface PhotoAsset {
  uri: string;
  id: string;
}

interface NewWorkOrderData {
  oldSystemId: string;
  oldSystemReading: string;
  oldModuleId: string;
  oldModuleReading: string;
  canChange: boolean | null;
  troubleCode: string;
  troubleNote: string;
  troublePhotos: PhotoAsset[];
  beforePhotos: PhotoAsset[];
  newSystemId: string;
  newSystemReading: string;
  newModuleId: string;
  newModuleReading: string;
  afterPhotos: PhotoAsset[];
  gpsCoordinates: string;
  signatureData: string;
  signatureName: string;
  notes: string;
}

const getChangeoutSteps = (captureType: CaptureType, projectConfig: { wizardShowBeforePhotosStep: boolean; wizardShowAfterPhotosStep: boolean; wizardShowGpsStep: boolean; wizardGpsMode: string; wizardShowNotesStep: boolean; wizardShowSignatureStep: boolean }): WizardStep[] => {
  const steps: WizardStep[] = [
    "captureType",
    "oldIds",
    "canChange",
    "oldReading",
  ];
  
  if (projectConfig.wizardShowBeforePhotosStep) {
    steps.push("beforePhotos");
  }
  
  steps.push("physicalChange", "newIds", "newReading");
  
  if (projectConfig.wizardShowAfterPhotosStep) {
    steps.push("afterPhotos");
  }
  
  if (projectConfig.wizardShowGpsStep && projectConfig.wizardGpsMode === "manual") {
    steps.push("gps");
  }
  
  if (projectConfig.wizardShowNotesStep) {
    steps.push("notes");
  }
  
  if (projectConfig.wizardShowSignatureStep) {
    steps.push("signature");
  }
  
  steps.push("confirm");
  
  return steps;
};

const getReadingOnlySteps = (projectConfig: { wizardShowBeforePhotosStep: boolean; wizardShowAfterPhotosStep: boolean; wizardShowGpsStep: boolean; wizardGpsMode: string; wizardShowNotesStep: boolean; wizardShowSignatureStep: boolean }): WizardStep[] => {
  const steps: WizardStep[] = [
    "captureType",
    "oldIds",
    "canChange",
  ];
  
  if (projectConfig.wizardShowBeforePhotosStep) {
    steps.push("beforePhotos");
  }
  
  steps.push("readingCapture");
  
  if (projectConfig.wizardShowAfterPhotosStep) {
    steps.push("afterPhotos");
  }
  
  if (projectConfig.wizardShowGpsStep && projectConfig.wizardGpsMode === "manual") {
    steps.push("gps");
  }
  
  if (projectConfig.wizardShowNotesStep) {
    steps.push("notes");
  }
  
  if (projectConfig.wizardShowSignatureStep) {
    steps.push("signature");
  }
  
  steps.push("readingConfirm");
  
  return steps;
};

const getTroubleSteps = (selectedMode: SelectedWorkflowMode): WizardStep[] => {
  // Both reading-only and changeout modes need captureType selection
  return [
    "captureType",
    "oldIds",
    "canChange",
    "troubleCapture",
    "troubleConfirm",
  ];
};

const STEP_TITLES: Record<WizardStep, string> = {
  workflowMode: "What would you like to do?",
  captureType: "What are you replacing?",
  oldIds: "Capture System ID",
  canChange: "Can The Changeout Proceed?",
  oldReading: "Capture Old Reading",
  beforePhotos: "Before Photos",
  physicalChange: "Perform Physical Changeout",
  newIds: "Capture New System ID",
  newReading: "Capture New Reading",
  afterPhotos: "After Photos",
  gps: "Capture GPS",
  notes: "Notes",
  signature: "Capture Signature",
  confirm: "Confirm & Submit",
  troubleCapture: "Report Issue",
  troubleConfirm: "Confirm & Submit",
  readingCapture: "Capture Current Reading",
  readingConfirm: "Confirm & Submit",
};

const READING_MODE_TITLES: Partial<Record<WizardStep, string>> = {
  captureType: "What are you reading?",
  canChange: "Can You Proceed?",
  oldIds: "Capture ID",
  beforePhotos: "Before Photos",
  afterPhotos: "After Photos",
  gps: "Capture GPS",
  notes: "Notes",
  signature: "Capture Signature",
  readingCapture: "Capture Current Reading",
  readingConfirm: "Confirm & Submit Reading",
};

export default function NewWorkOrderWizardScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { projectId, user } = useAuth();
  const { addOfflineWorkOrder, referenceData, projectConfig } = useWorkOrders();
  const { addPendingAction } = useOffline();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerType, setScannerType] = useState<"barcode" | "qr">("barcode");
  const [scannerTarget, setScannerTarget] = useState<"oldSystem" | "oldModule" | "newSystem" | "newModule">("oldSystem");
  const [detectedBarcode, setDetectedBarcode] = useState<string | null>(null);
  const [isCapturingGps, setIsCapturingGps] = useState(false);
  const [startTime, setStartTime] = useState<string | null>(null);
  
  const [showWorkflowModeModal, setShowWorkflowModeModal] = useState(projectConfig.wizardMode === "user_choice");
  const [selectedWorkflowMode, setSelectedWorkflowMode] = useState<SelectedWorkflowMode>(
    projectConfig.wizardMode === "reading_only" ? "reading_only" : "changeout"
  );
  
  const isReadingOnlyMode = selectedWorkflowMode === "reading_only";
  
  // Capture type selection (system/module/both)
  const [captureType, setCaptureType] = useState<CaptureType>("both");
  
  // Capture mode for ID capture screens (tracks which ID is being captured)
  const [oldCaptureMode, setOldCaptureMode] = useState<"system" | "module" | "summary">("system");
  const [newCaptureMode, setNewCaptureMode] = useState<"system" | "module" | "summary">("system");
  
  // Track if ID input is actively focused (prevents Next until Done is pressed)
  const [isIdInputFocused, setIsIdInputFocused] = useState(false);
  
  // Track if reading fields have been touched/re-entered
  const [newSystemReadingTouched, setNewSystemReadingTouched] = useState(false);
  const [newModuleReadingTouched, setNewModuleReadingTouched] = useState(false);
  
  // Reset capture modes when captureType changes
  useEffect(() => {
    if (captureType === "module") {
      // Module-only: start in module capture mode
      setOldCaptureMode("module");
      setNewCaptureMode("module");
    } else {
      // System-only or both: start in system capture mode
      setOldCaptureMode("system");
      setNewCaptureMode("system");
    }
    // Also clear any previously captured IDs when capture type changes
    setFormData(prev => ({
      ...prev,
      oldSystemId: "",
      oldModuleId: "",
      newSystemId: "",
      newModuleId: "",
    }));
  }, [captureType]);
  
  useEffect(() => {
    if (showScanner && !cameraPermission) {
      requestCameraPermission();
    }
  }, [showScanner, cameraPermission, requestCameraPermission]);
  
  const [viewingPhoto, setViewingPhoto] = useState<{ uri: string; type: "before" | "after" | "trouble"; id: string } | null>(null);
  
  const [formData, setFormData] = useState<NewWorkOrderData>({
    oldSystemId: "",
    oldSystemReading: "",
    oldModuleId: "",
    oldModuleReading: "",
    canChange: null,
    troubleCode: "",
    troubleNote: "",
    troublePhotos: [],
    beforePhotos: [],
    newSystemId: "",
    newSystemReading: "",
    newModuleId: "",
    newModuleReading: "",
    afterPhotos: [],
    gpsCoordinates: "",
    signatureData: "",
    signatureName: "",
    notes: "",
  });

  // Determine steps based on canChange decision
  const getSteps = (): WizardStep[] => {
    if (formData.canChange === false) {
      return getTroubleSteps(selectedWorkflowMode);
    }
    
    if (isReadingOnlyMode) {
      return getReadingOnlySteps(projectConfig);
    }
    
    return getChangeoutSteps(captureType, projectConfig);
  };
  
  const steps = getSteps();
  const currentStep = steps[currentStepIndex];
  const totalSteps = steps.length;
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === totalSteps - 1;
  
  // Track startTime when user makes canChange decision (clicks Proceed or Report Issue)
  useEffect(() => {
    if (formData.canChange !== null && !startTime) {
      setStartTime(new Date().toISOString());
    }
  }, [formData.canChange, startTime]);
  
  const getStepTitle = (step: WizardStep): string => {
    if (isReadingOnlyMode && READING_MODE_TITLES[step]) {
      return READING_MODE_TITLES[step]!;
    }
    return STEP_TITLES[step];
  };
  
  const handleWorkflowModeSelect = (mode: WorkflowModeChoice) => {
    setSelectedWorkflowMode(mode);
    setShowWorkflowModeModal(false);
  };
  
  // Derive whether module/system is needed based on captureType
  // In reading-only mode, we still need to track equipment type for readings (old = existing equipment)
  // In changeout mode, we track both old (existing) and new (replacement) equipment
  const hasOldModule = captureType === "module" || captureType === "both";
  const hasNewModule = !isReadingOnlyMode && (captureType === "module" || captureType === "both");
  const hasOldSystem = captureType === "system" || captureType === "both";
  const hasNewSystem = !isReadingOnlyMode && (captureType === "system" || captureType === "both");
  
  // Get trouble codes from reference data
  const troubleCodes = referenceData?.troubleCodes || [];
  const troubleCodeDisplayStrings = troubleCodes.map((tc: { code: string; label: string }) => `${tc.code} - ${tc.label}`);

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
        if (Platform.OS === "web") {
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
      const hasOldSystem = captureType === "system" || captureType === "both";
      const hasOldModule = captureType === "module" || captureType === "both";
      const hasNewSystem = hasOldSystem;
      const hasNewModule = hasOldModule;
      
      if (scannerTarget === "oldSystem") {
        setFormData(prev => ({ ...prev, oldSystemId: detectedBarcode }));
        // Advance to module if needed, otherwise to summary
        if (hasOldModule) {
          setOldCaptureMode("module");
        } else {
          setOldCaptureMode("summary");
        }
      } else if (scannerTarget === "oldModule") {
        setFormData(prev => ({ ...prev, oldModuleId: detectedBarcode }));
        setOldCaptureMode("summary");
      } else if (scannerTarget === "newSystem") {
        setFormData(prev => ({ ...prev, newSystemId: detectedBarcode }));
        // Advance to module if needed, otherwise to summary
        if (hasNewModule) {
          setNewCaptureMode("module");
        } else {
          setNewCaptureMode("summary");
        }
      } else if (scannerTarget === "newModule") {
        setFormData(prev => ({ ...prev, newModuleId: detectedBarcode }));
        setNewCaptureMode("summary");
      }
      setShowScanner(false);
      setDetectedBarcode(null);
      setIsIdInputFocused(false);
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
      
      setFormData(prev => ({ ...prev, gpsCoordinates: coords }));
      
      if (Platform.OS !== "web") {
        Alert.alert(
          "GPS Captured",
          `Coordinates: ${coords}${location.coords.accuracy ? `\nAccuracy: ${location.coords.accuracy.toFixed(1)}m` : ""}`
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

  const captureGpsInBackground = async () => {
    try {
      const permResult = await Location.requestForegroundPermissionsAsync();
      if (!permResult.granted) {
        console.log("[NewWorkOrderWizard] Background GPS capture: permission denied");
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        mayShowUserSettingsDialog: false,
      });

      const coords = `${location.coords.latitude.toFixed(6)},${location.coords.longitude.toFixed(6)}`;
      console.log(`[NewWorkOrderWizard] Background GPS captured: ${coords}`);
      setFormData(prev => ({ ...prev, gpsCoordinates: coords }));
    } catch (error) {
      console.log("[NewWorkOrderWizard] Background GPS capture failed:", error);
    }
  };

  const getTroubleCodeFromDisplay = (displayValue: string): string => {
    const match = displayValue.match(/^([A-Z0-9]+)\s*-/);
    return match ? match[1] : displayValue;
  };

  const filterNumericInput = (value: string): string => {
    let result = "";
    let hasDecimal = false;
    let decimalPlaces = 0;
    for (const char of value) {
      if (char >= "0" && char <= "9") {
        if (hasDecimal) {
          if (decimalPlaces < 3) {
            result += char;
            decimalPlaces++;
          }
        } else {
          result += char;
        }
      } else if ((char === "." || char === ",") && !hasDecimal) {
        result += ".";
        hasDecimal = true;
      }
    }
    return result;
  };

  const isValidNumeric = (value: string): boolean => {
    const trimmed = value.trim();
    if (!trimmed) return false;
    // Use same logic as parseReading - if parseFloat returns a valid number, accept it
    const parsed = parseFloat(trimmed);
    return !Number.isNaN(parsed) && Number.isFinite(parsed);
  };
  
  const isCurrentStepValid = (): boolean => {
    switch (currentStep) {
      case "captureType":
        return true;
      case "oldIds": 
        // System ID required if capturing system or both, module ID required if capturing module or both
        // Also prevent Next while actively typing (input is focused)
        if (isIdInputFocused) return false;
        if (hasOldSystem && !formData.oldSystemId.trim()) return false;
        if (hasOldModule && !formData.oldModuleId.trim()) return false;
        return true;
      case "canChange":
        return formData.canChange !== null;
      case "oldReading": 
        const oldSysValid = !hasOldSystem || isValidNumeric(formData.oldSystemReading);
        const oldModValid = !hasOldModule || isValidNumeric(formData.oldModuleReading);
        return oldSysValid && oldModValid;
      case "beforePhotos":
        return formData.beforePhotos.length >= 1;
      case "physicalChange":
        return true;
      case "newIds": 
        // System ID required if capturing system or both, module ID required if capturing module or both
        // Also prevent Next while actively typing (input is focused)
        if (isIdInputFocused) return false;
        if (hasNewSystem && !formData.newSystemId.trim()) return false;
        if (hasNewModule && !formData.newModuleId.trim()) return false;
        return true;
      case "newReading": 
        const newSysValid = !hasNewSystem || isValidNumeric(formData.newSystemReading);
        const newModValid = !hasNewModule || isValidNumeric(formData.newModuleReading);
        return newSysValid && newModValid;
      case "afterPhotos":
        return formData.afterPhotos.length >= 1;
      case "gps":
        return formData.gpsCoordinates.trim().length > 0;
      case "signature": 
        return formData.signatureData.length > 0 && formData.signatureName.trim().length > 0;
      case "confirm":
        return true;
      case "troubleCapture":
        return formData.troubleCode.trim().length > 0 && formData.troublePhotos.length >= 1;
      case "troubleConfirm":
        return true;
      case "readingCapture":
        // Validate all readings based on equipment type
        const hasSystemForValidation = Boolean(formData.oldSystemId?.trim());
        const hasModuleForValidation = Boolean(formData.oldModuleId?.trim());
        if (hasSystemForValidation && hasModuleForValidation) {
          // Both: validate both readings
          return isValidNumeric(formData.newSystemReading) && isValidNumeric(formData.newModuleReading);
        } else if (hasSystemForValidation) {
          return isValidNumeric(formData.newSystemReading);
        } else {
          // Module only: reading stored in newSystemReading field
          return isValidNumeric(formData.newSystemReading);
        }
      case "readingConfirm":
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

    // Trigger background GPS capture when user clicks "Yes - Proceed" and wizardGpsMode is automatic
    if (currentStep === "canChange" && formData.canChange === true && projectConfig.wizardGpsMode === "automatic") {
      captureGpsInBackground();
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

    const completedAt = new Date().toISOString();
    
    const parseReading = (value: string): number | null => {
      if (!value.trim()) return null;
      const parsed = parseFloat(value);
      return Number.isNaN(parsed) ? null : parsed;
    };

    try {
      let beforePhotosBase64: string[] = [];
      let afterPhotosBase64: string[] = [];
      let totalFailedPhotos = 0;
      
      if (formData.beforePhotos.length > 0) {
        const result = await convertPhotosToBase64(formData.beforePhotos);
        beforePhotosBase64 = result.base64Photos;
        totalFailedPhotos += result.failedCount;
      }
      
      if (formData.afterPhotos.length > 0) {
        const result = await convertPhotosToBase64(formData.afterPhotos);
        afterPhotosBase64 = result.base64Photos;
        totalFailedPhotos += result.failedCount;
      }
      
      if (totalFailedPhotos > 0) {
        const successCount = beforePhotosBase64.length + afterPhotosBase64.length;
        const message = `${totalFailedPhotos} photo(s) could not be processed. ${successCount} photo(s) will be saved. Continue anyway?`;
        
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
      
      const formatPhotosForStorage = (photos: string[], prefix: string) => {
        return photos.map((b64, idx) => ({
          base64: b64.startsWith('data:') ? b64 : `data:image/jpeg;base64,${b64}`,
          filename: `${prefix}_${idx + 1}.jpg`,
        }));
      };
      
      const offlineWorkOrderId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const canChange = formData.canChange;
      
      // Handle trouble photos if in trouble flow
      let troublePhotosBase64: string[] = [];
      if (!canChange && formData.troublePhotos.length > 0) {
        const result = await convertPhotosToBase64(formData.troublePhotos);
        troublePhotosBase64 = result.base64Photos;
        totalFailedPhotos += result.failedCount;
      }
      
      // Only include system/module fields based on what was actually captured
      const includeOldSystem = hasOldSystem && formData.oldSystemId.trim();
      const includeOldModule = hasOldModule && formData.oldModuleId.trim();
      const includeNewSystem = hasNewSystem && formData.newSystemId.trim();
      const includeNewModule = hasNewModule && formData.newModuleId.trim();
      
      // In reading-only mode, newIds = oldIds
      const finalNewSystemId = isReadingOnlyMode ? formData.oldSystemId : (includeNewSystem ? formData.newSystemId : undefined);
      const finalNewModuleId = isReadingOnlyMode ? formData.oldModuleId : (includeNewModule ? formData.newModuleId : undefined);
      
      // Determine new readings based on mode
      // In Reading Only mode, the readingCapture step stores reading in newSystemReading field
      // For module-only work orders, we need to use that value for newModuleReading
      const hasSystemInReadingOnly = isReadingOnlyMode && includeOldSystem;
      const hasModuleInReadingOnly = isReadingOnlyMode && includeOldModule;
      const isModuleOnlyReadingOnly = hasModuleInReadingOnly && !hasSystemInReadingOnly;
      
      // New system reading: send in changeout mode with new system, or reading-only with system
      const finalNewSystemReading = (hasSystemInReadingOnly || includeNewSystem) 
        ? (parseReading(formData.newSystemReading) ?? 0) 
        : undefined;
      
      // New module reading: 
      // - Changeout mode with new module: use newModuleReading field
      // - Reading-only with module-only: use newSystemReading field (that's where wizard captures it)
      // - Reading-only with both system AND module: use newModuleReading field if populated
      const finalNewModuleReading = isModuleOnlyReadingOnly
        ? (parseReading(formData.newSystemReading) ?? 0) // Module-only uses newSystemReading field
        : (hasModuleInReadingOnly || (!isReadingOnlyMode && includeNewModule))
        ? (parseReading(formData.newModuleReading) ?? 0)
        : undefined;
      
      const offlineWorkOrderData = canChange ? {
        id: offlineWorkOrderId,
        projectId: Number(projectId),
        oldSystemId: includeOldSystem ? formData.oldSystemId : undefined,
        oldSystemReading: (!isReadingOnlyMode && includeOldSystem) ? (parseReading(formData.oldSystemReading) ?? 0) : undefined,
        oldModuleId: includeOldModule ? formData.oldModuleId : undefined,
        oldModuleReading: (!isReadingOnlyMode && includeOldModule) ? (parseReading(formData.oldModuleReading) ?? 0) : undefined,
        newSystemId: finalNewSystemId,
        newSystemReading: finalNewSystemReading,
        newModuleId: finalNewModuleId,
        newModuleReading: finalNewModuleReading,
        gpsCoordinates: formData.gpsCoordinates || null,
        signatureData: formData.signatureData || null,
        signatureName: formData.signatureName,
        startTime: startTime || completedAt,
        completedAt: completedAt,
        completedBy: user?.id || null,
        completedByUsername: user?.displayName || user?.username || null,
        notes: formData.notes || null,
        beforePhotos: formatPhotosForStorage(beforePhotosBase64, 'before'),
        afterPhotos: formatPhotosForStorage(afterPhotosBase64, 'after'),
        status: "Completed",
        isOfflineCreated: true,
        syncPending: true,
        isReadingOnly: isReadingOnlyMode,
      } : {
        id: offlineWorkOrderId,
        projectId: Number(projectId),
        oldSystemId: includeOldSystem ? formData.oldSystemId : undefined,
        oldSystemReading: (!isReadingOnlyMode && includeOldSystem) ? (parseReading(formData.oldSystemReading) ?? 0) : undefined,
        oldModuleId: includeOldModule ? formData.oldModuleId : undefined,
        oldModuleReading: (!isReadingOnlyMode && includeOldModule) ? (parseReading(formData.oldModuleReading) ?? 0) : undefined,
        troubleCode: getTroubleCodeFromDisplay(formData.troubleCode),
        notes: formData.troubleNote || null,
        troublePhotos: formatPhotosForStorage(troublePhotosBase64, 'trouble'),
        status: "Trouble",
        isOfflineCreated: true,
        syncPending: true,
        startTime: startTime || completedAt,
        completedAt: completedAt,
        completedBy: user?.id || null,
        completedByUsername: user?.displayName || user?.username || null,
      };
      
      await addOfflineWorkOrder(offlineWorkOrderData);
      
      const photoCount = canChange 
        ? beforePhotosBase64.length + afterPhotosBase64.length
        : troublePhotosBase64.length;
      
      // Use system ID if available, otherwise use module ID as the lookup key for offline storage
      const offlineLookupKey = (formData.oldSystemId?.trim() || formData.oldModuleId?.trim() || "");
      
      // Validate lookup key before creating pending action
      if (!offlineLookupKey) {
        throw new Error("Cannot save offline work order without a system ID or module ID");
      }
      
      await addPendingAction({
        type: "offlineWorkOrder",
        workOrderId: offlineWorkOrderId,
        workOrderTitle: canChange ? `New WO: ${offlineLookupKey}` : `Trouble: ${offlineLookupKey}`,
        data: offlineWorkOrderData,
        photoCount: photoCount,
        lookupKey: offlineLookupKey,
      });

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
      const message = error instanceof Error ? error.message : "Failed to save work order";
      
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

  const renderScannerUI = () => {
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
  };

  const renderIdInput = (target: "oldSystem" | "oldModule" | "newSystem" | "newModule") => {
    const isSystem = target === "oldSystem" || target === "newSystem";
    const isOld = target === "oldSystem" || target === "oldModule";
    const label = isSystem ? "System" : "Module";
    const ageLabel = isOld ? "old" : "new";
    
    const getValue = () => {
      switch (target) {
        case "oldSystem": return formData.oldSystemId;
        case "oldModule": return formData.oldModuleId;
        case "newSystem": return formData.newSystemId;
        case "newModule": return formData.newModuleId;
      }
    };
    
    const setValue = (text: string) => {
      switch (target) {
        case "oldSystem": setFormData(prev => ({ ...prev, oldSystemId: text })); break;
        case "oldModule": setFormData(prev => ({ ...prev, oldModuleId: text })); break;
        case "newSystem": setFormData(prev => ({ ...prev, newSystemId: text })); break;
        case "newModule": setFormData(prev => ({ ...prev, newModuleId: text })); break;
      }
    };
    
    return (
      <View>
        <View style={styles.iconHeader}>
          <Icon name="hash" size={48} color={theme.primary} />
        </View>
        <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.lg, textAlign: "center" }}>
          Scan or enter the {ageLabel} {label.toLowerCase()} ID
        </ThemedText>
        
        {(projectConfig.searchShowBarcodeScan || projectConfig.searchShowQrCodeScan) && (
          <>
            <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
              Scan with camera:
            </ThemedText>
            <View style={styles.scanButtonsRow}>
              {projectConfig.searchShowBarcodeScan && (
                <Pressable
                  style={[styles.scanButton, { backgroundColor: theme.backgroundSecondary }]}
                  onPress={() => { setScannerTarget(target); setScannerType("barcode"); setDetectedBarcode(null); setShowScanner(true); }}
                >
                  <Icon name="maximize" size={32} color={theme.primary} />
                  <ThemedText type="body" style={{ marginTop: Spacing.sm, fontWeight: "500" }}>Scan Barcode</ThemedText>
                </Pressable>
              )}
              
              {projectConfig.searchShowQrCodeScan && (
                <Pressable
                  style={[styles.scanButton, { backgroundColor: theme.backgroundSecondary }]}
                  onPress={() => { setScannerTarget(target); setScannerType("qr"); setDetectedBarcode(null); setShowScanner(true); }}
                >
                  <Icon name="grid" size={32} color={theme.primary} />
                  <ThemedText type="body" style={{ marginTop: Spacing.sm, fontWeight: "500" }}>Scan QR Code</ThemedText>
                </Pressable>
              )}
            </View>
          </>
        )}
        
        {(projectConfig.searchShowManualEntry || projectConfig.searchShowHidScanner) && (
          <>
            {(projectConfig.searchShowBarcodeScan || projectConfig.searchShowQrCodeScan) && (
              <ThemedText type="body" style={{ color: theme.textSecondary, marginVertical: Spacing.lg, textAlign: "center" }}>
                or enter manually
              </ThemedText>
            )}
            
            <TextInput
              value={getValue()}
              onChangeText={setValue}
              placeholder="Type or use HID scanner"
              autoCapitalize="characters"
              style={{ fontSize: 24, fontWeight: "600", textAlign: "center", paddingVertical: Spacing.lg, minHeight: 60 }}
            />
            {projectConfig.searchShowHidScanner && (
              <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.sm, textAlign: "center" }}>
                Tap field and scan with Bluetooth/USB barcode gun
              </ThemedText>
            )}
          </>
        )}
      </View>
    );
  };

  const renderStepInput = () => {
    if (showScanner) {
      return renderScannerUI();
    }
    
    switch (currentStep) {
      case "captureType":
        return (
          <View>
            <View style={styles.iconHeader}>
              <Icon name="layers" size={48} color={theme.primary} />
            </View>
            <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.lg, textAlign: "center" }}>
              {isReadingOnlyMode ? "What equipment are you reading?" : "What equipment are you replacing?"}
            </ThemedText>
            
            <Pressable
              style={[
                styles.captureTypeOption,
                { 
                  backgroundColor: captureType === "system" ? theme.primary : theme.backgroundSecondary,
                  borderColor: captureType === "system" ? theme.primary : theme.border,
                }
              ]}
              onPress={() => setCaptureType("system")}
            >
              <Icon name="database" size={24} color={captureType === "system" ? "#FFFFFF" : theme.text} />
              <ThemedText type="body" style={{ marginLeft: Spacing.md, fontWeight: "600", color: captureType === "system" ? "#FFFFFF" : theme.text }}>
                System Only
              </ThemedText>
            </Pressable>
            
            <Pressable
              style={[
                styles.captureTypeOption,
                { 
                  backgroundColor: captureType === "module" ? theme.primary : theme.backgroundSecondary,
                  borderColor: captureType === "module" ? theme.primary : theme.border,
                  marginTop: Spacing.md,
                }
              ]}
              onPress={() => setCaptureType("module")}
            >
              <Icon name="cpu" size={24} color={captureType === "module" ? "#FFFFFF" : theme.text} />
              <ThemedText type="body" style={{ marginLeft: Spacing.md, fontWeight: "600", color: captureType === "module" ? "#FFFFFF" : theme.text }}>
                Module Only
              </ThemedText>
            </Pressable>
            
            <Pressable
              style={[
                styles.captureTypeOption,
                { 
                  backgroundColor: captureType === "both" ? theme.primary : theme.backgroundSecondary,
                  borderColor: captureType === "both" ? theme.primary : theme.border,
                  marginTop: Spacing.md,
                }
              ]}
              onPress={() => setCaptureType("both")}
            >
              <Icon name="grid" size={24} color={captureType === "both" ? "#FFFFFF" : theme.text} />
              <ThemedText type="body" style={{ marginLeft: Spacing.md, fontWeight: "600", color: captureType === "both" ? "#FFFFFF" : theme.text }}>
                System and Module
              </ThemedText>
            </Pressable>
          </View>
        );

      case "oldIds": {
        const oldIdHelpText = isReadingOnlyMode
          ? "Capture the meter ID by scanning or entering manually."
          : hasOldSystem && hasOldModule 
          ? "Capture the old system and module IDs by scanning or entering manually."
          : hasOldSystem
          ? "Capture the old system ID by scanning or entering manually."
          : "Capture the old module ID by scanning or entering manually.";
          
        const openOldScannerFor = (target: "oldSystem" | "oldModule", type: "barcode" | "qr") => {
          setScannerTarget(target);
          setScannerType(type);
          setDetectedBarcode(null);
          setShowScanner(true);
        };
        
        const clearOldCapturedId = (target: "system" | "module") => {
          if (target === "system") {
            setFormData(prev => ({ ...prev, oldSystemId: "" }));
            setOldCaptureMode("system");
          } else {
            setFormData(prev => ({ ...prev, oldModuleId: "" }));
            if (!formData.oldSystemId.trim() && hasOldSystem) {
              setOldCaptureMode("system");
            } else {
              setOldCaptureMode("module");
            }
          }
        };
        
        const advanceOldSystemIdCapture = (value: string) => {
          setIsIdInputFocused(false);
          if (value.length > 0 && hasOldModule) {
            setOldCaptureMode("module");
          } else if (value.length > 0) {
            setOldCaptureMode("summary");
          }
        };
        
        const advanceOldModuleIdCapture = (value: string) => {
          setIsIdInputFocused(false);
          if (value.length > 0) {
            setOldCaptureMode("summary");
          }
        };

        const handleOldSystemIdChange = (text: string) => {
          // Detect barcode scanner input (contains newline from Enter key)
          if (text.includes('\n') || text.includes('\r')) {
            const cleanedText = text.replace(/[\n\r]/g, '');
            setFormData(prev => ({ ...prev, oldSystemId: cleanedText }));
            // Advance immediately after scanner input
            advanceOldSystemIdCapture(cleanedText);
            return;
          }
          setFormData(prev => ({ ...prev, oldSystemId: text }));
        };
        
        const handleOldSystemIdBlur = () => {
          advanceOldSystemIdCapture(formData.oldSystemId.trim());
        };
        
        const handleOldSystemIdSubmit = () => {
          // Called when user presses Enter/Done on keyboard
          advanceOldSystemIdCapture(formData.oldSystemId.trim());
        };
        
        const handleOldModuleIdChange = (text: string) => {
          // Detect barcode scanner input (contains newline from Enter key)
          if (text.includes('\n') || text.includes('\r')) {
            const cleanedText = text.replace(/[\n\r]/g, '');
            setFormData(prev => ({ ...prev, oldModuleId: cleanedText }));
            // Advance immediately after scanner input
            advanceOldModuleIdCapture(cleanedText);
            return;
          }
          setFormData(prev => ({ ...prev, oldModuleId: text }));
        };
        
        const handleOldModuleIdBlur = () => {
          advanceOldModuleIdCapture(formData.oldModuleId.trim());
        };
        
        const handleOldModuleIdSubmit = () => {
          // Called when user presses Enter/Done on keyboard
          advanceOldModuleIdCapture(formData.oldModuleId.trim());
        };
        
        const oldCurrentCapturing = oldCaptureMode === "system" ? "Old System ID" : oldCaptureMode === "module" ? "Old Module ID" : null;
        const isCapturingOldSystem = oldCaptureMode === "system" && hasOldSystem;
        const isCapturingOldModule = oldCaptureMode === "module" && hasOldModule;
        
        return (
          <View>
            <View style={styles.iconHeader}>
              <Icon name="hash" size={48} color={theme.primary} />
            </View>
            <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.lg, textAlign: "center" }}>
              {oldIdHelpText}
            </ThemedText>

            {hasOldSystem && formData.oldSystemId.trim().length > 0 && !isCapturingOldSystem ? (
              <View style={[styles.summaryCard, { backgroundColor: theme.backgroundSecondary, padding: Spacing.md, marginBottom: Spacing.md }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>Old System ID</ThemedText>
                    <ThemedText type="h4" style={{ fontWeight: "600" }}>{formData.oldSystemId}</ThemedText>
                  </View>
                  <Button
                    onPress={() => clearOldCapturedId("system")}
                    style={{ backgroundColor: theme.backgroundDefault, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm }}
                  >
                    <ThemedText type="small">Clear</ThemedText>
                  </Button>
                </View>
              </View>
            ) : null}

            {hasOldModule && formData.oldModuleId.trim().length > 0 && !isCapturingOldModule ? (
              <View style={[styles.summaryCard, { backgroundColor: theme.backgroundSecondary, padding: Spacing.md, marginBottom: Spacing.md }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>Old Module ID</ThemedText>
                    <ThemedText type="h4" style={{ fontWeight: "600" }}>{formData.oldModuleId}</ThemedText>
                  </View>
                  <Button
                    onPress={() => clearOldCapturedId("module")}
                    style={{ backgroundColor: theme.backgroundDefault, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm }}
                  >
                    <ThemedText type="small">Clear</ThemedText>
                  </Button>
                </View>
              </View>
            ) : null}

            {(isCapturingOldSystem || isCapturingOldModule) && oldCurrentCapturing ? (
              <View>
                <View style={[{ backgroundColor: theme.primary, padding: Spacing.md, borderRadius: 8, marginBottom: Spacing.lg }]}>
                  <ThemedText type="body" style={{ color: "#FFFFFF", textAlign: "center", fontWeight: "600" }}>
                    Capturing: {oldCurrentCapturing}
                  </ThemedText>
                </View>

                {(projectConfig.searchShowBarcodeScan || projectConfig.searchShowQrCodeScan) && (
                  <View style={styles.scanButtonsRow}>
                    {projectConfig.searchShowBarcodeScan && (
                      <Pressable
                        style={[styles.scanButton, { backgroundColor: theme.backgroundSecondary }]}
                        onPress={() => openOldScannerFor(isCapturingOldSystem ? "oldSystem" : "oldModule", "barcode")}
                      >
                        <Icon name="maximize" size={28} color={theme.primary} />
                        <ThemedText type="small" style={{ marginTop: Spacing.xs, fontWeight: "500" }}>Barcode</ThemedText>
                      </Pressable>
                    )}
                    {projectConfig.searchShowQrCodeScan && (
                      <Pressable
                        style={[styles.scanButton, { backgroundColor: theme.backgroundSecondary }]}
                        onPress={() => openOldScannerFor(isCapturingOldSystem ? "oldSystem" : "oldModule", "qr")}
                      >
                        <Icon name="grid" size={28} color={theme.primary} />
                        <ThemedText type="small" style={{ marginTop: Spacing.xs, fontWeight: "500" }}>QR Code</ThemedText>
                      </Pressable>
                    )}
                  </View>
                )}

                {(projectConfig.searchShowManualEntry || projectConfig.searchShowHidScanner) && (
                  <>
                    {(projectConfig.searchShowBarcodeScan || projectConfig.searchShowQrCodeScan) && (
                      <ThemedText type="body" style={{ color: theme.textSecondary, marginVertical: Spacing.lg, textAlign: "center" }}>
                        or enter manually
                      </ThemedText>
                    )}

                    <TextInput
                      value={isCapturingOldSystem ? formData.oldSystemId : formData.oldModuleId}
                      onChangeText={isCapturingOldSystem ? handleOldSystemIdChange : handleOldModuleIdChange}
                      onFocus={() => setIsIdInputFocused(true)}
                      onBlur={isCapturingOldSystem ? handleOldSystemIdBlur : handleOldModuleIdBlur}
                      onSubmitEditing={isCapturingOldSystem ? handleOldSystemIdSubmit : handleOldModuleIdSubmit}
                      placeholder="Type or use HID scanner"
                      autoCapitalize="characters"
                      returnKeyType="done"
                      blurOnSubmit={true}
                      style={{ fontSize: 24, fontWeight: "600", textAlign: "center", paddingVertical: Spacing.md, minHeight: 50 }}
                    />
                    {projectConfig.searchShowHidScanner && (
                      <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.sm, textAlign: "center" }}>
                        Tap field and scan with Bluetooth/USB barcode gun
                      </ThemedText>
                    )}
                  </>
                )}
              </View>
            ) : null}
          </View>
        );
      }

      case "canChange":
        return (
          <View>
            <View style={styles.iconHeader}>
              <Icon name="help-circle" size={48} color={theme.primary} />
            </View>
            <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.xl, textAlign: "center" }}>
              Can the meter changeout proceed?
            </ThemedText>
            
            <Pressable
              style={[
                styles.captureTypeOption,
                { 
                  backgroundColor: formData.canChange === true ? theme.success : theme.backgroundSecondary,
                  borderColor: formData.canChange === true ? theme.success : theme.border,
                }
              ]}
              onPress={() => setFormData(prev => ({ ...prev, canChange: true }))}
            >
              <Icon name="check-circle" size={24} color={formData.canChange === true ? "#FFFFFF" : theme.success} />
              <ThemedText type="body" style={{ marginLeft: Spacing.md, fontWeight: "600", color: formData.canChange === true ? "#FFFFFF" : theme.text }}>
                Yes - Proceed with changeout
              </ThemedText>
            </Pressable>
            
            <Pressable
              style={[
                styles.captureTypeOption,
                { 
                  backgroundColor: formData.canChange === false ? theme.error : theme.backgroundSecondary,
                  borderColor: formData.canChange === false ? theme.error : theme.border,
                  marginTop: Spacing.md,
                }
              ]}
              onPress={() => setFormData(prev => ({ ...prev, canChange: false }))}
            >
              <Icon name="alert-triangle" size={24} color={formData.canChange === false ? "#FFFFFF" : theme.error} />
              <ThemedText type="body" style={{ marginLeft: Spacing.md, fontWeight: "600", color: formData.canChange === false ? "#FFFFFF" : theme.text }}>
                No - Report issue
              </ThemedText>
            </Pressable>
          </View>
        );

      case "oldReading": {
        const oldReadingDesc = hasOldSystem && hasOldModule 
          ? "Enter the final readings from the old system and module"
          : hasOldSystem 
            ? "Enter the final reading from the old system"
            : "Enter the final reading from the old module";
        return (
          <View>
            <View style={styles.iconHeader}>
              <Icon name="activity" size={48} color={theme.primary} />
            </View>
            <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.lg, textAlign: "center" }}>
              {oldReadingDesc}
            </ThemedText>
            
            {hasOldSystem ? (
              <View style={{ marginBottom: Spacing.lg }}>
                <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
                  System Reading
                </ThemedText>
                <TextInput
                  value={formData.oldSystemReading}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, oldSystemReading: filterNumericInput(text) }))}
                  placeholder="Enter system reading"
                  keyboardType="decimal-pad"
                  style={{ fontSize: 20, fontWeight: "600", textAlign: "center", paddingVertical: Spacing.md, minHeight: 50 }}
                />
              </View>
            ) : null}
            
            {hasOldModule ? (
              <View>
                <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
                  Module Reading
                </ThemedText>
                <TextInput
                  value={formData.oldModuleReading}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, oldModuleReading: filterNumericInput(text) }))}
                  placeholder="Enter module reading"
                  keyboardType="decimal-pad"
                  style={{ fontSize: 20, fontWeight: "600", textAlign: "center", paddingVertical: Spacing.md, minHeight: 50 }}
                />
              </View>
            ) : null}
          </View>
        );
      }

      case "beforePhotos":
        const beforePhotosDescription = isReadingOnlyMode 
          ? "Take photos of the meter before taking the reading (minimum 1 required)"
          : "Take photos of the old system before removal (minimum 1 required)";
        return (
          <View>
            <View style={styles.iconHeader}>
              <Icon name="camera" size={48} color={theme.primary} />
            </View>
            <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.lg, textAlign: "center" }}>
              {beforePhotosDescription}
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
        return (
          <View>
            <View style={styles.iconHeader}>
              <Icon name="tool" size={48} color={theme.primary} />
            </View>
            <ThemedText type="h4" style={{ marginBottom: Spacing.lg, textAlign: "center" }}>
              Safely remove the old equipment and install the new equipment
            </ThemedText>
            
            <View style={[styles.summaryCard, { backgroundColor: theme.backgroundSecondary, padding: Spacing.lg }]}>
              {hasOldSystem ? (
                <>
                  <View style={styles.summaryRow}>
                    <Icon name="check-circle" size={24} color={theme.success} />
                    <ThemedText type="body" style={{ fontWeight: "500" }}>Old System: <ThemedText type="body" style={{ fontWeight: "600" }}>{formData.oldSystemId}</ThemedText></ThemedText>
                  </View>
                  <View style={[styles.summaryRow, { marginTop: Spacing.md }]}>
                    <Icon name="check-circle" size={24} color={theme.success} />
                    <ThemedText type="body" style={{ fontWeight: "500" }}>System Reading: <ThemedText type="body" style={{ fontWeight: "600" }}>{formData.oldSystemReading}</ThemedText></ThemedText>
                  </View>
                </>
              ) : null}
              {hasOldModule ? (
                <>
                  <View style={[styles.summaryRow, { marginTop: hasOldSystem ? Spacing.md : 0 }]}>
                    <Icon name="check-circle" size={24} color={theme.success} />
                    <ThemedText type="body" style={{ fontWeight: "500" }}>Old Module: <ThemedText type="body" style={{ fontWeight: "600" }}>{formData.oldModuleId}</ThemedText></ThemedText>
                  </View>
                  <View style={[styles.summaryRow, { marginTop: Spacing.md }]}>
                    <Icon name="check-circle" size={24} color={theme.success} />
                    <ThemedText type="body" style={{ fontWeight: "500" }}>Module Reading: <ThemedText type="body" style={{ fontWeight: "600" }}>{formData.oldModuleReading}</ThemedText></ThemedText>
                  </View>
                </>
              ) : null}
              <View style={[styles.summaryRow, { marginTop: Spacing.md }]}>
                <Icon name="check-circle" size={24} color={theme.success} />
                <ThemedText type="body" style={{ fontWeight: "500" }}>{formData.beforePhotos.length} Before Photo(s) Captured</ThemedText>
              </View>
            </View>
            
            <ThemedText type="body" style={{ color: theme.primary, marginTop: Spacing.xl, textAlign: "center", fontWeight: "500" }}>
              Tap "Next" when the new equipment is installed
            </ThemedText>
          </View>
        );

      case "newIds": {
        const newIdHelpText = hasNewSystem && hasNewModule 
          ? "Capture the new system and module IDs by scanning or entering manually."
          : hasNewSystem
          ? "Capture the new system ID by scanning or entering manually."
          : "Capture the new module ID by scanning or entering manually.";
          
        const openNewScannerFor = (target: "newSystem" | "newModule", type: "barcode" | "qr") => {
          setScannerTarget(target);
          setScannerType(type);
          setDetectedBarcode(null);
          setShowScanner(true);
        };
        
        const clearNewCapturedId = (target: "system" | "module") => {
          if (target === "system") {
            setFormData(prev => ({ ...prev, newSystemId: "" }));
            setNewCaptureMode("system");
          } else {
            setFormData(prev => ({ ...prev, newModuleId: "" }));
            if (!formData.newSystemId.trim() && hasNewSystem) {
              setNewCaptureMode("system");
            } else {
              setNewCaptureMode("module");
            }
          }
        };
        
        const handleNewSystemIdChange = (text: string) => {
          setFormData(prev => ({ ...prev, newSystemId: text }));
        };
        
        const handleNewSystemIdBlur = () => {
          if (formData.newSystemId.trim().length > 0 && hasNewModule) {
            setNewCaptureMode("module");
          } else if (formData.newSystemId.trim().length > 0) {
            setNewCaptureMode("summary");
          }
        };
        
        const handleNewModuleIdChange = (text: string) => {
          setFormData(prev => ({ ...prev, newModuleId: text }));
        };
        
        const handleNewModuleIdBlur = () => {
          if (formData.newModuleId.trim().length > 0) {
            setNewCaptureMode("summary");
          }
        };
        
        const newCurrentCapturing = newCaptureMode === "system" ? "New System ID" : newCaptureMode === "module" ? "New Module ID" : null;
        const isCapturingNewSystem = newCaptureMode === "system" && hasNewSystem;
        const isCapturingNewModule = newCaptureMode === "module" && hasNewModule;
        
        return (
          <View>
            <View style={styles.iconHeader}>
              <Icon name="hash" size={48} color={theme.primary} />
            </View>
            <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.lg, textAlign: "center" }}>
              {newIdHelpText}
            </ThemedText>

            {hasNewSystem && formData.newSystemId.trim().length > 0 && !isCapturingNewSystem ? (
              <View style={[styles.summaryCard, { backgroundColor: theme.backgroundSecondary, padding: Spacing.md, marginBottom: Spacing.md }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>New System ID</ThemedText>
                    <ThemedText type="h4" style={{ fontWeight: "600" }}>{formData.newSystemId}</ThemedText>
                  </View>
                  <Button
                    onPress={() => clearNewCapturedId("system")}
                    style={{ backgroundColor: theme.backgroundDefault, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm }}
                  >
                    <ThemedText type="small">Clear</ThemedText>
                  </Button>
                </View>
              </View>
            ) : null}

            {hasNewModule && formData.newModuleId.trim().length > 0 && !isCapturingNewModule ? (
              <View style={[styles.summaryCard, { backgroundColor: theme.backgroundSecondary, padding: Spacing.md, marginBottom: Spacing.md }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>New Module ID</ThemedText>
                    <ThemedText type="h4" style={{ fontWeight: "600" }}>{formData.newModuleId}</ThemedText>
                  </View>
                  <Button
                    onPress={() => clearNewCapturedId("module")}
                    style={{ backgroundColor: theme.backgroundDefault, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm }}
                  >
                    <ThemedText type="small">Clear</ThemedText>
                  </Button>
                </View>
              </View>
            ) : null}

            {(isCapturingNewSystem || isCapturingNewModule) && newCurrentCapturing ? (
              <View>
                <View style={[{ backgroundColor: theme.primary, padding: Spacing.md, borderRadius: 8, marginBottom: Spacing.lg }]}>
                  <ThemedText type="body" style={{ color: "#FFFFFF", textAlign: "center", fontWeight: "600" }}>
                    Capturing: {newCurrentCapturing}
                  </ThemedText>
                </View>

                {(projectConfig.searchShowBarcodeScan || projectConfig.searchShowQrCodeScan) && (
                  <View style={styles.scanButtonsRow}>
                    {projectConfig.searchShowBarcodeScan && (
                      <Pressable
                        style={[styles.scanButton, { backgroundColor: theme.backgroundSecondary }]}
                        onPress={() => openNewScannerFor(isCapturingNewSystem ? "newSystem" : "newModule", "barcode")}
                      >
                        <Icon name="maximize" size={28} color={theme.primary} />
                        <ThemedText type="small" style={{ marginTop: Spacing.xs, fontWeight: "500" }}>Barcode</ThemedText>
                      </Pressable>
                    )}
                    {projectConfig.searchShowQrCodeScan && (
                      <Pressable
                        style={[styles.scanButton, { backgroundColor: theme.backgroundSecondary }]}
                        onPress={() => openNewScannerFor(isCapturingNewSystem ? "newSystem" : "newModule", "qr")}
                      >
                        <Icon name="grid" size={28} color={theme.primary} />
                        <ThemedText type="small" style={{ marginTop: Spacing.xs, fontWeight: "500" }}>QR Code</ThemedText>
                      </Pressable>
                    )}
                  </View>
                )}

                {(projectConfig.searchShowManualEntry || projectConfig.searchShowHidScanner) && (
                  <>
                    {(projectConfig.searchShowBarcodeScan || projectConfig.searchShowQrCodeScan) && (
                      <ThemedText type="body" style={{ color: theme.textSecondary, marginVertical: Spacing.lg, textAlign: "center" }}>
                        or enter manually
                      </ThemedText>
                    )}

                    <TextInput
                      value={isCapturingNewSystem ? formData.newSystemId : formData.newModuleId}
                      onChangeText={isCapturingNewSystem ? handleNewSystemIdChange : handleNewModuleIdChange}
                      onFocus={() => setIsIdInputFocused(true)}
                      onBlur={() => {
                        setIsIdInputFocused(false);
                        if (isCapturingNewSystem) {
                          handleNewSystemIdBlur();
                        } else {
                          handleNewModuleIdBlur();
                        }
                      }}
                      placeholder="Type or use HID scanner"
                      autoCapitalize="characters"
                      style={{ fontSize: 24, fontWeight: "600", textAlign: "center", paddingVertical: Spacing.md, minHeight: 50 }}
                    />
                    {projectConfig.searchShowHidScanner && (
                      <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.sm, textAlign: "center" }}>
                        Tap field and scan with Bluetooth/USB barcode gun
                      </ThemedText>
                    )}
                  </>
                )}
              </View>
            ) : null}
          </View>
        );
      }

      case "newReading": {
        const newReadingDesc = hasNewSystem && hasNewModule 
          ? "Enter the initial readings from the new system and module (usually 0)"
          : hasNewSystem 
            ? "Enter the initial reading from the new system (usually 0)"
            : "Enter the initial reading from the new module (usually 0)";
        return (
          <View>
            <View style={styles.iconHeader}>
              <Icon name="activity" size={48} color={theme.primary} />
            </View>
            <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.lg, textAlign: "center" }}>
              {newReadingDesc}
            </ThemedText>
            
            {hasNewSystem ? (
              <View style={{ marginBottom: Spacing.lg }}>
                <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
                  System Reading
                </ThemedText>
                <TextInput
                  value={formData.newSystemReading}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, newSystemReading: filterNumericInput(text) }))}
                  placeholder="Enter system reading (usually 0)"
                  keyboardType="decimal-pad"
                  style={{ fontSize: 20, fontWeight: "600", textAlign: "center", paddingVertical: Spacing.md, minHeight: 50 }}
                />
              </View>
            ) : null}
            
            {hasNewModule ? (
              <View>
                <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
                  Module Reading
                </ThemedText>
                <TextInput
                  value={formData.newModuleReading}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, newModuleReading: filterNumericInput(text) }))}
                  placeholder="Enter module reading (usually 0)"
                  keyboardType="decimal-pad"
                  style={{ fontSize: 20, fontWeight: "600", textAlign: "center", paddingVertical: Spacing.md, minHeight: 50 }}
                />
              </View>
            ) : null}
          </View>
        );
      }

      case "afterPhotos":
        const afterPhotosDescription = isReadingOnlyMode 
          ? "Take photos after completing the reading (minimum 1 required)"
          : "Take photos of the new system after installation (minimum 1 required)";
        return (
          <View>
            <View style={styles.iconHeader}>
              <Icon name="camera" size={48} color={theme.primary} />
            </View>
            <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.lg, textAlign: "center" }}>
              {afterPhotosDescription}
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
              <Icon name="map-pin" size={32} color={theme.primary} />
            </View>
            <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.md, textAlign: "center" }}>
              Capture GPS coordinates (required)
            </ThemedText>
            
            <Button
              onPress={() => captureGps()}
              style={{ backgroundColor: theme.primary, marginBottom: Spacing.sm }}
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
          </View>
        );

      case "notes":
        return (
          <View>
            <View style={styles.iconHeader}>
              <Icon name="file-text" size={48} color={theme.primary} />
            </View>
            <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.lg, textAlign: "center" }}>
              Add any notes about this work order (optional)
            </ThemedText>
            
            <TextInput
              value={formData.notes}
              onChangeText={(text) => setFormData(prev => ({ ...prev, notes: text }))}
              placeholder="Enter notes here..."
              multiline
              style={{ minHeight: 120, maxHeight: 200 }}
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
              initialValue={formData.signatureData}
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

      case "confirm":
        return (
          <View>
            <View style={styles.iconHeader}>
              <Icon name="check-circle" size={48} color={theme.success} />
            </View>
            <ThemedText type="h3" style={{ marginBottom: Spacing.lg, textAlign: "center" }}>Review & Submit</ThemedText>
            
            <View style={[styles.summaryCard, { backgroundColor: theme.backgroundSecondary, padding: Spacing.lg }]}>
              {hasOldSystem ? (
                <>
                  <View style={styles.summaryRow}>
                    <Icon name="box" size={20} color={theme.primary} />
                    <ThemedText type="body">Old System: <ThemedText type="body" style={{ fontWeight: "600" }}>{formData.oldSystemId}</ThemedText></ThemedText>
                  </View>
                  <View style={[styles.summaryRow, { marginTop: Spacing.md }]}>
                    <Icon name="activity" size={20} color={theme.primary} />
                    <ThemedText type="body">System Reading: <ThemedText type="body" style={{ fontWeight: "600" }}>{formData.oldSystemReading}</ThemedText></ThemedText>
                  </View>
                </>
              ) : null}
              
              {hasOldModule ? (
                <>
                  <View style={[styles.summaryRow, { marginTop: hasOldSystem ? Spacing.md : 0 }]}>
                    <Icon name="cpu" size={20} color={theme.primary} />
                    <ThemedText type="body">Old Module: <ThemedText type="body" style={{ fontWeight: "600" }}>{formData.oldModuleId}</ThemedText></ThemedText>
                  </View>
                  <View style={[styles.summaryRow, { marginTop: Spacing.md }]}>
                    <Icon name="activity" size={20} color={theme.primary} />
                    <ThemedText type="body">Module Reading: <ThemedText type="body" style={{ fontWeight: "600" }}>{formData.oldModuleReading}</ThemedText></ThemedText>
                  </View>
                </>
              ) : null}
              
              {hasNewSystem ? (
                <>
                  <View style={[styles.summaryRow, { marginTop: (hasOldSystem || hasOldModule) ? Spacing.md : 0 }]}>
                    <Icon name="box" size={20} color={theme.primary} />
                    <ThemedText type="body">New System: <ThemedText type="body" style={{ fontWeight: "600" }}>{formData.newSystemId}</ThemedText></ThemedText>
                  </View>
                  <View style={[styles.summaryRow, { marginTop: Spacing.md }]}>
                    <Icon name="activity" size={20} color={theme.primary} />
                    <ThemedText type="body">System Reading: <ThemedText type="body" style={{ fontWeight: "600" }}>{formData.newSystemReading}</ThemedText></ThemedText>
                  </View>
                </>
              ) : null}
              
              {hasNewModule ? (
                <>
                  <View style={[styles.summaryRow, { marginTop: (hasOldSystem || hasOldModule || hasNewSystem) ? Spacing.md : 0 }]}>
                    <Icon name="cpu" size={20} color={theme.primary} />
                    <ThemedText type="body">New Module: <ThemedText type="body" style={{ fontWeight: "600" }}>{formData.newModuleId}</ThemedText></ThemedText>
                  </View>
                  <View style={[styles.summaryRow, { marginTop: Spacing.md }]}>
                    <Icon name="activity" size={20} color={theme.primary} />
                    <ThemedText type="body">Module Reading: <ThemedText type="body" style={{ fontWeight: "600" }}>{formData.newModuleReading}</ThemedText></ThemedText>
                  </View>
                </>
              ) : null}
              
              <View style={[styles.summaryRow, { marginTop: Spacing.md }]}>
                <Icon name="map-pin" size={20} color={theme.primary} />
                <ThemedText type="body" numberOfLines={1}>GPS Location: {formData.gpsCoordinates}</ThemedText>
              </View>
              <View style={[styles.summaryRow, { marginTop: Spacing.md }]}>
                <Icon name="camera" size={20} color={theme.primary} />
                <ThemedText type="body">{formData.beforePhotos.length} Before Photo(s)</ThemedText>
              </View>
              <View style={[styles.summaryRow, { marginTop: Spacing.md }]}>
                <Icon name="camera" size={20} color={theme.primary} />
                <ThemedText type="body">{formData.afterPhotos.length} After Photo(s)</ThemedText>
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
            
            <View style={[styles.offlineNotice, { backgroundColor: theme.warning + "20", marginTop: Spacing.lg }]}>
              <Icon name="wifi-off" size={20} color={theme.warning} />
              <ThemedText type="body" style={{ marginLeft: Spacing.sm, flex: 1, color: theme.warning }}>
                This work order will be saved locally and synced when you're back online.
              </ThemedText>
            </View>
          </View>
        );

      case "troubleCapture":
        return (
          <View>
            <View style={styles.iconHeader}>
              <Icon name="alert-triangle" size={48} color={theme.error} />
            </View>
            <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.lg, textAlign: "center" }}>
              Report the issue that prevented the changeout
            </ThemedText>
            
            <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
              Trouble Code (Required)
            </ThemedText>
            <SelectInput
              value={formData.troubleCode}
              onSelect={(value: string) => setFormData(prev => ({ ...prev, troubleCode: value }))}
              options={troubleCodeDisplayStrings}
              placeholder="Select a trouble code"
            />
            
            <View style={{ marginTop: Spacing.lg }}>
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
                Trouble Note (Optional)
              </ThemedText>
              <TextInput
                value={formData.troubleNote}
                onChangeText={(text) => setFormData(prev => ({ ...prev, troubleNote: text }))}
                placeholder="Describe the issue..."
                multiline
              />
            </View>
            
            <View style={{ marginTop: Spacing.lg }}>
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
                Trouble Photos (Minimum 1 required)
              </ThemedText>
              <Button
                onPress={() => takePhoto("trouble")}
                style={{ backgroundColor: theme.error, marginBottom: Spacing.md }}
              >
                <Icon name="camera" size={18} color="#FFFFFF" style={{ marginRight: Spacing.sm }} />
                Take Trouble Photo
              </Button>
              
              {formData.troublePhotos.length > 0 && renderPhotoGrid(formData.troublePhotos, "trouble")}
              
              <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
                {formData.troublePhotos.length} photo(s) captured
              </ThemedText>
            </View>
          </View>
        );

      case "troubleConfirm":
        return (
          <View>
            <View style={styles.iconHeader}>
              <Icon name="alert-triangle" size={48} color={theme.error} />
            </View>
            <ThemedText type="h3" style={{ marginBottom: Spacing.lg, textAlign: "center" }}>Review & Submit Trouble</ThemedText>
            
            <View style={[styles.summaryCard, { backgroundColor: theme.backgroundSecondary, padding: Spacing.lg }]}>
              <View style={styles.summaryRow}>
                <Icon name="box" size={20} color={theme.primary} />
                <ThemedText type="body">Old System: <ThemedText type="body" style={{ fontWeight: "600" }}>{formData.oldSystemId}</ThemedText></ThemedText>
              </View>
              <View style={[styles.summaryRow, { marginTop: Spacing.md }]}>
                <Icon name="activity" size={20} color={theme.primary} />
                <ThemedText type="body">System Reading: <ThemedText type="body" style={{ fontWeight: "600" }}>{formData.oldSystemReading}</ThemedText></ThemedText>
              </View>
              
              {hasOldModule && (
                <>
                  <View style={[styles.summaryRow, { marginTop: Spacing.md }]}>
                    <Icon name="cpu" size={20} color={theme.primary} />
                    <ThemedText type="body">Old Module: <ThemedText type="body" style={{ fontWeight: "600" }}>{formData.oldModuleId}</ThemedText></ThemedText>
                  </View>
                  <View style={[styles.summaryRow, { marginTop: Spacing.md }]}>
                    <Icon name="activity" size={20} color={theme.primary} />
                    <ThemedText type="body">Module Reading: <ThemedText type="body" style={{ fontWeight: "600" }}>{formData.oldModuleReading}</ThemedText></ThemedText>
                  </View>
                </>
              )}
              
              <View style={[styles.summaryRow, { marginTop: Spacing.md }]}>
                <Icon name="alert-triangle" size={20} color={theme.error} />
                <ThemedText type="body">Trouble Code: <ThemedText type="body" style={{ fontWeight: "600" }}>{formData.troubleCode}</ThemedText></ThemedText>
              </View>
              {formData.troubleNote ? (
                <View style={[styles.summaryRow, { marginTop: Spacing.md }]}>
                  <Icon name="file-text" size={20} color={theme.primary} />
                  <ThemedText type="body" numberOfLines={2}>Note: {formData.troubleNote}</ThemedText>
                </View>
              ) : null}
              <View style={[styles.summaryRow, { marginTop: Spacing.md }]}>
                <Icon name="camera" size={20} color={theme.primary} />
                <ThemedText type="body">{formData.troublePhotos.length} Trouble Photo(s)</ThemedText>
              </View>
            </View>
            
            <View style={[styles.offlineNotice, { backgroundColor: theme.warning + "20", marginTop: Spacing.lg }]}>
              <Icon name="wifi-off" size={20} color={theme.warning} />
              <ThemedText type="body" style={{ marginLeft: Spacing.sm, flex: 1, color: theme.warning }}>
                This trouble report will be saved locally and synced when you're back online.
              </ThemedText>
            </View>
          </View>
        );

      case "readingCapture":
        const hasSystemEquipment = Boolean(formData.oldSystemId?.trim());
        const hasModuleEquipment = Boolean(formData.oldModuleId?.trim());
        const hasBothEquipment = hasSystemEquipment && hasModuleEquipment;
        
        return (
          <View>
            <View style={styles.iconHeader}>
              <Icon name="activity" size={48} color={theme.primary} />
            </View>
            <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.lg, textAlign: "center" }}>
              {hasBothEquipment 
                ? "Enter the current system and module readings"
                : `Enter the current ${hasSystemEquipment ? "system" : "module"} reading`}
            </ThemedText>
            
            {hasSystemEquipment ? (
              <View style={{ marginBottom: Spacing.lg }}>
                <ThemedText type="body" style={{ fontWeight: "600", marginBottom: Spacing.xs }}>
                  System Reading {formData.oldSystemId ? `(${formData.oldSystemId})` : ""}
                </ThemedText>
                <TextInput
                  value={formData.newSystemReading}
                  onChangeText={(text) => {
                    setFormData(prev => ({ ...prev, newSystemReading: filterNumericInput(text) }));
                    setNewSystemReadingTouched(true);
                  }}
                  onFocus={() => {
                    setFormData(prev => ({ ...prev, newSystemReading: "" }));
                    setNewSystemReadingTouched(false);
                  }}
                  placeholder="Enter system reading"
                  keyboardType="numeric"
                  style={{ fontSize: 24, fontWeight: "600", textAlign: "center", paddingVertical: Spacing.md, minHeight: 50 }}
                />
                {!newSystemReadingTouched && formData.newSystemReading.trim().length > 0 ? (
                  <ThemedText type="small" style={{ color: theme.warning, marginTop: Spacing.xs }}>
                    Tap to clear and re-enter the reading
                  </ThemedText>
                ) : null}
              </View>
            ) : null}
            
            {hasBothEquipment ? (
              <View style={{ marginBottom: Spacing.lg }}>
                <ThemedText type="body" style={{ fontWeight: "600", marginBottom: Spacing.xs }}>
                  Module Reading {formData.oldModuleId ? `(${formData.oldModuleId})` : ""}
                </ThemedText>
                <TextInput
                  value={formData.newModuleReading}
                  onChangeText={(text) => {
                    setFormData(prev => ({ ...prev, newModuleReading: filterNumericInput(text) }));
                    setNewModuleReadingTouched(true);
                  }}
                  onFocus={() => {
                    setFormData(prev => ({ ...prev, newModuleReading: "" }));
                    setNewModuleReadingTouched(false);
                  }}
                  placeholder="Enter module reading"
                  keyboardType="numeric"
                  style={{ fontSize: 24, fontWeight: "600", textAlign: "center", paddingVertical: Spacing.md, minHeight: 50 }}
                />
                {!newModuleReadingTouched && formData.newModuleReading.trim().length > 0 ? (
                  <ThemedText type="small" style={{ color: theme.warning, marginTop: Spacing.xs }}>
                    Tap to clear and re-enter the reading
                  </ThemedText>
                ) : null}
              </View>
            ) : null}
            
            {!hasSystemEquipment && hasModuleEquipment ? (
              <View style={{ marginBottom: Spacing.lg }}>
                <ThemedText type="body" style={{ fontWeight: "600", marginBottom: Spacing.xs }}>
                  Module Reading {formData.oldModuleId ? `(${formData.oldModuleId})` : ""}
                </ThemedText>
                <TextInput
                  value={formData.newSystemReading}
                  onChangeText={(text) => {
                    setFormData(prev => ({ ...prev, newSystemReading: filterNumericInput(text) }));
                    setNewSystemReadingTouched(true);
                  }}
                  onFocus={() => {
                    setFormData(prev => ({ ...prev, newSystemReading: "" }));
                    setNewSystemReadingTouched(false);
                  }}
                  placeholder="Enter module reading"
                  keyboardType="numeric"
                  style={{ fontSize: 24, fontWeight: "600", textAlign: "center", paddingVertical: Spacing.md, minHeight: 50 }}
                />
                {!newSystemReadingTouched && formData.newSystemReading.trim().length > 0 ? (
                  <ThemedText type="small" style={{ color: theme.warning, marginTop: Spacing.xs }}>
                    Tap to clear and re-enter the reading
                  </ThemedText>
                ) : null}
              </View>
            ) : null}
          </View>
        );

      case "readingConfirm":
        return (
          <View>
            <View style={styles.iconHeader}>
              <Icon name="check-circle" size={48} color={theme.success} />
            </View>
            <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.lg, textAlign: "center" }}>
              Please review the information below before submitting
            </ThemedText>
            
            <View style={[styles.summaryCard, { backgroundColor: theme.backgroundSecondary }]}>
              {formData.oldSystemId ? (
                <View style={styles.summaryRow}>
                  <Icon name="database" size={20} color={theme.primary} />
                  <ThemedText type="body">System ID: <ThemedText type="body" style={{ fontWeight: "600" }}>{formData.oldSystemId}</ThemedText></ThemedText>
                </View>
              ) : null}
              {formData.oldSystemId ? (
                <View style={[styles.summaryRow, { marginTop: Spacing.md }]}>
                  <Icon name="activity" size={20} color={theme.primary} />
                  <ThemedText type="body">System Reading: <ThemedText type="body" style={{ fontWeight: "600" }}>{formData.newSystemReading}</ThemedText></ThemedText>
                </View>
              ) : null}
              {formData.oldModuleId ? (
                <View style={[styles.summaryRow, { marginTop: Spacing.md }]}>
                  <Icon name="cpu" size={20} color={theme.primary} />
                  <ThemedText type="body">Module ID: <ThemedText type="body" style={{ fontWeight: "600" }}>{formData.oldModuleId}</ThemedText></ThemedText>
                </View>
              ) : null}
              {formData.oldModuleId ? (
                <View style={[styles.summaryRow, { marginTop: Spacing.md }]}>
                  <Icon name="activity" size={20} color={theme.primary} />
                  <ThemedText type="body">Module Reading: <ThemedText type="body" style={{ fontWeight: "600" }}>{formData.oldSystemId && formData.oldModuleId ? formData.newModuleReading : formData.newSystemReading}</ThemedText></ThemedText>
                </View>
              ) : null}
              {formData.beforePhotos && formData.beforePhotos.length > 0 ? (
                <View style={[styles.summaryRow, { marginTop: Spacing.md }]}>
                  <Icon name="camera" size={20} color={theme.primary} />
                  <ThemedText type="body">{formData.beforePhotos.length} Before Photo(s)</ThemedText>
                </View>
              ) : null}
              {formData.afterPhotos && formData.afterPhotos.length > 0 ? (
                <View style={[styles.summaryRow, { marginTop: Spacing.md }]}>
                  <Icon name="camera" size={20} color={theme.primary} />
                  <ThemedText type="body">{formData.afterPhotos.length} After Photo(s)</ThemedText>
                </View>
              ) : null}
              {formData.gpsCoordinates ? (
                <View style={[styles.summaryRow, { marginTop: Spacing.md }]}>
                  <Icon name="map-pin" size={20} color={theme.primary} />
                  <ThemedText type="body">GPS: <ThemedText type="body" style={{ fontWeight: "600" }}>{formData.gpsCoordinates}</ThemedText></ThemedText>
                </View>
              ) : null}
              {formData.notes ? (
                <View style={[styles.summaryRow, { marginTop: Spacing.md }]}>
                  <Icon name="file-text" size={20} color={theme.primary} />
                  <ThemedText type="body" numberOfLines={2}>Notes: {formData.notes}</ThemedText>
                </View>
              ) : null}
              {formData.signatureData ? (
                <View style={[styles.summaryRow, { marginTop: Spacing.md }]}>
                  <Icon name="edit-3" size={20} color={theme.primary} />
                  <ThemedText type="body">Signature: <ThemedText type="body" style={{ fontWeight: "600" }}>{formData.signatureName}</ThemedText></ThemedText>
                </View>
              ) : null}
            </View>
            
            <View style={[styles.offlineNotice, { backgroundColor: theme.warning + "20", marginTop: Spacing.lg }]}>
              <Icon name="wifi-off" size={20} color={theme.warning} />
              <ThemedText type="body" style={{ marginLeft: Spacing.sm, flex: 1, color: theme.warning }}>
                This reading will be saved locally and synced when you're back online.
              </ThemedText>
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  const getDisplayStepTitle = (): string => {
    if (currentStep === "oldIds") {
      if (isReadingOnlyMode) {
        if (hasOldSystem && hasOldModule) {
          return "Capture System ID and Module ID";
        } else if (hasOldModule && !hasOldSystem) {
          return "Capture Module ID";
        }
        return "Capture System ID";
      }
      if (hasOldSystem && hasOldModule) {
        return "Capture Old System ID and Module ID";
      } else if (hasOldModule && !hasOldSystem) {
        return "Capture Old Module ID";
      }
      return "Capture Old System ID";
    }
    if (currentStep === "newIds") {
      if (hasNewSystem && hasNewModule) {
        return "Capture New System ID and Module ID";
      } else if (hasNewModule && !hasNewSystem) {
        return "Capture New Module ID";
      }
      return "Capture New System ID";
    }
    if (currentStep === "readingCapture") {
      return "Capture Current Reading";
    }
    if (currentStep === "readingConfirm") {
      return "Confirm & Submit Reading";
    }
    if (currentStep === "canChange" && isReadingOnlyMode) {
      return "Can You Proceed?";
    }
    return STEP_TITLES[currentStep];
  };

  const getStepRequiredLabel = () => {
    switch (currentStep) {
      case "physicalChange":
      case "notes":
      case "readingConfirm":
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
          {steps.map((_: WizardStep, index: number) => (
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
          <ThemedText type="h3" style={styles.stepTitle}>{getDisplayStepTitle()}</ThemedText>
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
              "Save Work Order"
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

      <WorkflowModeModal
        visible={showWorkflowModeModal}
        onClose={() => {
          setShowWorkflowModeModal(false);
          navigation.goBack();
        }}
        onSelectMode={handleWorkflowModeSelect}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  offlineNotice: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  captureTypeOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
  },
});
