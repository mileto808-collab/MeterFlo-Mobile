import React, { useState } from "react";
import { Modal, ScrollView, View } from "react-native";
import { PendingAction, useOffline } from "@/contexts/OfflineContext";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkOrders } from "@/contexts/WorkOrderContext";
import { ProjectConfig } from "@/contexts/WorkOrderContext";
import { normalizeReading, readingFields, validateReadingData } from "@/lib/reading-precision";
import { ThemedText } from "./ThemedText";
import { TextInput } from "./TextInput";
import { Button } from "./Button";
import { ReadingErrors } from "./ReadingErrors";
import { useTheme } from "@/hooks/useTheme";

export function QueuedReadingCorrection({ action }: { action: PendingAction }) {
  const { theme } = useTheme();
  const { isOnline, isSyncing, correctPendingReadings } = useOffline();
  const { isOfflineSession } = useAuth();
  const { projectConfig, refreshProjectConfig, updateWorkOrder, workOrders } = useWorkOrders();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Record<string, any>>({});
  const [limits, setLimits] = useState<ProjectConfig>(projectConfig);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const fields = readingFields(data).filter(field => data[field] !== null && data[field] !== undefined);

  const begin = async () => {
    setOpen(true);
    setReady(false);
    setData({ ...action.data });
    setError("");
    setBusy(true);
    try {
      setLimits(await refreshProjectConfig(isOnline && !isOfflineSession, true));
      setReady(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to refresh settings.");
    } finally { setBusy(false); }
  };

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const readings = Object.fromEntries(fields.map(field => [field, String(data[field])]));
      await correctPendingReadings(action.id, readings);
      // Update only the draft's reading display; retain its ID, photos and other metadata.
      const local = workOrders.find(workOrder => String(workOrder.id) === action.workOrderId ||
        (action.type === "offlineWorkOrder" && workOrder.isOfflineCreated &&
          (workOrder.oldSystemId || workOrder.oldModuleId) === action.lookupKey));
      if (local) {
        const updated: Record<string, string> = {};
        for (const [field, value] of Object.entries(readings)) {
          const key = field.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
            .replace("MeterReading", "SystemReading").replace("ModuleReading", "ModuleRead");
          updated[key] = value;
        }
        await updateWorkOrder(local.id, updated);
      }
      setOpen(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to save corrections.");
    } finally { setBusy(false); }
  };

  return <>
    <ThemedText type="small" style={{ color: theme.error }}>
      {action.syncError || "The server rejected the reading precision."} Capture and photos remain saved.
    </ThemedText>
    <Button onPress={() => void begin()} disabled={isSyncing}>Correct / reconfirm readings</Button>
    <Modal visible={open} transparent animationType="none" onRequestClose={() => !busy && setOpen(false)}>
      <View style={{ flex: 1, justifyContent: "center", padding: 20, backgroundColor: "#0008" }}>
        <View style={{ maxHeight: "90%", maxWidth: 520, width: "100%", alignSelf: "center", backgroundColor: theme.backgroundDefault, borderRadius: 12, overflow: "hidden" }}>
        <ScrollView contentContainerStyle={{ padding: 16, backgroundColor: theme.backgroundDefault }}>
          <ThemedText type="h4">Correct queued readings</ThemedText>
          <ThemedText>{action.workOrderTitle}</ThemedText>
          <ThemedText type="small">Values are never rounded automatically. Confirm your corrected readings, then retry Sync.</ThemedText>
          {fields.map(field => <View key={field} style={{ marginTop: 12 }}>
            <ThemedText>{field.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2")}</ThemedText>
            <TextInput
              accessibilityLabel={field}
              keyboardType="decimal-pad"
              value={String(data[field])}
              onChangeText={value => setData(current => ({ ...current, [field]: normalizeReading(value) }))}
              editable={!busy}
            />
          </View>)}
          <ReadingErrors data={data} limits={limits} />
          {error ? <ThemedText style={{ color: theme.error }}>{error}</ThemedText> : null}
          {!ready && !busy ? <Button onPress={() => void begin()}>Retry settings</Button> : null}
          <Button onPress={() => void save()} disabled={!ready || busy || isSyncing || validateReadingData(data, limits).length > 0}>
            {busy ? "Please wait…" : "Confirm corrections"}
          </Button>
          <Button onPress={() => setOpen(false)} disabled={busy}>Cancel</Button>
        </ScrollView>
        </View>
      </View>
    </Modal>
  </>;
}
