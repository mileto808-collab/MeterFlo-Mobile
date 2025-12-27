import React, { useState, useEffect } from "react";
import { View, StyleSheet, Alert, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HeaderButton } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { useWorkOrders, WorkflowStep } from "@/contexts/WorkOrderContext";
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

export default function WorkflowWizardScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NavigationProp>();
  const { updateWorkOrder } = useWorkOrders();
  const { isOnline, addPendingAction } = useOffline();

  const [workOrder, setWorkOrder] = useState(route.params.workOrder);
  const [currentStepIndex, setCurrentStepIndex] = useState(
    workOrder.workflowSteps.findIndex(s => !s.completed)
  );
  const [stepValues, setStepValues] = useState<Record<string, any>>({});

  const currentStep = workOrder.workflowSteps[currentStepIndex] || workOrder.workflowSteps[0];
  const totalSteps = workOrder.workflowSteps.length;
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === totalSteps - 1;

  useEffect(() => {
    const initialValues: Record<string, any> = {};
    workOrder.workflowSteps.forEach(step => {
      if (step.value !== undefined) {
        initialValues[step.id] = step.value;
      }
    });
    setStepValues(initialValues);
  }, []);

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

  const getCurrentValue = () => stepValues[currentStep.id];

  const setCurrentValue = (value: any) => {
    setStepValues(prev => ({ ...prev, [currentStep.id]: value }));
  };

  const isCurrentStepValid = () => {
    if (!currentStep.required) return true;
    
    const value = getCurrentValue();
    if (value === undefined || value === null || value === "") return false;
    if (currentStep.type === "checkbox" && !value) return false;
    
    return true;
  };

  const handleNext = () => {
    if (!isCurrentStepValid()) {
      if (Platform.OS !== "web") {
        Alert.alert("Required Field", "Please complete this step before continuing.");
      }
      return;
    }

    const updatedSteps = [...workOrder.workflowSteps];
    updatedSteps[currentStepIndex] = {
      ...currentStep,
      value: getCurrentValue(),
      completed: true,
    };

    setWorkOrder(prev => ({
      ...prev,
      workflowSteps: updatedSteps,
      currentStep: currentStepIndex + 1,
    }));

    if (isLastStep) {
      handleComplete(updatedSteps);
    } else {
      setCurrentStepIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (!isFirstStep) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const handleComplete = async (updatedSteps: WorkflowStep[]) => {
    const completedWorkOrder = {
      ...workOrder,
      status: "completed" as const,
      workflowSteps: updatedSteps,
      currentStep: totalSteps,
    };

    if (isOnline) {
      updateWorkOrder(workOrder.id, completedWorkOrder);
    } else {
      await addPendingAction({
        type: "complete",
        workOrderId: workOrder.id,
        workOrderTitle: workOrder.title,
        data: completedWorkOrder,
      });
      updateWorkOrder(workOrder.id, { ...completedWorkOrder, syncPending: true });
    }

    navigation.goBack();
    navigation.goBack();
  };

  const renderStepInput = () => {
    switch (currentStep.type) {
      case "checkbox":
        return (
          <Checkbox
            checked={getCurrentValue() || false}
            onToggle={() => setCurrentValue(!getCurrentValue())}
            label="I confirm this step is complete"
          />
        );
      
      case "number":
        return (
          <TextInput
            value={getCurrentValue()?.toString() || ""}
            onChangeText={text => setCurrentValue(text ? parseFloat(text) : "")}
            placeholder="Enter value"
            keyboardType="numeric"
          />
        );
      
      case "select":
        return (
          <SelectInput
            value={getCurrentValue() || ""}
            options={currentStep.options || []}
            onSelect={setCurrentValue}
            placeholder="Select an option"
          />
        );
      
      case "photo":
        return (
          <View style={[styles.photoPlaceholder, { borderColor: theme.border }]}>
            <Feather name="camera" size={32} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Photo capture available in Expo Go
            </ThemedText>
          </View>
        );
      
      case "signature":
        return (
          <View style={[styles.photoPlaceholder, { borderColor: theme.border }]}>
            <Feather name="edit-3" size={32} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Signature capture available in Expo Go
            </ThemedText>
          </View>
        );
      
      default:
        return (
          <TextInput
            value={getCurrentValue() || ""}
            onChangeText={setCurrentValue}
            placeholder="Enter value"
            multiline={currentStep.type === "text"}
          />
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
        <View style={[styles.stepCard, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText type="h3" style={styles.stepTitle}>{currentStep.name}</ThemedText>
          {currentStep.required ? (
            <ThemedText type="caption" style={[styles.requiredText, { color: theme.error }]}>
              Required
            </ThemedText>
          ) : null}
          
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
            >
              <ThemedText style={{ color: theme.text }}>Previous</ThemedText>
            </Button>
          ) : (
            <View style={styles.buttonPlaceholder} />
          )}
          
          <Button
            onPress={handleNext}
            style={[styles.primaryButton, { backgroundColor: theme.primary }]}
            disabled={currentStep.required && !isCurrentStepValid()}
          >
            {isLastStep ? "Complete" : "Next"}
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
  photoPlaceholder: {
    height: 160,
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: BorderRadius.md,
    justifyContent: "center",
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
});
