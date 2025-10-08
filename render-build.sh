#!/usr/bin/env bash
# Render Build Script

echo "Installing all dependencies (including dev)..."
npm install

echo "Generating Prisma client..."
npm run generate

echo "Building TypeScript..."
npm run build
