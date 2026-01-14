#!/bin/bash

set -e

echo "=== MeterFlo Android Release Build ==="
echo ""

cd "$(dirname "$0")/.."

echo "[1/5] Cleaning previous builds..."
rm -rf android/app/build
rm -rf android/app/src/main/assets/index.android.bundle

echo "[2/5] Creating assets directory..."
mkdir -p android/app/src/main/assets

echo "[3/5] Bundling JavaScript..."
npx react-native bundle \
  --platform android \
  --dev false \
  --entry-file index.js \
  --bundle-output android/app/src/main/assets/index.android.bundle \
  --assets-dest android/app/src/main/res

echo "[4/5] Building release APK..."
cd android
./gradlew assembleRelease

echo ""
echo "[5/5] Build complete!"
echo ""
echo "APK location:"
echo "  android/app/build/outputs/apk/release/app-release.apk"
echo ""
