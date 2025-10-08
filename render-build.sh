#!/usr/bin/env bash
set -eux

echo "Installing all dependencies (including dev)..."
npm ci

echo "Fixing Prisma permissions..."
chmod +x ./node_modules/.bin/prisma || true

echo "Generating Prisma client for Debian..."
npx prisma generate

echo "Building TypeScript..."
npm run build
