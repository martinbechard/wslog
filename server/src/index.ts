import * as fs from 'fs';
import * as path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { WSLogServer } from './WSLogServer';
import { ServerConfig } from '@wslog/shared';

interface CLIArguments {
  config?: string;
  port?: number;
  debug?: string;
}

function loadConfig(configPath: string): ServerConfig {
  try {
    const configContent = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(configContent);
  } catch (error) {
    console.error(`Failed to load config from ${configPath}:`, error);
    return {};
  }
}

function createDefaultConfig(configPath: string): void {
  const defaultConfig: ServerConfig = {
    port: 8085,
    maxConnections: 1000,
    heartbeatInterval: 30000,
    logRetention: 10000,
    enableCompression: true,
    routes: [
      {
        route: '/',
        output: './wslog-requests.jsonl',
        capture: 'full',
        format: 'jsonl'
      },
      {
        route: '/tracer',
        output: 'console',
        capture: 'bodyOnly',
        format: 'text'
      },
      {
        route: '/trace',
        output: './trace.log',
        capture: 'full',
        format: 'text'
      },
      {
        route: '/logs',
        output: './logs.jsonl',
        capture: 'payloadOnly',
        format: 'jsonl'
      },
      {
        route: '/settings',
        output: './.wslog-settings.json',
        capture: 'bodyOnly',
        format: 'json',
        allowWriteFile: true,
        allowReadFile: true
      }
    ]
  };

  try {
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    console.log(`Created default config at ${configPath}`);
  } catch (error) {
    console.error(`Failed to create default config at ${configPath}:`, error);
  }
}

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .option('config', {
      alias: 'c',
      type: 'string',
      description: 'Path to config file',
      default: path.join(process.cwd(), 'wslog-server.config.json'),
    })
    .option('port', {
      alias: 'p',
      type: 'number',
      description: 'Server port',
    })
    .option('debug', {
      alias: 'd',
      type: 'string',
      description: 'Debug flags (ALL|PING|REQUESTS|POST|PATCH|GET)',
    })
    .option('create-config', {
      type: 'boolean',
      description: 'Create a default configuration file',
    })
    .help()
    .argv as CLIArguments & { 'create-config'?: boolean };

  const configPath = path.resolve(argv.config!);

  // Create default config if requested
  if (argv['create-config']) {
    createDefaultConfig(configPath);
    return;
  }

  // Load configuration
  let config: ServerConfig = {};
  if (fs.existsSync(configPath)) {
    config = loadConfig(configPath);
    console.log(`Loaded config from ${configPath}`);
  } else {
    console.log(`Config file not found at ${configPath}, using defaults`);
    console.log(`Run with --create-config to generate a default configuration file`);
  }

  // Override with command line arguments
  if (argv.port) {
    config.port = argv.port;
  }

  // Set up debug logging
  if (argv.debug) {
    const debugFlags = argv.debug.toUpperCase().split('|').map(s => s.trim());
    console.log('Debug flags enabled:', debugFlags);
    
    // Set environment variables for debugging
    if (debugFlags.includes('ALL') || debugFlags.includes('REQUESTS')) {
      process.env.DEBUG_REQUESTS = 'true';
    }
    if (debugFlags.includes('ALL') || debugFlags.includes('PING')) {
      process.env.DEBUG_PING = 'true';
    }
  }

  // Start the server
  const server = new WSLogServer(config);

  // Graceful shutdown
  const shutdown = () => {
    console.log('\\nShutting down WSLog server...');
    server.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Log server information
  console.log('WSLog Server started successfully');
  console.log(`Process ID: ${process.pid}`);
  console.log(`Node.js version: ${process.version}`);
  console.log(`Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start the application
if (require.main === module) {
  main().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}
