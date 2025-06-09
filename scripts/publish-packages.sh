#!/bin/bash
set -e

VERSION=${1:-"patch"}

echo "Publishing packages with version bump: $VERSION"

# Bump versions
cd shared && pnpm version $VERSION && cd ..
cd client && pnpm version $VERSION && cd ..

# Build packages
pnpm build

# Get new version
NEW_VERSION=$(node -e "console.log(require('./shared/package.json').version)")

# Create git tag
git add .
git commit -m "Release v$NEW_VERSION"
git tag "v$NEW_VERSION"

echo "✅ Created tag v$NEW_VERSION"
echo "Push to trigger GitHub Actions publishing:"
echo "  git push origin main --tags"
