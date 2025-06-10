#!/bin/bash
set -e

echo "🔄 Restoring original workspace..."

# Restore from git
git checkout -- shared/package.json client/package.json

# Clean build artifacts
rm -rf shared/dist client/dist

echo "✅ Workspace restored to original state"
