import React, { useState, useEffect } from "react";
import { View, StyleSheet, Alert, Platform, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HeaderButton } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { useWorkOrders } from "@/contexts/WorkOrderContext";
import { useAuth } from "@/contexts/AuthContext";
import { useOffline } from "@/contexts/OfflineContext";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { ThemedText } from "@/components/ThemedText";
import { TextInput } from "@/components/TextInput";
import { Button } from "@/components/Button";
import { Checkbox } from "@/components/Checkbox";
import { SelectInput } from "@/components/SelectInput";
import { Spacing, BorderRadius } from "@/constants/theme";

type RouteProps = RouteProp<RootStackParamList, "WorkflowWizard">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface MeterChangeoutData {
  locationConfirmed: boolean;
  canChange: boolean | null;
  troubleCode: string;
  troubleNote: string;
  oldMeterReading: string;
  newMeterId: string;
  newMeterReading: string;
  gpsCoordinates: string;
  signatureName: string;
}

const WIZARD_STEPS = [
  { id: "confirm", name: "Confirm Location", type: "checkbox" },
  { id: "canChange", name: "Can Change Meter?", type: "select" },
  { id: "oldReading", name: "Old Meter Reading", type: "number" },
  { id: "newMeterId", name: "New Meter ID", type: "text" },
  { id: "newReading", name: "New Meter Reading", type: "number" },
  { id: "signature", name: "Customer Signature", type: "signature" },
];

const TROUBLE_STEPS = [
  { id: "confirm", name: "Confirm Location", type: "checkbox" },
  { id: "canChange", name: "Can Change Meter?", type: "select" },
  { id: "troubleCode", name: "Trouble Code", type: "select" },
  { id: "troubleNote", name: "Trouble Notes", type: "text" },
];

export default function WorkflowWizardScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NavigationProp>();
  const { updateWorkOrder, referenceData } = useWorkOrders();
  const { serverUrl, projectId } = useAuth();
  const { isOnline, addPendingAction } = useOffline();

  const workOrder = route.params.workOrder;
  
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<MeterChangeoutData>({
    locationConfirmed: false,
    canChange: null,
    troubleCode: "",
    troubleNote: "",
    oldMeterReading: workOrder.oldMeterReading || "",
    newMeterId: "",
    newMeterReading: "",
    gpsCoordinates: "",
    signatureName: "",
  });

  const steps = formData.canChange === false ? TROUBLE_STEPS : WIZARD_STEPS;
  const currentStep = steps[currentStepIndex];
  const totalSteps = steps.length;
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === totalSteps - 1;

  const troubleCodes = referenceData?.troubleCodes?.map(tc => tc.code) || [
    "ACCESS_DENIED",
    "METER_LOCKED",
    "UNSAFE_CONDITIONS",
    "CUSTOMER_REFUSED",
    "OTHER",
  ];

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <HeaderButton onPress={handleCancel}>
          <ThemedText style={{ color: theme.error }}>Cancel</ThemedText>
        </HeaderButton>
      ),
    });
  }, [navigation, theme]);

  const handleCancel = () => {
    if (Platform.OS === "web") {
      navigation.goBack();
      return;
    }
    
    Alert.alert(
      "Cancel Workflow",
      "Your progress will not be saved. Are you sure?",
      [
        { text: "Continue", style: "cancel" },
        { text: "Cancel", style: "destructive", onPress: () => navigation.goBack() },
      ]
    );
  };

  const isCurrentStepValid = (): boolean => {
    switch (currentStep.id) {
      case "confirm": 
        return formData.locationConfirmed === true;
      case "canChange": 
        return formData.canChange !== null;
      case "oldReading": 
        return formData.oldMeterReading.trim().length > 0;
      case "newMeterId": 
        return formData.newMeterId.trim().length > 0;
      case "newReading": 
        return formData.newMeterReading.trim().length > 0;
      case "troubleCode": 
        return formData.troubleCode.length > 0;
      case "troubleNote": 
        return true;
      case "signature": 
        return formData.signatureName.trim().length > 0;
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
    
    const changeoutPayload = {
      canChange,
      troubleCode: canChange ? null : formData.troubleCode,
      troubleNote: canChange ? null : formData.troubleNote,
      oldMeterReading: formData.oldMeterReading,
      newMeterId: canChange ? formData.newMeterId : null,
      newMeterReading: canChange ? formData.newMeterReading : null,
      gpsCoordinates: formData.gpsCoordinates || null,
      signatureData: null,
      signatureName: formData.signatureName,
    };

    try {
      if (isOnline && serverUrl && projectId) {
        const formDataToSend = new FormData();
        
        formDataToSend.append("canChange", String(canChange));
        if (!canChange && formData.troubleCode) {
          formDataToSend.append("troubleCode", formData.troubleCode);
        }
        if (!canChange && formData.troubleNote) {
          formDataToSend.append("troubleNote", formData.troubleNote);
        }
        formDataToSend.append("oldMeterReading", formData.oldMeterReading);
        if (canChange) {
          formDataToSend.append("newMeterId", formData.newMeterId);
          formDataToSend.append("newMeterReading", formData.newMeterReading);
        }
        if (formData.gpsCoordinates) {
          formDataToSend.append("gpsCoordinates", formData.gpsCoordinates);
        }
        formDataToSend.append("signatureName", formData.signatureName);

        const response = await fetch(
          `${serverUrl}/api/projects/${projectId}/work-orders/${workOrder.id}/meter-changeout`,
          {
            method: "POST",
            credentials: "include",
            body: formDataToSend,
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || "Failed to complete work order");
        }

        const result = await response.json();
        
        updateWorkOrder(workOrder.id, {
          status: result.workOrder?.status || (canChange ? "Completed" : "Trouble"),
          newMeterId: canChange ? formData.newMeterId : undefined,
          newMeterReading: canChange ? formData.newMeterReading : undefined,
          oldMeterReading: formData.oldMeterReading,
          troubleCode: canChange ? undefined : formData.troubleCode,
          troubleNote: canChange ? undefined : formData.troubleNote,
          syncPending: false,
        });
      } else {
        await addPendingAction({
          type: "complete",
          workOrderId: String(workOrder.id),
          workOrderTitle: workOrder.serviceAddress,
          data: changeoutPayload,
        });
        
        updateWorkOrder(workOrder.id, {
          status: canChange ? "Completed" : "Trouble",
          syncPending: true,
          newMeterId: canChange ? formData.newMeterId : undefined,
          newMeterReading: canChange ? formData.newMeterReading : undefined,
          oldMeterReading: formData.oldMeterReading,
          troubleCode: canChange ? undefined : formData.troubleCode,
          troubleNote: canChange ? undefined : formData.troubleNote,
        });
      }

      navigation.goBack();
      navigation.goBack();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to complete work order";
      if (Platform.OS === "web") {
        alert(message);
      } else {
        Alert.alert("Error", message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepInput = () => {
    switch (currentStep.id) {
      case "confirm":
        return (
          <Checkbox
            checked={formData.locationConfirmed}
            onToggle={() => setFormData(prev => ({ ...prev, locationConfirmed: !prev.locationConfirmed }))}
            label="I confirm I am at the correct location and ready to proceed"
          />
        );
      
      case "canChange":
        return (
          <SelectInput
            value={formData.canChange === null ? "" : formData.canChange ? "Yes" : "No"}
            options={["Yes", "No"]}
            onSelect={(value) => setFormData(prev => ({ ...prev, canChange: value === "Yes" }))}
            placeholder="Can you change the meter?"
          />
        );

      case "oldReading":
        return (
          <TextInput
            value={formData.oldMeterReading}
            onChangeText={(text) => setFormData(prev => ({ ...prev, oldMeterReading: text }))}
            placeholder="Enter old meter reading"
            keyboardType="numeric"
          />
        );

      case "newMeterId":
        return (
          <TextInput
            value={formData.newMeterId}
            onChangeText={(text) => setFormData(prev => ({ ...prev, newMeterId: text }))}
            placeholder="Scan or enter new meter ID"
            autoCapitalize="characters"
          />
        );

      case "newReading":
        return (
          <TextInput
            value={formData.newMeterReading}
            onChangeText={(text) => setFormData(prev => ({ ...prev, newMeterReading: text }))}
            placeholder="Enter new meter reading (usually 0)"
            keyboardType="numeric"
          />
        );

      case "troubleCode":
        return (
          <SelectInput
            value={formData.troubleCode}
            options={troubleCodes}
            onSelect={(value) => setFormData(prev => ({ ...prev, troubleCode: value }))}
            placeholder="Select trouble code"
          />
        );

      case "troubleNote":
        return (
          <TextInput
            value={formData.troubleNote}
            onChangeText={(text) => setFormData(prev => ({ ...prev, troubleNote: text }))}
            placeholder="Describe the issue (optional)"
            multiline
          />
        );

      case "signature":
        return (
          <View>
            <View style={[styles.signaturePlaceholder, { borderColor: theme.border }]}>
              <Feather name="edit-3" size={32} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Signature capture available in Expo Go
              </ThemedText>
            </View>
            <View style={{ marginTop: Spacing.lg }}>
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
                Customer Name
              </ThemedText>
              <TextInput
                value={formData.signatureName}
                onChangeText={(text) => setFormData(prev => ({ ...prev, signatureName: text }))}
                placeholder="Enter customer name"
              />
            </View>
          </View>
        );

      default:
        return null;
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
        <View style={[styles.progressBar, { backgroundColor: theme.border }]}>
          <View 
            style={[
              styles.progressFill, 
              { 
                width: `${((currentStepIndex + 1) / totalSteps) * 100}%`,
                backgroundColor: theme.primary,
              }
            ]} 
          />
        </View>
      </View>

      <KeyboardAwareScrollViewCompat
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Spacing["5xl"] + 80 },
        ]}
      >
        <View style={[styles.woInfo, { backgroundColor: theme.backgroundSecondary }]}>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            {workOrder.customerWoId}
          </ThemedText>
          <ThemedText type="body">{workOrder.serviceAddress}</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            Old Meter: {workOrder.oldMeterId || "N/A"}
          </ThemedText>
        </View>

        <View style={[styles.stepCard, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText type="h3" style={styles.stepTitle}>{currentStep.name}</ThemedText>
          <ThemedText type="caption" style={[styles.requiredText, { color: theme.error }]}>
            Required
          </ThemedText>
          
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
              "Complete"
            ) : (
              "Next"
            )}
          </Button>
        </View>
      </View>
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
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
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
    gap: Spacing.sm,
  },
  stepTitle: {},
  requiredText: {
    marginBottom: Spacing.md,
  },
  inputContainer: {
    marginTop: Spacing.md,
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
});
