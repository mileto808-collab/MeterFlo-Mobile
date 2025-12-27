import React from "react";
import { Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { ComponentProps } from "react";

type FeatherIconName = ComponentProps<typeof Feather>["name"];

interface IconProps {
  name: FeatherIconName;
  size?: number;
  color?: string;
}

export function Icon({ name, size = 24, color = "#000000" }: IconProps) {
  return <Feather name={name} size={size} color={color} />;
}

const styles = StyleSheet.create({
  fallback: {
    textAlign: "center",
  },
});
