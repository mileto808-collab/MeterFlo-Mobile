import React from "react";
import { View } from "react-native";
import { ThemedText } from "./ThemedText";
import { Button } from "./Button";

export function ProjectReadingStatus({ settings }: {
  settings: { ready: boolean; error: string; usingCache?: boolean; retry: () => Promise<unknown> };
}) {
  if (settings.ready && !settings.usingCache) return null;
  return <View style={{ padding: 12 }}>
    <ThemedText>{settings.ready && settings.usingCache
      ? "Using this project's cached offline reading settings. A fresh server check is required before upload."
      : settings.error || "Loading this project's reading settings…"}</ThemedText>
    {settings.error || settings.usingCache ? <Button onPress={() => void settings.retry()}>Refresh settings</Button> : null}
  </View>;
}
