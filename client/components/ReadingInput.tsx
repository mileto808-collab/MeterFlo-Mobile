import React from "react";
import { View } from "react-native";
import { TextInput } from "./TextInput";
import { ThemedText } from "./ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { guardReadingInput, matchingReadingError, normalizeReading, ReadingError, ReadingLimits } from "@/lib/reading-precision";

type Props = Omit<React.ComponentProps<typeof TextInput>, "value" | "onChangeText"> & {
  value: string;
  onChangeText: (value: string) => void;
  field: string;
  limits: ReadingLimits;
  errors?: ReadingError[];
};

/** A hint and optional server rejection for this input only; no typing warnings. */
export function ReadingInput({ value, onChangeText, field, limits, errors = [], ...props }: Props) {
  const { theme } = useTheme();
  const module = /module/i.test(field);
  const decimalPlaces = module ? limits.moduleReadingDecimalPlaces : limits.systemReadingDecimalPlaces;
  const error = matchingReadingError(errors, field);
  return <View>
    <TextInput
      accessibilityLabel={field.replace(/([a-z])([A-Z])/g, "$1 $2")}
      {...props}
      keyboardType={decimalPlaces === 0 ? "number-pad" : "decimal-pad"}
      value={value}
      onChangeText={proposed => {
        const next = guardReadingInput(value, proposed, decimalPlaces);
        // Re-entering the same value still counts as technician confirmation.
        if (next !== value || next === normalizeReading(proposed)) onChangeText(next);
      }}
    />
    <ThemedText type="caption" style={{ marginTop: 6, color: theme.textSecondary }}>
      Maximum decimal places: {module ? "module" : "system"} {decimalPlaces}.
    </ThemedText>
    {error ? <ThemedText type="small" accessibilityLiveRegion="polite" style={{ marginTop: 6, color: theme.error }}>
      {error.message}
    </ThemedText> : null}
  </View>;
}
