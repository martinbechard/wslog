#!/bin/bash
set -e

echo "🔧 Setting up GitHub packages for cibc-driver..."

# Create .npmrc for GitHub packages
cat > .npmrc << EOF
@martinbechard:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=\${GITHUB_TOKEN}
EOF

echo "✅ Created .npmrc for GitHub packages authentication"

# Update package.json dependencies
echo "📝 Updating package.json dependencies..."
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

// Add wslog dependencies
pkg.dependencies = pkg.dependencies || {};
pkg.dependencies['@martinbechard/wslog-client'] = '^1.0.0';
pkg.dependencies['@martinbechard/wslog-shared'] = '^1.0.0';

fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
console.log('✅ Updated package.json dependencies');
"

# Create WSLogAdapter
echo "📁 Creating WSLogAdapter..."
mkdir -p src/utils

cat > src/utils/WSLogAdapter.ts << 'EOF'
import { WSLogClient, ExtendedLoggerConfig } from '@martinbechard/wslog-client';

/**
 * Adapter providing backward compatibility with existing tracer API
 * Maps old tracer methods to new WSLogClient
 */
export class WSLogAdapter {
  private client: WSLogClient;

  constructor() {
    this.client = new WSLogClient({
      enableTracing: true,
      logToFile: true,
      logToConsole: false,
      logFilePath: 'trace.log',
      clearLogFileOnStart: true,
      serverless: true, // Assume no server for compatibility
    });
  }

  // Backward compatibility methods
  getCurrentThreadId(): number {
    return this.client.getCurrentThreadId();
  }

  traceEntry(functionName: string, args?: any[]): void {
    this.client.traceEntry(functionName, args);
  }

  traceExit(functionName: string, returnValue?: any, error?: Error): void {
    this.client.traceExit(functionName, returnValue, error);
  }

  info(message: string, data?: any): void {
    this.client.info(message, data);
  }

  warn(message: string, data?: any): void {
    this.client.warn(message, data);
  }

  error(message: string, data?: any): void {
    this.client.error(message, data);
  }

  debug(message: string, data?: any): void {
    this.client.debug(message, data);
  }

  clearLogFile(): void {
    this.client.clearLogFile();
  }

  // Access to underlying client for advanced features
  getClient(): WSLogClient {
    return this.client;
  }
}

// Export singleton instance for backward compatibility
export const tracer = new WSLogAdapter();
EOF

echo "✅ Created WSLogAdapter"

echo ""
echo "✅ Setup complete!"
echo ""
echo "Required environment variable:"
echo "  export GITHUB_TOKEN=<your_github_token>"
echo ""
echo "Install packages:"
echo "  pnpm install"
echo ""
echo "Update imports in your code:"
echo "  // Change from:"
echo "  import { tracer } from './old-tracer';"
echo "  // To:"
echo "  import { tracer } from './src/utils/WSLogAdapter';"
