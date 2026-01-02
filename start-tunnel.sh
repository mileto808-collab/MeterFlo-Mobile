#!/bin/bash
# Start Expo with tunnel mode for external device testing
# Run this script manually: ./start-tunnel.sh

echo "Starting Expo with tunnel mode..."
echo "This will create a public URL that works from any network."
echo ""

# Kill any existing Expo processes
pkill -f "expo start" 2>/dev/null
sleep 2

# Start Expo with tunnel mode
EXPO_PUBLIC_DOMAIN=$REPLIT_DEV_DOMAIN:5000 npx expo start --tunnel
