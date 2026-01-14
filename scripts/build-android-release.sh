#!/bin/bash

set -e

echo "=== MeterFlo Android Release Build ==="
echo ""

cd "$(dirname "$0")/.."

echo "[1/4] Cleaning previous builds..."
rm -rf android/app/build
rm -rf dist

echo "[2/4] Exporting JavaScript bundle..."
npx expo export --platform android

echo "[3/4] Copying bundle to Android assets..."
mkdir -p android/app/src/main/assets
cp dist/bundles/android-*.js android/app/src/main/assets/index.android.bundle
cp -r dist/assets android/app/src/main/res/

echo "[4/4] Building release APK..."
cd android
./gradlew assembleRelease

echo ""
echo "Build complete!"
echo ""
echo "APK location:"
echo "  android/app/build/outputs/apk/release/app-release.apk"
echo ""
