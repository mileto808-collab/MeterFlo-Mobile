import React from "react";
import { View, StyleSheet, FlatList, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, CommonActions } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useAuth, Project } from "@/contexts/AuthContext";
import { Icon } from "@/components/Icons";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ProjectSelectScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { projects, selectProject, logout, user, projectId } = useAuth();

  const isAlreadyInProject = projectId !== null;

  const handleSelectProject = async (project: Project) => {
    await selectProject(project.id);
    // If this is a modal (user is switching projects while authenticated), go back
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
    // When shown at root level during first login (canGoBack is false),
    // the auth state change in selectProject sets isAuthenticated=true,
    // which causes the navigator to automatically re-render with Main screen.
    // No manual navigation needed - React Navigation handles the transition.
  };

  const renderProject = ({ item }: { item: Project }) => {
    const isCurrentProject = item.id === projectId;
    
    return (
      <Pressable
        onPress={() => handleSelectProject(item)}
        style={({ pressed }) => [
          styles.projectCard,
          { 
            backgroundColor: isCurrentProject ? theme.primary + "15" : theme.backgroundDefault, 
            borderWidth: isCurrentProject ? 1 : 0,
            borderColor: theme.primary + "40",
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <View style={styles.projectInfo}>
          <View style={[styles.projectIcon, { backgroundColor: theme.primary + "20" }]}>
            <Icon name="folder" size={24} color={theme.primary} />
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
        {isCurrentProject ? (
          <Icon name="check" size={20} color={theme.primary} />
        ) : (
          <Icon name="chevron-right" size={20} color={theme.textSecondary} />
        )}
      </Pressable>
    );
  };

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
          {isAlreadyInProject ? (
            <Pressable
              onPress={() => {
                if (navigation.canGoBack()) {
                  navigation.goBack();
                } else {
                  // If we can't go back (rare: deep link), navigate to Main
                  // Use navigate instead of reset to avoid errors if Main isn't in current stack
                  navigation.dispatch(CommonActions.navigate({ name: "Main" }));
                }
              }}
              style={styles.backButton}
            >
              <Icon name="chevron-left" size={20} color={theme.text} />
              <ThemedText type="body">Cancel</ThemedText>
            </Pressable>
          ) : null}
          <ThemedText type="h2" style={styles.title}>
            {isAlreadyInProject ? "Switch Project" : "Select Project"}
          </ThemedText>
          <ThemedText type="body" style={[styles.subtitle, { color: theme.textSecondary }]}>
            {isAlreadyInProject 
              ? "Select a different project to switch to."
              : `Welcome, ${user?.displayName || user?.username}. Choose a project to continue.`
            }
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
          <Icon name="log-out" size={18} color={theme.textSecondary} />
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
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
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
