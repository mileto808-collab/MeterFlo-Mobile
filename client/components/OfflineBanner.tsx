import React from "react";
import { View, StyleSheet, ViewStyle, StyleProp } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Icon } from "@/components/Icons";
import { Spacing } from "@/constants/theme";

interface OfflineBannerProps {
  style?: StyleProp<ViewStyle>;
}

export function OfflineBanner({ style }: OfflineBannerProps) {
  return (
    <View style={[styles.banner, style]}>
      <Icon name="wifi-off" size={16} color="#FFFFFF" />
      <ThemedText style={styles.text}>
        Offline Mode - Changes will sync when connected
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F59E0B",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  text: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "500",
  },
});
