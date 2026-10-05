import React, { useState, useCallback, useEffect, useRef } from "react";
import { View, StyleSheet, Image } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { captureRef } from "react-native-view-shot";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius } from "@/constants/theme";

interface SignaturePadProps {
  onSignatureChange: (signatureData: string) => void;
  height?: number;
  initialValue?: string;
}

export function SignaturePad({ onSignatureChange, height = 200, initialValue }: SignaturePadProps) {
  const { theme } = useTheme();
  const [paths, setPaths] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState<string>("");
  const [showExisting, setShowExisting] = useState(Boolean(initialValue));
  const onSignatureChangeRef = useRef(onSignatureChange);
  const viewRef = useRef<View>(null);
  const captureTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  useEffect(() => {
    onSignatureChangeRef.current = onSignatureChange;
  }, [onSignatureChange]);
  
  const captureSignature = useCallback(async () => {
    if (viewRef.current && paths.length > 0) {
      try {
        const uri = await captureRef(viewRef, {
          format: "png",
          quality: 1,
          result: "base64",
        });
        const base64WithPrefix = `data:image/png;base64,${uri}`;
        onSignatureChangeRef.current(base64WithPrefix);
      } catch (error) {
        console.error("[SignaturePad] Failed to capture signature:", error);
      }
    }
  }, [paths.length]);
  
  useEffect(() => {
    if (captureTimeoutRef.current) {
      clearTimeout(captureTimeoutRef.current);
    }
    
    if (paths.length > 0) {
      captureTimeoutRef.current = setTimeout(() => {
        captureSignature();
      }, 100);
    }
    
    return () => {
      if (captureTimeoutRef.current) {
        clearTimeout(captureTimeoutRef.current);
      }
    };
  }, [paths, captureSignature]);

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
    setShowExisting(false);
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
  const displayExisting = showExisting && initialValue;

  return (
    <View style={styles.container}>
      {displayExisting ? (
        <View
          style={[
            styles.signatureArea,
            { 
              height,
              backgroundColor: "#FFFFFF",
              borderColor: theme.primary,
            }
          ]}
        >
          <Image
            source={{ uri: initialValue }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="contain"
          />
        </View>
      ) : (
        <GestureDetector gesture={panGesture}>
          <View
            ref={viewRef}
            collapsable={false}
            style={[
              styles.signatureArea,
              { 
                height,
                backgroundColor: "#FFFFFF",
                borderColor: hasSignature ? theme.primary : theme.border,
              }
            ]}
          >
            <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
              {paths.map((path, index) => (
                <Path
                  key={index}
                  d={path}
                  stroke="#000000"
                  strokeWidth={2}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
              {currentPath ? (
                <Path
                  d={currentPath}
                  stroke="#000000"
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
      )}
      
      {(hasSignature || displayExisting) ? (
        <Button
          onPress={clearSignature}
          style={{ backgroundColor: theme.backgroundSecondary, marginTop: Spacing.sm }}
        >
          <ThemedText>{displayExisting ? "Re-sign" : "Clear Signature"}</ThemedText>
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
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems: "center",
  },
});
