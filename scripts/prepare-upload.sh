#!/bin/bash
set -e

echo "🚀 Preparing wslog project for GitHub upload..."

# Install dependencies (allow lockfile update)
echo "📦 Installing dependencies..."
pnpm install --no-frozen-lockfile

# Build and test all packages
echo "📦 Building shared package..."
cd shared && pnpm build && cd ..

echo "📦 Building client package..."
cd client && pnpm build && cd ..

echo "🧪 Running tests..."
cd client && pnpm test && cd ..

# Verify package configurations
echo "🔍 Verifying package configurations..."
node -e "
const sharedPkg = require('./shared/package.json');
const clientPkg = require('./client/package.json');

console.log('✅ Shared package:', sharedPkg.name, sharedPkg.version);
console.log('✅ Client package:', clientPkg.name, clientPkg.version);
console.log('✅ Repository:', sharedPkg.repository.url);
console.log('✅ PublishConfig present:', !!sharedPkg.publishConfig && !!clientPkg.publishConfig);
"

# Clean up build artifacts for upload (keep node_modules for development)
echo "🧹 Cleaning build artifacts..."
rm -rf shared/dist client/dist
rm -f *.tgz shared/*.tgz client/*.tgz

echo ""
echo "✅ Project ready for upload to github.com/martinbechard/wslog"
echo ""
echo "Next steps:"
echo "1. Upload this directory to GitHub"
echo "2. Run './scripts/setup-github-packages.sh' in cibc-driver"
echo "3. Create v1.0.0 tag to trigger publishing"
