#!/bin/bash

set -e

echo "=== MeterFlo Android Release Build ==="
echo ""

cd "$(dirname "$0")/.."

echo "[1/2] Cleaning previous builds..."
rm -rf android/app/build

echo "[2/2] Building release APK..."
npx expo run:android --variant release

echo ""
echo "Build complete!"
echo ""
echo "APK location:"
echo "  android/app/build/outputs/apk/release/app-release.apk"
echo ""
