import React from "react";
import { View, StyleSheet, Modal, Image, Pressable, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius } from "@/constants/theme";

interface PhotoViewerProps {
  visible: boolean;
  photoUri: string | null;
  onClose: () => void;
  onDelete: () => void;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

export function PhotoViewer({ visible, photoUri, onClose, onDelete }: PhotoViewerProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  if (!photoUri) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: "rgba(0,0,0,0.9)" }]}>
        <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.headerButton,
              { opacity: pressed ? 0.7 : 1 }
            ]}
          >
            <Feather name="x" size={24} color="#FFFFFF" />
          </Pressable>
          
          <Pressable
            onPress={onDelete}
            style={({ pressed }) => [
              styles.headerButton,
              { backgroundColor: theme.error, opacity: pressed ? 0.7 : 1 }
            ]}
          >
            <Feather name="trash-2" size={20} color="#FFFFFF" />
            <ThemedText style={{ color: "#FFFFFF", marginLeft: Spacing.xs }}>Delete</ThemedText>
          </Pressable>
        </View>

        <View style={styles.imageContainer}>
          <Image
            source={{ uri: photoUri }}
            style={styles.fullImage}
            resizeMode="contain"
          />
        </View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
          <ThemedText type="caption" style={{ color: "#FFFFFF", opacity: 0.7 }}>
            Tap X to close or Delete to remove this photo
          </ThemedText>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
  },
  headerButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  imageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  fullImage: {
    width: screenWidth - Spacing.lg * 2,
    height: screenHeight * 0.7,
  },
  footer: {
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
  },
});
