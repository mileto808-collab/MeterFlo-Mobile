import React from "react";
import { View, StyleSheet, Pressable, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Icon } from "@/components/Icons";
import { Spacing, BorderRadius } from "@/constants/theme";

export type SearchOption = "barcode" | "qrcode" | "hid" | "manual";

interface SearchOptionsModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectOption: (option: SearchOption) => void;
  allowedOptions?: {
    barcode?: boolean;
    qrcode?: boolean;
    hid?: boolean;
    manual?: boolean;
  };
}

interface OptionButtonProps {
  icon: string;
  title: string;
  description: string;
  onPress: () => void;
}

function OptionButton({ icon, title, description, onPress }: OptionButtonProps) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.optionButton,
        { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={[styles.iconContainer, { backgroundColor: theme.primary + "20" }]}>
        <Icon name={icon} size={24} color={theme.primary} />
      </View>
      <View style={styles.optionText}>
        <ThemedText type="body" style={{ fontWeight: "600" }}>{title}</ThemedText>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          {description}
        </ThemedText>
      </View>
      <Icon name="chevron-right" size={20} color={theme.textSecondary} />
    </Pressable>
  );
}

export function SearchOptionsModal({ visible, onClose, onSelectOption, allowedOptions }: SearchOptionsModalProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const showBarcode = allowedOptions?.barcode ?? true;
  const showQrcode = allowedOptions?.qrcode ?? true;
  const showHid = allowedOptions?.hid ?? false;
  const showManual = allowedOptions?.manual ?? true;

  const handleSelect = (option: SearchOption) => {
    onClose();
    onSelectOption(option);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={{ flex: 1 }} />
        <Pressable 
          onPress={(e) => e.stopPropagation()}
          style={[
            styles.content, 
            { 
              backgroundColor: theme.backgroundRoot,
              paddingBottom: insets.bottom + Spacing.lg,
            }
          ]}
        >
          <View style={styles.handle} />
          
          <ThemedText type="h4" style={styles.title}>
            Search Work Orders
          </ThemedText>

          <View style={styles.options}>
            {showBarcode && (
              <OptionButton
                icon="maximize"
                title="Scan Barcode"
                description="Use camera to scan meter barcode"
                onPress={() => handleSelect("barcode")}
              />
            )}
            {showQrcode && (
              <OptionButton
                icon="grid"
                title="Scan QR Code"
                description="Use camera to scan QR code"
                onPress={() => handleSelect("qrcode")}
              />
            )}
            {showHid && (
              <OptionButton
                icon="bluetooth"
                title="HID Scanner Input"
                description="Use external barcode scanner"
                onPress={() => handleSelect("hid")}
              />
            )}
            {showManual && (
              <OptionButton
                icon="search"
                title="Manual Search"
                description="Type to search work orders"
                onPress={() => handleSelect("manual")}
              />
            )}
          </View>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.cancelButton,
              { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <ThemedText type="body">Cancel</ThemedText>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  content: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: "#808080",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  options: {
    gap: Spacing.md,
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  optionText: {
    flex: 1,
    gap: Spacing.xs,
  },
  cancelButton: {
    marginTop: Spacing.lg,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
});
