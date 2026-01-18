import React, { useState, useCallback } from "react";
import { View, ScrollView, StyleSheet, Pressable, Alert, Platform, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useHeaderHeight } from "@react-navigation/elements";
import * as MailComposer from "expo-mail-composer";
import { Icon } from "@/components/Icons";

import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";
import { 
  listBackupFiles, 
  deleteBackupFile, 
  shareBackup, 
  getBackupBase64,
  BackupFile 
} from "@/lib/backup";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function FilesScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { serverUrl, projectId } = useAuth();

  const [backupFiles, setBackupFiles] = useState<BackupFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const loadBackupFiles = useCallback(async () => {
    setIsLoading(true);
    try {
      const files = await listBackupFiles();
      setBackupFiles(files);
    } catch (err) {
      console.error("[Files] Error loading backup files:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadBackupFiles();
    }, [loadBackupFiles])
  );

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const handleShare = async (file: BackupFile) => {
    try {
      setActionInProgress(file.path);
      await shareBackup(file.path);
    } catch (err) {
      Alert.alert("Error", "Failed to share file");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleEmail = async (file: BackupFile) => {
    try {
      setActionInProgress(file.path);
      const isAvailable = await MailComposer.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert("Email Not Available", "No email client is configured on this device.");
        return;
      }

      await MailComposer.composeAsync({
        subject: `MeterFlo Backup - ${file.name}`,
        body: `Please find attached the MeterFlo backup file: ${file.name}`,
        attachments: [file.path],
      });
    } catch (err) {
      Alert.alert("Error", "Failed to compose email");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleUploadToServer = async (file: BackupFile) => {
    if (!serverUrl || !projectId) {
      Alert.alert("Error", "Server connection not configured. Please log in again.");
      return;
    }

    const confirmUpload = () => {
      return new Promise<boolean>((resolve) => {
        Alert.alert(
          "Upload to Project Documents",
          `Upload "${file.name}" to the server's Project Documents folder?`,
          [
            { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
            { text: "Upload", onPress: () => resolve(true) },
          ]
        );
      });
    };

    const confirmed = await confirmUpload();
    if (!confirmed) return;

    try {
      setActionInProgress(file.path);
      
      const base64Content = await getBackupBase64(file.path);
      if (!base64Content) {
        throw new Error("Failed to read backup file");
      }

      const response = await fetch(`${serverUrl}/api/projects/${projectId}/documents/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
          "Origin": serverUrl,
          "Referer": `${serverUrl}/`,
        },
        credentials: "include",
        body: JSON.stringify({
          filename: file.name,
          contentBase64: base64Content,
          mimeType: "application/zip",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Upload failed with status ${response.status}`);
      }

      Alert.alert("Success", `"${file.name}" has been uploaded to Project Documents.`);
    } catch (err: any) {
      Alert.alert("Upload Failed", err.message || "Failed to upload file to server");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDelete = async (file: BackupFile) => {
    const confirmDelete = () => {
      return new Promise<boolean>((resolve) => {
        Alert.alert(
          "Delete Backup",
          `Are you sure you want to delete "${file.name}"? This cannot be undone.`,
          [
            { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
            { text: "Delete", style: "destructive", onPress: () => resolve(true) },
          ]
        );
      });
    };

    const confirmed = await confirmDelete();
    if (!confirmed) return;

    try {
      setActionInProgress(file.path);
      const success = await deleteBackupFile(file.path);
      if (success) {
        setBackupFiles(prev => prev.filter(f => f.path !== file.path));
      } else {
        Alert.alert("Error", "Failed to delete file");
      }
    } catch (err) {
      Alert.alert("Error", "Failed to delete file");
    } finally {
      setActionInProgress(null);
    }
  };

  const renderFileActions = (file: BackupFile) => {
    const isProcessing = actionInProgress === file.path;

    if (isProcessing) {
      return (
        <View style={styles.actionsRow}>
          <ActivityIndicator size="small" color={theme.primary} />
        </View>
      );
    }

    return (
      <View style={styles.actionsRow}>
        <Pressable
          onPress={() => handleShare(file)}
          style={({ pressed }) => [
            styles.actionButton,
            { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Icon name="share-2" size={18} color={theme.primary} />
          <ThemedText type="small" style={{ color: theme.primary }}>View</ThemedText>
        </Pressable>

        <Pressable
          onPress={() => handleUploadToServer(file)}
          style={({ pressed }) => [
            styles.actionButton,
            { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Icon name="upload-cloud" size={18} color={theme.success} />
          <ThemedText type="small" style={{ color: theme.success }}>Upload</ThemedText>
        </Pressable>

        <Pressable
          onPress={() => handleEmail(file)}
          style={({ pressed }) => [
            styles.actionButton,
            { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Icon name="mail" size={18} color={theme.warning} />
          <ThemedText type="small" style={{ color: theme.warning }}>Email</ThemedText>
        </Pressable>

        <Pressable
          onPress={() => handleDelete(file)}
          style={({ pressed }) => [
            styles.actionButton,
            { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Icon name="trash-2" size={18} color={theme.error} />
          <ThemedText type="small" style={{ color: theme.error }}>Delete</ThemedText>
        </Pressable>
      </View>
    );
  };

  if (Platform.OS === "web") {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <View style={[styles.emptyState, { marginTop: headerHeight + Spacing.xl, backgroundColor: theme.backgroundDefault }]}>
          <Icon name="folder" size={48} color={theme.textSecondary} />
          <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center" }}>
            File management is only available on mobile devices.
          </ThemedText>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        style={{ marginTop: headerHeight }}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
      >
        <View style={[styles.infoSection, { backgroundColor: theme.backgroundDefault }]}>
          <Icon name="info" size={20} color={theme.primary} />
          <ThemedText type="small" style={{ color: theme.textSecondary, flex: 1 }}>
            Backup files are created when you use "Clear All Data & Refresh" in the Sync tab. 
            They contain work order data and photos.
          </ThemedText>
        </View>

        {isLoading ? (
          <View style={[styles.emptyState, { backgroundColor: theme.backgroundDefault }]}>
            <ActivityIndicator size="large" color={theme.primary} />
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              Loading backup files...
            </ThemedText>
          </View>
        ) : backupFiles.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: theme.backgroundDefault }]}>
            <Icon name="folder" size={48} color={theme.textSecondary} />
            <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center" }}>
              No backup files found.
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center" }}>
              Backups are created when you use "Clear All Data & Refresh" in the Sync tab.
            </ThemedText>
          </View>
        ) : (
          <View style={styles.filesList}>
            <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>
              Backup Files ({backupFiles.length})
            </ThemedText>
            {backupFiles.map((file) => (
              <View
                key={file.path}
                style={[styles.fileCard, { backgroundColor: theme.backgroundDefault }]}
              >
                <View style={styles.fileHeader}>
                  <Icon name="file" size={24} color={theme.primary} />
                  <View style={styles.fileInfo}>
                    <ThemedText type="body" numberOfLines={2} style={{ fontWeight: "600" }}>
                      {file.name}
                    </ThemedText>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>
                      {formatFileSize(file.size)} • {formatDate(file.modifiedTime)}
                    </ThemedText>
                  </View>
                </View>
                {renderFileActions(file)}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  infoSection: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  emptyState: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
  },
  filesList: {
    gap: Spacing.md,
  },
  fileCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  fileHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  fileInfo: {
    flex: 1,
    gap: Spacing.xs,
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
});
