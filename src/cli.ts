#!/usr/bin/env node

import { Command } from 'commander';
import * as os from 'os';
import * as readline from 'readline';
import { WSLogClient } from './WSLogClient';
import { LogLevel } from '@wslog/shared';

interface CLIOptions {
  url?: string;
  source?: string;
  route?: string;
  trace?: boolean;
  interactive?: boolean;
  batch?: number;
  timeout?: number;
}

class WSLogCLI {
  private client: WSLogClient;
  private program: Command;
  private isInteractive: boolean = false;

  constructor() {
    this.program = new Command();
    this.client = new WSLogClient();
    this.setupCommands();
  }

  private setupCommands(): void {
    this.program
      .name('wslogger')
      .description('WebSocket logging client with hierarchical tracing')
      .version('1.0.0');

    // Global options
    this.program
      .option('-u, --url <url>', 'WebSocket server URL', 'ws://localhost:8085')
      .option('-s, --source <source>', 'Log source identifier', `${os.hostname()}-cli`)
      .option('-r, --route <route>', 'Server route', '/logs')
      .option('-t, --trace', 'Enable tracing mode')
      .option('-i, --interactive', 'Interactive mode')
      .option('-b, --batch <size>', 'Batch size for messages', '10')
      .option('--timeout <ms>', 'Batch timeout in milliseconds', '1000');

    // Log commands
    this.program
      .command('log <level> <message>')
      .description('Send a log message')
      .option('-d, --data <json>', 'Additional data as JSON string')
      .action(async (level: LogLevel, message: string, options: any) => {
        await this.sendLog(level, message, options);
      });

    // Convenience commands for each log level
    ['info', 'warn', 'error', 'debug'].forEach(level => {
      this.program
        .command(`${level} <message>`)
        .description(`Send a ${level} log message`)
        .option('-d, --data <json>', 'Additional data as JSON string')
        .action(async (message: string, options: any) => {
          await this.sendLog(level as LogLevel, message, options);
        });
    });

    // Trace commands
    this.program
      .command('trace-entry <function> [args...]')
      .description('Send a function entry trace')
      .action(async (functionName: string, args: string[]) => {
        await this.sendTraceEntry(functionName, args);
      });

    this.program
      .command('trace-exit <function>')
      .description('Send a function exit trace')
      .option('-r, --return <value>', 'Return value as JSON string')
      .option('-e, --error <message>', 'Error message')
      .action(async (functionName: string, options: any) => {
        await this.sendTraceExit(functionName, options);
      });

    // Interactive mode
    this.program
      .command('interactive')
      .alias('i')
      .description('Start interactive logging session')
      .action(async () => {
        await this.startInteractiveMode();
      });

    // Monitor mode
    this.program
      .command('monitor')
      .alias('m')
      .description('Monitor logs from the server')
      .option('-f, --filter <pattern>', 'Filter messages by regex pattern')
      .option('-l, --levels <levels>', 'Filter by log levels (comma-separated)')
      .option('--sources <sources>', 'Filter by sources (comma-separated)')
      .action(async (options: any) => {
        await this.startMonitorMode(options);
      });

    // Ping command
    this.program
      .command('ping')
      .description('Ping the server')
      .action(async () => {
        await this.pingServer();
      });
  }

  private async initializeClient(options: CLIOptions): Promise<void> {
    const globalOpts = this.program.opts();
    const config = {
      serverUrl: options.url || globalOpts.url,
      source: options.source || globalOpts.source,
      enableTracing: options.trace || globalOpts.trace || options.interactive, // Enable tracing in interactive mode
      batchSize: parseInt(options.batch || globalOpts.batch),
      batchTimeout: parseInt(options.timeout || globalOpts.timeout),
    };

    this.client = new WSLogClient(config);

    // Enable interactive mode if needed
    if (this.isInteractive) {
      this.client.enableInteractiveMode();
      this.setupInteractiveEventListeners();
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 5000);

      this.client.once('connected', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.client.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  private setupInteractiveEventListeners(): void {
    this.client.on('pong', () => {
      console.log('✅ Pong received');
    });

    this.client.on('serverError', (error) => {
      console.log(`❌ Server error: ${error}`);
    });

    this.client.on('disconnected', () => {
      console.log('🔌 Disconnected from server');
    });

    this.client.on('connected', () => {
      console.log('🔌 Reconnected to server');
    });
  }

  private async sendLog(level: LogLevel, message: string, options: any): Promise<void> {
    try {
      await this.initializeClient(this.program.opts());

      let data: any = undefined;
      if (options.data) {
        try {
          data = JSON.parse(options.data);
        } catch (error) {
          console.error('Invalid JSON data:', error);
          process.exit(1);
        }
      }

      this.client.log(level, message, data);
      console.log(`✅ ${level.toUpperCase()} log sent: "${message}"`);

      // Wait a bit for the message to be sent
      setTimeout(() => {
        this.client.close();
        process.exit(0);
      }, 100);
    } catch (error) {
      console.error('❌ Failed to send log:', error);
      process.exit(1);
    }
  }

  private async sendTraceEntry(functionName: string, args: string[]): Promise<void> {
    try {
      await this.initializeClient({ ...this.program.opts(), trace: true });

      const parsedArgs = args.map(arg => {
        try {
          return JSON.parse(arg);
        } catch {
          return arg;
        }
      });

      this.client.traceEntry(functionName, parsedArgs);
      console.log(`✅ Trace entry sent for ${functionName}`);

      setTimeout(() => {
        this.client.close();
        process.exit(0);
      }, 100);
    } catch (error) {
      console.error('❌ Failed to send trace entry:', error);
      process.exit(1);
    }
  }

  private async sendTraceExit(functionName: string, options: any): Promise<void> {
    try {
      await this.initializeClient({ ...this.program.opts(), trace: true });

      let returnValue: any = undefined;
      let error: Error | undefined = undefined;

      if (options.return) {
        try {
          returnValue = JSON.parse(options.return);
        } catch (parseError) {
          returnValue = options.return;
        }
      }

      if (options.error) {
        error = new Error(options.error);
      }

      this.client.traceExit(functionName, returnValue, error);
      console.log(`✅ Trace exit sent for ${functionName}`);

      setTimeout(() => {
        this.client.close();
        process.exit(0);
      }, 100);
    } catch (error) {
      console.error('❌ Failed to send trace exit:', error);
      process.exit(1);
    }
  }

  private async startInteractiveMode(): Promise<void> {
    try {
      this.isInteractive = true;
      await this.initializeClient({ ...this.program.opts(), interactive: true, trace: true });

      console.log('🚀 Interactive WSLog session started');
      console.log('📡 Tracing enabled - function calls will show hierarchical nesting');
      console.log('🧵 Persistent context - nesting levels will accumulate across commands');
      console.log('');
      console.log('Commands:');
      console.log('  info|warn|error|debug <message>  - Send log message');
      console.log('  trace-entry <function> [args...] - Enter function trace');
      console.log('  trace-exit <function> [return]   - Exit function trace');
      console.log('  ping                            - Ping server');
      console.log('  status                          - Show connection status');
      console.log('  trace-info                      - Show current trace state');
      console.log('  reset                           - Reset trace context');
      console.log('  quit                            - Exit interactive mode');
      console.log('');

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: 'wslog> ',
      });

      rl.prompt();

      rl.on('line', (line) => {
        const trimmed = line.trim();
        if (!trimmed) {
          rl.prompt();
          return;
        }

        if (trimmed === 'quit' || trimmed === 'exit') {
          console.log('👋 Goodbye!');
          this.client.close();
          rl.close();
          process.exit(0);
        }

        this.handleInteractiveCommand(trimmed)
          .then(() => rl.prompt())
          .catch((error) => {
            console.error('❌ Command failed:', error);
            rl.prompt();
          });
      });

      rl.on('close', () => {
        this.client.close();
        process.exit(0);
      });
    } catch (error) {
      console.error('❌ Failed to start interactive mode:', error);
      process.exit(1);
    }
  }

  private async handleInteractiveCommand(command: string): Promise<void> {
    const parts = command.split(' ');
    const cmd = parts[0];
    const args = parts.slice(1);

    switch (cmd) {
      case 'info':
      case 'warn':
      case 'error':
      case 'debug':
        if (args.length > 0) {
          this.client.log(cmd as LogLevel, args.join(' '));
          console.log(`✅ ${cmd.toUpperCase()} log sent`);
        } else {
          console.log(`❌ Usage: ${cmd} <message>`);
        }
        break;

      case 'trace-entry':
        if (args.length > 0) {
          // Parse arguments properly
          const functionName = args[0];
          const parsedArgs = args.slice(1).map(arg => {
            try {
              return JSON.parse(arg);
            } catch {
              return arg;
            }
          });
          
          this.client.traceEntry(functionName, parsedArgs.length > 0 ? parsedArgs : undefined);
          console.log(`✅ Trace entry sent for ${functionName}`);
        } else {
          console.log('❌ Usage: trace-entry <function> [args...]');
        }
        break;

      case 'trace-exit':
        if (args.length > 0) {
          const functionName = args[0];
          let returnValue: any = undefined;
          
          if (args.length > 1) {
            try {
              returnValue = JSON.parse(args.slice(1).join(' '));
            } catch {
              returnValue = args.slice(1).join(' ');
            }
          }
          
          this.client.traceExit(functionName, returnValue);
          console.log(`✅ Trace exit sent for ${functionName}`);
        } else {
          console.log('❌ Usage: trace-exit <function> [return-value]');
        }
        break;

      case 'ping':
        this.client.ping();
        console.log('🏓 Ping sent - waiting for pong...');
        break;

      case 'status':
        const isConnected = this.client.isConnected();
        console.log(`📡 Connection status: ${isConnected ? '✅ Connected' : '❌ Disconnected'}`);
        break;

      case 'trace-info':
        const traceInfo = this.client.getTraceInfo();
        if (traceInfo) {
          console.log(`🧵 Thread ${traceInfo.threadId}, Level ${traceInfo.nestingLevel}`);
          if (traceInfo.functionStack.length > 0) {
            console.log(`📚 Call stack: ${traceInfo.functionStack.join(' → ')}`);
          } else {
            console.log('📚 Call stack: empty');
          }
        } else {
          console.log('❌ No trace context available');
        }
        break;

      case 'reset':
        this.client.resetTraceContext();
        console.log('🔄 Trace context reset - starting fresh');
        break;

      default:
        console.log(`❌ Unknown command: ${cmd}`);
        console.log('Type one of: info, warn, error, debug, trace-entry, trace-exit, ping, status, trace-info, reset, quit');
    }
  }

  private async startMonitorMode(options: any): Promise<void> {
    try {
      await this.initializeClient(this.program.opts());

      console.log('👀 Monitoring logs from server...');
      console.log('Press Ctrl+C to stop');

      // Set up filters
      const filters: any = {};
      
      if (options.levels) {
        filters.levels = options.levels.split(',').map((s: string) => s.trim());
      }
      
      if (options.sources) {
        filters.sources = options.sources.split(',').map((s: string) => s.trim());
      }
      
      if (options.filter) {
        filters.regexInclude = [options.filter];
      }

      this.client.subscribe('/logs', filters);
      this.client.subscribe('/trace', filters);

      this.client.on('message', (message) => {
        if (message.type === 'log' || message.type === 'trace') {
          const data = message.data;
          const timestamp = new Date(data.timestamp).toLocaleTimeString();
          const level = data.level.toUpperCase().padEnd(5);
          const source = data.source ? `[${data.source}]` : '';
          const nesting = data.nestingLevel ? '|'.repeat(data.nestingLevel) : '';
          
          console.log(`${timestamp} ${level} ${source} ${nesting}${data.message}`);
        }
      });

      // Keep the process running
      process.on('SIGINT', () => {
        console.log('\\n👋 Stopping monitor...');
        this.client.close();
        process.exit(0);
      });

    } catch (error) {
      console.error('❌ Failed to start monitor mode:', error);
      process.exit(1);
    }
  }

  private async pingServer(): Promise<void> {
    try {
      await this.initializeClient(this.program.opts());

      console.log('🏓 Pinging server...');
      
      const timeout = setTimeout(() => {
        console.log('❌ Ping timeout');
        this.client.close();
        process.exit(1);
      }, 5000);

      this.client.once('pong', () => {
        clearTimeout(timeout);
        console.log('✅ Pong received');
        this.client.close();
        process.exit(0);
      });

      this.client.ping();
    } catch (error) {
      console.error('❌ Failed to ping server:', error);
      process.exit(1);
    }
  }

  public async run(): Promise<void> {
    await this.program.parseAsync();
  }
}

// Main execution
if (require.main === module) {
  const cli = new WSLogCLI();
  cli.run().catch((error) => {
    console.error('CLI Error:', error);
    process.exit(1);
  });
}
