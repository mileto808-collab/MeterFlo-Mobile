import React, { useState, useCallback, useEffect } from "react";
import { View, StyleSheet, Pressable, Alert, Platform, TextInput, ActivityIndicator } from "react-native";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";

import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useOffline } from "@/contexts/OfflineContext";
import { useWorkOrders } from "@/contexts/WorkOrderContext";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icons";
import { Spacing, BorderRadius } from "@/constants/theme";
import {
  checkForUpdates,
  downloadUpdate,
  getStoredGitHubUrl,
  setGitHubUrl,
  getCurrentVersion,
  UpdateCheckResult,
} from "@/lib/github-updates";

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { user, serverUrl, projectId, projects, logout, isOfflineSession } = useAuth();
  const { isOnline } = useOffline();
  const { lastSyncTime } = useWorkOrders();

  const currentProject = projects.find(p => p.id === projectId);

  const [githubUrl, setGithubUrlState] = useState("");
  const [isEditingGithub, setIsEditingGithub] = useState(false);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);

  useEffect(() => {
    loadGitHubUrl();
  }, []);

  const loadGitHubUrl = async () => {
    const url = await getStoredGitHubUrl();
    if (url) {
      setGithubUrlState(url);
    }
  };

  const handleSaveGitHubUrl = async () => {
    await setGitHubUrl(githubUrl);
    setIsEditingGithub(false);
    setUpdateResult(null);
  };

  const handleCheckForUpdates = useCallback(async () => {
    if (!githubUrl) {
      Alert.alert("No Repository", "Please configure a GitHub repository URL first.");
      return;
    }
    
    setIsCheckingUpdates(true);
    setUpdateResult(null);
    
    try {
      const result = await checkForUpdates(githubUrl);
      setUpdateResult(result);
      
      if (result.error) {
        Alert.alert("Update Check Failed", result.error);
      } else if (result.updateAvailable && result.updateInfo) {
        Alert.alert(
          "Update Available",
          `Version ${result.latestVersion} is available.\n\nCurrent version: ${result.currentVersion}\n\n${result.updateInfo.releaseNotes || ""}`,
          [
            { text: "Later", style: "cancel" },
            { 
              text: "Download", 
              onPress: () => downloadUpdate(result.updateInfo!.apkUrl)
            },
          ]
        );
      } else {
        Alert.alert("Up to Date", `You have the latest version (${result.currentVersion}).`);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to check for updates.");
    } finally {
      setIsCheckingUpdates(false);
    }
  }, [githubUrl]);

  const handleLogout = () => {
    if (Platform.OS === "web") {
      logout();
      return;
    }

    Alert.alert(
      "Log Out",
      "Are you sure you want to log out? Any unsynced changes will remain on this device.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Log Out", style: "destructive", onPress: logout },
      ]
    );
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: tabBarHeight + Spacing.xl,
        },
      ]}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.profileCard, { backgroundColor: theme.backgroundDefault }]}>
        <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
          <Icon name="user" size={32} color="#FFFFFF" />
        </View>
        <View style={styles.profileInfo}>
          <ThemedText type="h3">{user?.displayName || user?.username || "User"}</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            @{user?.username || "username"}
          </ThemedText>
          <View style={[styles.roleBadge, { backgroundColor: theme.primary + "20" }]}>
            <ThemedText type="caption" style={{ color: theme.primary }}>
              {user?.role || "User"}
            </ThemedText>
          </View>
        </View>
      </View>

      {isOfflineSession ? (
        <View style={[styles.offlineSessionBanner, { backgroundColor: theme.warning + "20" }]}>
          <Icon name="wifi-off" size={20} color={theme.warning} />
          <View style={styles.offlineSessionText}>
            <ThemedText type="body" style={{ color: theme.warning, fontWeight: "600" }}>
              Offline Session
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              You logged in using saved credentials. Changes will sync when you reconnect.
            </ThemedText>
          </View>
        </View>
      ) : null}

      {currentProject ? (
        <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText type="h4" style={styles.sectionTitle}>Current Project</ThemedText>
          
          <View style={styles.infoRow}>
            <View style={styles.infoLabel}>
              <Icon name="folder" size={16} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary }}>Project</ThemedText>
            </View>
            <ThemedText type="body" numberOfLines={1} style={styles.infoValue}>
              {currentProject.name}
            </ThemedText>
          </View>

          {currentProject.description ? (
            <View style={styles.infoRow}>
              <View style={styles.infoLabel}>
                <Icon name="file-text" size={16} color={theme.textSecondary} />
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Description</ThemedText>
              </View>
              <ThemedText type="body" numberOfLines={2} style={styles.infoValue}>
                {currentProject.description}
              </ThemedText>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
        <ThemedText type="h4" style={styles.sectionTitle}>Server Connection</ThemedText>
        
        <View style={styles.infoRow}>
          <View style={styles.infoLabel}>
            <Icon name="globe" size={16} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary }}>Server URL</ThemedText>
          </View>
          <ThemedText type="body" numberOfLines={1} style={styles.infoValue}>
            {serverUrl || "Not configured"}
          </ThemedText>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoLabel}>
            <Icon name={isOnline ? "wifi" : "wifi-off"} size={16} color={isOnline ? theme.success : theme.warning} />
            <ThemedText type="small" style={{ color: theme.textSecondary }}>Status</ThemedText>
          </View>
          <View style={[
            styles.statusIndicator,
            { backgroundColor: isOnline ? theme.success + "20" : theme.warning + "20" }
          ]}>
            <ThemedText type="small" style={{ color: isOnline ? theme.success : theme.warning }}>
              {isOnline ? "Connected" : "Offline"}
            </ThemedText>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoLabel}>
            <Icon name="refresh-cw" size={16} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary }}>Last Sync</ThemedText>
          </View>
          <ThemedText type="body">{formatTime(lastSyncTime)}</ThemedText>
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
        <ThemedText type="h4" style={styles.sectionTitle}>App Updates</ThemedText>
        
        <View style={styles.infoRow}>
          <View style={styles.infoLabel}>
            <Icon name="github" size={16} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary }}>GitHub Repository</ThemedText>
          </View>
          {isEditingGithub ? null : (
            <Pressable onPress={() => setIsEditingGithub(true)}>
              <Icon name="edit-2" size={16} color={theme.primary} />
            </Pressable>
          )}
        </View>
        
        {isEditingGithub ? (
          <View style={styles.githubEditContainer}>
            <TextInput
              style={[
                styles.githubInput,
                { 
                  backgroundColor: theme.backgroundSecondary,
                  color: theme.text,
                  borderColor: theme.border,
                }
              ]}
              value={githubUrl}
              onChangeText={setGithubUrlState}
              placeholder="https://github.com/owner/repo"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <View style={styles.githubButtonRow}>
              <Pressable 
                style={[styles.githubButton, { backgroundColor: theme.backgroundSecondary }]}
                onPress={() => {
                  setIsEditingGithub(false);
                  loadGitHubUrl();
                }}
              >
                <ThemedText type="small">Cancel</ThemedText>
              </Pressable>
              <Pressable 
                style={[styles.githubButton, { backgroundColor: theme.primary }]}
                onPress={handleSaveGitHubUrl}
              >
                <ThemedText type="small" style={{ color: "#FFFFFF" }}>Save</ThemedText>
              </Pressable>
            </View>
          </View>
        ) : (
          <ThemedText type="body" numberOfLines={1} style={{ color: githubUrl ? theme.text : theme.textSecondary }}>
            {githubUrl || "Not configured - tap edit to set up"}
          </ThemedText>
        )}

        <Pressable
          style={[
            styles.updateButton,
            { 
              backgroundColor: theme.primary,
              opacity: isCheckingUpdates || !githubUrl ? 0.6 : 1,
            }
          ]}
          onPress={handleCheckForUpdates}
          disabled={isCheckingUpdates || !githubUrl}
        >
          {isCheckingUpdates ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Icon name="download" size={18} color="#FFFFFF" />
          )}
          <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600" }}>
            {isCheckingUpdates ? "Checking..." : "Check for Updates"}
          </ThemedText>
        </Pressable>

        {updateResult && !updateResult.error ? (
          <View style={[
            styles.updateStatus,
            { backgroundColor: updateResult.updateAvailable ? theme.warning + "20" : theme.success + "20" }
          ]}>
            <Icon 
              name={updateResult.updateAvailable ? "alert-circle" : "check-circle"} 
              size={16} 
              color={updateResult.updateAvailable ? theme.warning : theme.success} 
            />
            <ThemedText type="small" style={{ color: updateResult.updateAvailable ? theme.warning : theme.success }}>
              {updateResult.updateAvailable 
                ? `Update available: v${updateResult.latestVersion}` 
                : `Up to date (v${updateResult.currentVersion})`}
            </ThemedText>
          </View>
        ) : null}
      </View>

      <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
        <ThemedText type="h4" style={styles.sectionTitle}>App Information</ThemedText>
        
        <View style={styles.infoRow}>
          <View style={styles.infoLabel}>
            <Icon name="info" size={16} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary }}>Version</ThemedText>
          </View>
          <ThemedText type="body">{getCurrentVersion()}</ThemedText>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoLabel}>
            <Icon name="smartphone" size={16} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary }}>App</ThemedText>
          </View>
          <ThemedText type="body">MeterFlo Mobile</ThemedText>
        </View>
      </View>

      <View style={styles.logoutSection}>
        <Button
          onPress={handleLogout}
          style={[styles.logoutButton, { backgroundColor: theme.error }]}
        >
          Log Out
        </Button>
      </View>
    </KeyboardAwareScrollViewCompat>
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
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.md,
    gap: Spacing.lg,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  profileInfo: {
    flex: 1,
    gap: Spacing.xs,
  },
  roleBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
    marginTop: Spacing.xs,
  },
  section: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  sectionTitle: {
    marginBottom: Spacing.sm,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  infoLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  infoValue: {
    flex: 1,
    textAlign: "right",
  },
  statusIndicator: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  logoutSection: {
    marginTop: Spacing.xl,
  },
  logoutButton: {},
  offlineSessionBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  offlineSessionText: {
    flex: 1,
    gap: Spacing.xs,
  },
  githubEditContainer: {
    gap: Spacing.sm,
  },
  githubInput: {
    height: Spacing.inputHeight,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    fontSize: 14,
  },
  githubButtonRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.sm,
  },
  githubButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  updateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
  },
  updateStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
});
