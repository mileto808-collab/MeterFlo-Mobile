#!/bin/bash
# Start Expo with tunnel mode for external device testing
# Run this script in the Shell tab: ./start-tunnel.sh

echo "==================================="
echo "Starting MeterFlo Mobile with Tunnel Mode"
echo "==================================="
echo ""

# Kill any existing Expo and Metro processes
echo "Stopping existing Expo processes..."
pkill -9 -f "expo start" 2>/dev/null || true
pkill -9 -f "metro" 2>/dev/null || true
sleep 3

# Start Express server in background
echo "Starting Express server..."
cd /home/runner/workspace
NODE_ENV=development tsx server/index.ts &
SERVER_PID=$!
sleep 2

# Start Expo with tunnel mode
echo ""
echo "Starting Expo with tunnel mode..."
echo "Please wait for the QR code to appear..."
echo ""

EXPO_PUBLIC_DOMAIN=$REPLIT_DEV_DOMAIN:5000 npx expo start --tunnel

# Cleanup on exit
kill $SERVER_PID 2>/dev/null
