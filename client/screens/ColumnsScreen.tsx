import React, { useState, useEffect, useCallback } from "react";
import { View, StyleSheet, Pressable, Alert, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from "react-native-draggable-flatlist";

import { useTheme } from "@/hooks/useTheme";
import { useWorkOrders, ColumnConfig } from "@/contexts/WorkOrderContext";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius } from "@/constants/theme";

const defaultColumns: ColumnConfig[] = [
  { key: "id", label: "ID", visible: true, order: 0 },
  { key: "title", label: "Title", visible: true, order: 1 },
  { key: "status", label: "Status", visible: true, order: 2 },
  { key: "priority", label: "Priority", visible: true, order: 3 },
  { key: "assignedTo", label: "Assigned To", visible: true, order: 4 },
  { key: "location", label: "Location", visible: false, order: 5 },
  { key: "dueDate", label: "Due Date", visible: true, order: 6 },
];

export default function ColumnsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { columns, setColumns } = useWorkOrders();

  const [localColumns, setLocalColumns] = useState<ColumnConfig[]>(columns);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const changed = JSON.stringify(localColumns) !== JSON.stringify(columns);
    setHasChanges(changed);
  }, [localColumns, columns]);

  const handleToggle = (key: string) => {
    setLocalColumns(prev =>
      prev.map(col =>
        col.key === key ? { ...col, visible: !col.visible } : col
      )
    );
  };

  const handleDragEnd = useCallback(({ data }: { data: ColumnConfig[] }) => {
    const reordered = data.map((col, index) => ({ ...col, order: index }));
    setLocalColumns(reordered);
  }, []);

  const handleSave = async () => {
    await setColumns(localColumns);
    if (Platform.OS !== "web") {
      Alert.alert("Saved", "Column settings have been saved.");
    }
  };

  const handleReset = () => {
    setLocalColumns(defaultColumns);
  };

  const renderItem = useCallback(({ item, drag, isActive }: RenderItemParams<ColumnConfig>) => (
    <ScaleDecorator>
      <Pressable
        onLongPress={drag}
        disabled={isActive}
        style={[
          styles.columnRow,
          {
            backgroundColor: isActive ? theme.backgroundSecondary : theme.backgroundDefault,
            borderColor: theme.border,
          },
        ]}
      >
        <View style={styles.dragHandle}>
          <Feather name="menu" size={20} color={theme.textSecondary} />
        </View>
        <ThemedText type="body" style={styles.columnLabel}>{item.label}</ThemedText>
        <Pressable
          onPress={() => handleToggle(item.key)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather
            name={item.visible ? "eye" : "eye-off"}
            size={20}
            color={item.visible ? theme.primary : theme.textSecondary}
          />
        </Pressable>
      </Pressable>
    </ScaleDecorator>
  ), [theme, handleToggle]);

  const keyExtractor = useCallback((item: ColumnConfig) => item.key, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.instructions, { marginTop: headerHeight + Spacing.xl }]}>
        <Feather name="info" size={16} color={theme.textSecondary} />
        <ThemedText type="small" style={{ color: theme.textSecondary, flex: 1 }}>
          Long press and drag to reorder. Tap the eye icon to show/hide columns.
        </ThemedText>
      </View>

      <DraggableFlatList
        data={localColumns}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        onDragEnd={handleDragEnd}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: tabBarHeight + Spacing.xl + 120 },
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
      />

      <View style={[
        styles.bottomActions,
        { 
          backgroundColor: theme.backgroundRoot,
          paddingBottom: tabBarHeight + Spacing.lg,
        }
      ]}>
        <Pressable
          onPress={handleReset}
          style={({ pressed }) => [
            styles.resetButton,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Feather name="refresh-cw" size={16} color={theme.textSecondary} />
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            Reset to Default
          </ThemedText>
        </Pressable>
        
        <Button
          onPress={handleSave}
          disabled={!hasChanges}
          style={{ backgroundColor: theme.primary }}
        >
          Save Changes
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  instructions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  columnRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.md,
  },
  dragHandle: {
    padding: Spacing.xs,
  },
  columnLabel: {
    flex: 1,
  },
  bottomActions: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    gap: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  resetButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    padding: Spacing.sm,
  },
});
