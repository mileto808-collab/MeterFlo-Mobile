import React from "react";
import { Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";

type IoniconsIconName = ComponentProps<typeof Ionicons>["name"];

interface IconProps {
  name: IoniconsIconName;
  size?: number;
  color?: string;
}

export function Icon({ name, size = 24, color = "#000000" }: IconProps) {
  return <Ionicons name={name} size={size} color={color} />;
}

const styles = StyleSheet.create({
  fallback: {
    textAlign: "center",
  },
});
