import React, { useState, useCallback, useEffect, useRef } from "react";
import { View, StyleSheet } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius } from "@/constants/theme";

interface SignaturePadProps {
  onSignatureChange: (signatureData: string) => void;
  height?: number;
}

export function SignaturePad({ onSignatureChange, height = 200 }: SignaturePadProps) {
  const { theme } = useTheme();
  const [paths, setPaths] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState<string>("");
  const onSignatureChangeRef = useRef(onSignatureChange);
  
  useEffect(() => {
    onSignatureChangeRef.current = onSignatureChange;
  }, [onSignatureChange]);
  
  useEffect(() => {
    if (paths.length > 0) {
      const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="${height}" viewBox="0 0 300 ${height}"><path d="${paths.join(" ")}" stroke="#000" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      onSignatureChangeRef.current(svgString);
    }
  }, [paths, height]);

  const addPoint = useCallback((x: number, y: number, isStart: boolean) => {
    if (isStart) {
      setCurrentPath(`M ${x} ${y}`);
    } else {
      setCurrentPath(prev => `${prev} L ${x} ${y}`);
    }
  }, []);

  const finishPath = useCallback(() => {
    if (currentPath) {
      setPaths(prev => [...prev, currentPath]);
      setCurrentPath("");
    }
  }, [currentPath]);

  const clearSignature = useCallback(() => {
    setPaths([]);
    setCurrentPath("");
    onSignatureChangeRef.current("");
  }, []);

  const panGesture = Gesture.Pan()
    .onStart((event) => {
      runOnJS(addPoint)(event.x, event.y, true);
    })
    .onUpdate((event) => {
      runOnJS(addPoint)(event.x, event.y, false);
    })
    .onEnd(() => {
      runOnJS(finishPath)();
    });

  const hasSignature = paths.length > 0 || currentPath.length > 0;

  return (
    <View style={styles.container}>
      <GestureDetector gesture={panGesture}>
        <View
          style={[
            styles.signatureArea,
            { 
              height,
              backgroundColor: theme.backgroundDefault,
              borderColor: hasSignature ? theme.primary : theme.border,
            }
          ]}
        >
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
            {paths.map((path, index) => (
              <Path
                key={index}
                d={path}
                stroke={theme.text}
                strokeWidth={2}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            {currentPath ? (
              <Path
                d={currentPath}
                stroke={theme.text}
                strokeWidth={2}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
          </Svg>
          
          {!hasSignature ? (
            <View style={styles.placeholder}>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                Sign here
              </ThemedText>
            </View>
          ) : null}
        </View>
      </GestureDetector>
      
      {hasSignature ? (
        <Button
          onPress={clearSignature}
          style={{ backgroundColor: theme.backgroundSecondary, marginTop: Spacing.sm }}
        >
          <ThemedText>Clear Signature</ThemedText>
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  signatureArea: {
    width: "100%",
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
});
