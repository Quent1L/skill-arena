#!/bin/bash

# Script pour redémarrer le développement après des changements dans shared
echo "🔄 Rebuilding shared package and restarting dev..."

# Stop existing dev processes
pkill -f "concurrently|bun.*dev" 2>/dev/null || true

# Wait a moment
sleep 1

# Rebuild shared
echo "🔧 Building shared package..."
cd shared && bun run build && cd ..

# Restart dev
echo "🚀 Starting development environment..."
bun run dev:all