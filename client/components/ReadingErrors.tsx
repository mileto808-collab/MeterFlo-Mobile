import React from "react";
import { View } from "react-native";
import { ThemedText } from "./ThemedText";
import { ReadingError, ReadingLimits, validateReadingData } from "@/lib/reading-precision";

export function ReadingErrors({ data, limits, errors = [] }: {
  data: Record<string, any>;
  limits: ReadingLimits;
  errors?: ReadingError[];
}) {
  const validation = validateReadingData(data, limits);
  return (
    <View accessibilityLiveRegion="polite" style={{ gap: 6, marginVertical: 8 }}>
      <ThemedText type="caption">
        Maximum decimal places: systems {limits.systemReadingDecimalPlaces}; modules {limits.moduleReadingDecimalPlaces}.
      </ThemedText>
      {[...validation, ...errors].map((error, index) => (
        <ThemedText key={`${error.field}-${index}`} type="small" style={{ color: "#D32F2F" }}>
          {error.field.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2")}: {error.message}
        </ThemedText>
      ))}
    </View>
  );
}
