#!/bin/bash
set -e

echo "🔄 Testing artifact transformation for publishing..."

# Build packages with original workspace structure
echo "📦 Building packages..."
cd shared && pnpm build && cd ..
cd client && pnpm build && cd ..

# Run transformation
./scripts/transform-for-publishing.sh

# Verification
echo "🔍 Verifying transformation..."
echo "Checking for remaining @wslog references:"

echo "In package.json files:"
grep -r "@wslog" ./shared/package.json ./client/package.json || echo "✅ No @wslog in package.json files"

echo "In compiled artifacts:"
grep -r "@wslog" ./client/dist/ || echo "✅ No @wslog in compiled files"

# Restore workspace
echo "🔄 Restoring original workspace..."
./scripts/restore-workspace.sh

echo "✅ Transformation test complete"
