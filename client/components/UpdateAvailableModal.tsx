import React, { useState } from "react";
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Platform,
  Linking,
} from "react-native";
import { ThemedText } from "./ThemedText";
import { ThemedView } from "./ThemedView";
import { Icon } from "./Icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { 
  UpdateInfo, 
  formatFileSize, 
  applyUpdate, 
  getUpdateActionLabel,
  getUpdateSourceLabel,
} from "@/lib/update-service";
import * as FileSystem from "expo-file-system/legacy";
import { startActivityAsync } from "expo-intent-launcher";

interface UpdateAvailableModalProps {
  visible: boolean;
  updateInfo: UpdateInfo | null;
  onClose: () => void;
  onSkip: () => void;
}

export function UpdateAvailableModal({
  visible,
  updateInfo,
  onClose,
  onSkip,
}: UpdateAvailableModalProps) {
  const { theme } = useTheme();
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  if (!updateInfo) return null;

  const handleUpdate = async () => {
    if (updateInfo.source === "eas" && updateInfo.canInstallDirectly) {
      setIsDownloading(true);
      setError(null);
      try {
        console.log("[UpdateModal] Applying EAS update...");
        const success = await applyUpdate(updateInfo);
        if (!success) {
          throw new Error("Failed to apply over-the-air update");
        }
      } catch (err) {
        console.error("[UpdateModal] EAS update error:", err);
        const errorMessage = err instanceof Error ? err.message : "Failed to apply update";
        setError(errorMessage);
        setIsDownloading(false);
      }
      return;
    }

    if (updateInfo.source === "appstore") {
      if (updateInfo.releaseUrl) {
        await Linking.openURL(updateInfo.releaseUrl);
      }
      onClose();
      return;
    }

    if (!updateInfo.downloadUrl) {
      if (updateInfo.releaseUrl) {
        Linking.openURL(updateInfo.releaseUrl);
      }
      return;
    }

    if (Platform.OS !== "android") {
      if (updateInfo.releaseUrl) {
        Linking.openURL(updateInfo.releaseUrl);
      }
      return;
    }

    if (!updateInfo.downloadUrl.startsWith("https://")) {
      setError("Update rejected: Download URL must use HTTPS for security.");
      return;
    }

    setIsDownloading(true);
    setError(null);
    setDownloadProgress(0);

    try {
      const fileName = `meterflo-${updateInfo.latestVersion}.apk`;
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

      console.log("[UpdateModal] Starting download from:", updateInfo.downloadUrl);
      console.log("[UpdateModal] Saving to:", fileUri);

      const downloadResumable = FileSystem.createDownloadResumable(
        updateInfo.downloadUrl,
        fileUri,
        {},
        (downloadProgress) => {
          const progress =
            downloadProgress.totalBytesWritten /
            downloadProgress.totalBytesExpectedToWrite;
          setDownloadProgress(Math.round(progress * 100));
        }
      );

      const result = await downloadResumable.downloadAsync();

      if (!result?.uri) {
        console.error("[UpdateModal] Download failed - no URI returned");
        throw new Error("Download failed - no file URI returned");
      }

      console.log("[UpdateModal] Download complete, file saved to:", result.uri);
      
      const fileInfo = await FileSystem.getInfoAsync(result.uri);
      console.log("[UpdateModal] File info:", JSON.stringify(fileInfo));
      
      if (!fileInfo.exists) {
        throw new Error("Downloaded file does not exist");
      }

      const contentUri = await FileSystem.getContentUriAsync(result.uri);
      console.log("[UpdateModal] Content URI for installer:", contentUri);
      
      console.log("[UpdateModal] Launching package installer...");
      await startActivityAsync("android.intent.action.VIEW", {
        data: contentUri,
        flags: 1,
        type: "application/vnd.android.package-archive",
      });
      
      console.log("[UpdateModal] Package installer launched successfully");
      onClose();
    } catch (err) {
      console.error("[UpdateModal] Download/install error:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to download update";
      console.error("[UpdateModal] Error details:", errorMessage);
      setError(errorMessage);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleOpenInBrowser = () => {
    Linking.openURL(updateInfo.releaseUrl);
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <ThemedView style={[styles.modal, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.header}>
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: theme.primary + "20" },
              ]}
            >
              <Icon name="download" size={28} color={theme.primary} />
            </View>
            <ThemedText style={styles.title}>Update Available</ThemedText>
            <ThemedText style={styles.version}>
              Version {updateInfo.latestVersion}
            </ThemedText>
          </View>

          <View style={styles.versionInfo}>
            <View style={styles.versionRow}>
              <ThemedText style={styles.versionLabel}>Current:</ThemedText>
              <ThemedText style={styles.versionValue}>
                {updateInfo.currentVersion}
              </ThemedText>
            </View>
            <View style={styles.versionRow}>
              <ThemedText style={styles.versionLabel}>New:</ThemedText>
              <ThemedText
                style={[styles.versionValue, { color: theme.primary }]}
              >
                {updateInfo.latestVersion}
              </ThemedText>
            </View>
            {updateInfo.fileSize ? (
              <View style={styles.versionRow}>
                <ThemedText style={styles.versionLabel}>Size:</ThemedText>
                <ThemedText style={styles.versionValue}>
                  {formatFileSize(updateInfo.fileSize)}
                </ThemedText>
              </View>
            ) : null}
            <View style={styles.versionRow}>
              <ThemedText style={styles.versionLabel}>Source:</ThemedText>
              <ThemedText style={styles.versionValue}>
                {getUpdateSourceLabel(updateInfo.source)}
              </ThemedText>
            </View>
          </View>

          <View style={styles.releaseNotesContainer}>
            <ThemedText style={styles.releaseNotesTitle}>
              What's New:
            </ThemedText>
            <ScrollView
              style={styles.releaseNotesScroll}
              showsVerticalScrollIndicator={false}
            >
              <ThemedText style={styles.releaseNotes}>
                {updateInfo.releaseNotes}
              </ThemedText>
            </ScrollView>
          </View>

          {error ? (
            <View
              style={[
                styles.errorContainer,
                { backgroundColor: theme.error + "20" },
              ]}
            >
              <Icon name="alert-circle" size={16} color={theme.error} />
              <ThemedText style={[styles.errorText, { color: theme.error }]}>
                {error}
              </ThemedText>
            </View>
          ) : null}

          {isDownloading ? (
            <View style={styles.downloadingContainer}>
              <ActivityIndicator size="small" color={theme.primary} />
              <ThemedText style={styles.downloadingText}>
                Downloading... {downloadProgress}%
              </ThemedText>
              <View
                style={[
                  styles.progressBar,
                  { backgroundColor: theme.border },
                ]}
              >
                <View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: theme.primary,
                      width: `${downloadProgress}%`,
                    },
                  ]}
                />
              </View>
            </View>
          ) : (
            <View style={styles.actions}>
              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  styles.primaryButton,
                  { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 },
                ]}
                onPress={handleUpdate}
              >
                <Icon 
                  name={updateInfo.canInstallDirectly ? "download" : "external-link"} 
                  size={18} 
                  color="#FFFFFF" 
                />
                <ThemedText style={styles.primaryButtonText}>
                  {getUpdateActionLabel(updateInfo)}
                </ThemedText>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  styles.secondaryButton,
                  { borderColor: theme.border, opacity: pressed ? 0.8 : 1 },
                ]}
                onPress={onSkip}
              >
                <ThemedText style={styles.secondaryButtonText}>
                  Skip This Version
                </ThemedText>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  styles.textButton,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
                onPress={onClose}
              >
                <ThemedText style={[styles.textButtonText, { color: theme.textSecondary }]}>
                  Remind Me Later
                </ThemedText>
              </Pressable>
            </View>
          )}
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  modal: {
    width: "100%",
    maxWidth: 400,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  version: {
    fontSize: 14,
    opacity: 0.7,
  },
  versionInfo: {
    marginBottom: Spacing.lg,
    gap: Spacing.xs,
  },
  versionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  versionLabel: {
    fontSize: 14,
    opacity: 0.7,
  },
  versionValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  releaseNotesContainer: {
    marginBottom: Spacing.lg,
  },
  releaseNotesTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  releaseNotesScroll: {
    maxHeight: 120,
  },
  releaseNotes: {
    fontSize: 13,
    lineHeight: 20,
    opacity: 0.8,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  errorText: {
    fontSize: 13,
    flex: 1,
  },
  downloadingContainer: {
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  downloadingText: {
    fontSize: 14,
    fontWeight: "500",
  },
  progressBar: {
    width: "100%",
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  actions: {
    gap: Spacing.sm,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  primaryButton: {},
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "500",
  },
  textButton: {},
  textButtonText: {
    fontSize: 14,
  },
});
