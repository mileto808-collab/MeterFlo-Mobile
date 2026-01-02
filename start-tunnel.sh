#!/bin/bash
# Start Expo with tunnel mode for external device testing
# 
# INSTRUCTIONS:
# 1. First, STOP the "Start App" workflow (click the stop button)
# 2. Open the Shell tab at the bottom
# 3. Run: ./start-tunnel.sh
# 4. Wait for the QR code to appear
# 5. Scan the QR code with Expo Go on your Android device

echo "=============================================="
echo "  MeterFlo Mobile - Tunnel Mode for Android  "
echo "=============================================="
echo ""
echo "This mode enables external Android devices to connect."
echo ""

# Check if workflow Expo is still running on port 8081
if lsof -i :8081 >/dev/null 2>&1; then
  echo "WARNING: Port 8081 is already in use!"
  echo "Please STOP the 'Start App' workflow first, then run this script again."
  echo ""
  echo "To stop the workflow: Click the STOP button in the workflow panel."
  exit 1
fi

# Kill any existing Expo and Metro processes
echo "Cleaning up existing processes..."
pkill -9 -f "expo start" 2>/dev/null || true
pkill -9 -f "metro" 2>/dev/null || true
sleep 2

# Start Express server in background
echo "Starting Express server on port 5000..."
cd /home/runner/workspace
NODE_ENV=development tsx server/index.ts &
SERVER_PID=$!
sleep 3

echo ""
echo "Starting Expo with tunnel mode..."
echo "Please wait for the QR code to appear (may take 30-60 seconds)..."
echo ""

# Start Expo with tunnel mode - CI=1 avoids interactive prompts
CI=1 EXPO_PUBLIC_DOMAIN=$REPLIT_DEV_DOMAIN:5000 npx expo start --tunnel

# Cleanup on exit
kill $SERVER_PID 2>/dev/null
