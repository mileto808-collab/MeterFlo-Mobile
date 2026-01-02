#!/bin/bash
# Start Expo with tunnel mode for external device testing
# 
# INSTRUCTIONS:
# 1. First, STOP the "Start App" workflow (click the stop button)
# 2. Open the Shell tab at the bottom
# 3. Run: ./start-tunnel.sh
# 4. Wait for the QR code to appear (30-60 seconds)
# 5. Scan the QR code with Expo Go on your Android device

echo "=============================================="
echo "  MeterFlo Mobile - Tunnel Mode for Android  "
echo "=============================================="
echo ""
echo "This mode enables external Android devices to connect."
echo ""

# Aggressively kill all Expo/Metro processes first
echo "Stopping all Expo and Metro processes..."
pkill -9 -f "expo" 2>/dev/null || true
pkill -9 -f "metro" 2>/dev/null || true
pkill -9 -f "node.*8081" 2>/dev/null || true

# Wait and verify port is free
echo "Waiting for port 8081 to be released..."
sleep 3

# Force kill anything on port 8081
fuser -k 8081/tcp 2>/dev/null || true
sleep 2

# Verify port is now free
if lsof -i :8081 >/dev/null 2>&1; then
  echo ""
  echo "ERROR: Port 8081 is still in use after cleanup!"
  echo "Process using port 8081:"
  lsof -i :8081
  echo ""
  echo "Try running: fuser -k 8081/tcp"
  echo "Then run this script again."
  exit 1
fi

echo "Port 8081 is free."
echo ""

# Start Express server in background
echo "Starting Express server on port 5000..."
cd /home/runner/workspace
NODE_ENV=development tsx server/index.ts &
SERVER_PID=$!
sleep 3

echo ""
echo "=========================================="
echo "  Starting Expo with TUNNEL mode...     "
echo "=========================================="
echo ""
echo "Please wait 30-60 seconds for the tunnel QR code."
echo "Look for: 'Tunnel ready at exp+https://...'"
echo ""

# Start Expo with tunnel mode
# CI=1 makes it non-interactive
# --tunnel creates public URL accessible from any network
CI=1 EXPO_PUBLIC_DOMAIN=$REPLIT_DEV_DOMAIN:5000 npx expo start --tunnel

# Cleanup on exit
kill $SERVER_PID 2>/dev/null
