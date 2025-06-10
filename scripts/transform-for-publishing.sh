#!/bin/bash
set -e

echo "🔧 Transforming packages for publishing..."

# Transform shared package name
node -e "
const pkg = require('./shared/package.json');
pkg.name = '@martinbechard/wslog-shared';
require('fs').writeFileSync('./shared/package.json', JSON.stringify(pkg, null, 2));
"

# Transform client package and dependencies
node -e "
const pkg = require('./client/package.json');
pkg.name = '@martinbechard/wslog-client';
delete pkg.dependencies['@wslog/shared'];
pkg.dependencies['@martinbechard/wslog-shared'] = '^1.0.0';
require('fs').writeFileSync('./client/package.json', JSON.stringify(pkg, null, 2));
"

# Transform compiled JavaScript imports
find client/dist -name "*.js" -type f -exec sed -i 's/@wslog\/shared/@martinbechard\/wslog-shared/g' {} \;
find client/dist -name "*.d.ts" -type f -exec sed -i 's/@wslog\/shared/@martinbechard\/wslog-shared/g' {} \;

echo "✅ Transformation complete"
