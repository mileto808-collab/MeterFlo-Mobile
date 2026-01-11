import React, { useState } from "react";
import { View, StyleSheet, Image, Pressable, ActivityIndicator, Alert, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { TextInput } from "@/components/TextInput";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Icon } from "@/components/Icons";
import { Spacing, BorderRadius } from "@/constants/theme";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { login, serverUrl: savedServerUrl, mobileApiKey: savedMobileApiKey, setMobileApiKey, isLoading } = useAuth();

  const [serverUrl, setServerUrl] = useState(savedServerUrl || "https://");
  const [mobileApiKey, setMobileApiKeyLocal] = useState(savedMobileApiKey || "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [error, setError] = useState("");

  const isValid = serverUrl.length > 8 && username.length > 0 && password.length > 0;

  const handleLogin = async () => {
    if (!isValid || isLoading) return;
    
    setError("");
    try {
      // Save the mobile API key before login
      await setMobileApiKey(mobileApiKey);
      await login(serverUrl, username, password);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed. Please try again.";
      setError(message);
      if (Platform.OS !== "web") {
        Alert.alert("Login Failed", message);
      }
    }
  };

  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + Spacing["3xl"],
          paddingBottom: insets.bottom + Spacing["3xl"],
        },
      ]}
    >
      <View style={styles.logoContainer}>
        <Image
          source={require("../../assets/images/login-logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <ThemedText type="small" style={[styles.tagline, { color: theme.textSecondary }]}>
          Mobile Work Order Management
        </ThemedText>
      </View>

      <View style={[styles.card, { backgroundColor: theme.backgroundDefault }]}>
        <View style={styles.inputGroup}>
          <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>
            Server URL
          </ThemedText>
          <TextInput
            value={serverUrl}
            onChangeText={setServerUrl}
            placeholder="https://your-meterflo-server.com"
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.inputGroup}>
          <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>
            Mobile API Key (optional)
          </ThemedText>
          <View style={styles.passwordContainer}>
            <TextInput
              value={mobileApiKey}
              onChangeText={setMobileApiKeyLocal}
              placeholder="Enter mobile API key if required"
              secureTextEntry={!showApiKey}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.passwordInput}
            />
            <Pressable
              onPress={() => setShowApiKey(!showApiKey)}
              style={styles.eyeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon
                name={showApiKey ? "eye-off" : "eye"}
                size={20}
                color={theme.textSecondary}
              />
            </Pressable>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>
            Username
          </ThemedText>
          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="Enter your username"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.inputGroup}>
          <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>
            Password
          </ThemedText>
          <View style={styles.passwordContainer}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.passwordInput}
            />
            <Pressable
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon
                name={showPassword ? "eye-off" : "eye"}
                size={20}
                color={theme.textSecondary}
              />
            </Pressable>
          </View>
        </View>

        {error ? (
          <View style={[styles.errorContainer, { backgroundColor: theme.error + "15" }]}>
            <Icon name="alert-circle" size={16} color={theme.error} />
            <ThemedText type="small" style={[styles.errorText, { color: theme.error }]}>
              {error}
            </ThemedText>
          </View>
        ) : null}

        <Button
          onPress={handleLogin}
          disabled={!isValid || isLoading}
          style={[styles.loginButton, { backgroundColor: theme.primary }]}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            "Sign In"
          )}
        </Button>
      </View>

      <ThemedText type="caption" style={[styles.version, { color: theme.textSecondary }]}>
        Version 1.0.0
      </ThemedText>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    justifyContent: "center",
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: Spacing["3xl"],
  },
  logo: {
    width: 200,
    height: 200,
    marginBottom: Spacing.lg,
  },
  tagline: {
    textAlign: "center",
  },
  card: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  label: {
    marginBottom: Spacing.sm,
  },
  passwordContainer: {
    position: "relative",
  },
  passwordInput: {
    paddingRight: 48,
  },
  eyeButton: {
    position: "absolute",
    right: Spacing.lg,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.lg,
  },
  errorText: {
    marginLeft: Spacing.sm,
    flex: 1,
  },
  loginButton: {
    marginTop: Spacing.sm,
  },
  version: {
    textAlign: "center",
    marginTop: Spacing["3xl"],
  },
});
