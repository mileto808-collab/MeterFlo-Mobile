import React from "react";
import { View, StyleSheet, FlatList, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useAuth, Project } from "@/contexts/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";

export default function ProjectSelectScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { projects, selectProject, logout, user } = useAuth();

  const handleSelectProject = async (project: Project) => {
    await selectProject(project.id);
  };

  const renderProject = ({ item }: { item: Project }) => (
    <Pressable
      onPress={() => handleSelectProject(item)}
      style={({ pressed }) => [
        styles.projectCard,
        { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <View style={styles.projectInfo}>
        <View style={[styles.projectIcon, { backgroundColor: theme.primary + "20" }]}>
          <Ionicons name="folder-outline" size={24} color={theme.primary} />
        </View>
        <View style={styles.projectDetails}>
          <ThemedText type="body" style={styles.projectName}>
            {item.name}
          </ThemedText>
          {item.description ? (
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {item.description}
            </ThemedText>
          ) : null}
        </View>
      </View>
      <Ionicons name="chevron-forward-outline" size={20} color={theme.textSecondary} />
    </Pressable>
  );

  return (
    <ThemedView style={styles.container}>
      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + Spacing["3xl"],
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
      >
        <View style={styles.header}>
          <ThemedText type="h2" style={styles.title}>
            Select Project
          </ThemedText>
          <ThemedText type="body" style={[styles.subtitle, { color: theme.textSecondary }]}>
            Welcome, {user?.displayName || user?.username}. Choose a project to continue.
          </ThemedText>
        </View>

        <FlatList
          data={projects}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderProject}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
        />

        <Pressable
          onPress={logout}
          style={[styles.logoutButton, { borderColor: theme.border }]}
        >
          <Ionicons name="log-out-outline" size={18} color={theme.textSecondary} />
          <ThemedText type="body" style={[styles.logoutText, { color: theme.textSecondary }]}>
            Sign out
          </ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  header: {
    marginBottom: Spacing["2xl"],
  },
  title: {
    marginBottom: Spacing.sm,
  },
  subtitle: {
    lineHeight: 22,
  },
  list: {
    paddingBottom: Spacing.xl,
  },
  projectCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  projectInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  projectIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.lg,
  },
  projectDetails: {
    flex: 1,
  },
  projectName: {
    fontWeight: "600",
    marginBottom: 2,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    borderTopWidth: 1,
  },
  logoutText: {
    marginLeft: Spacing.sm,
  },
});
