# WSLog - Advanced WebSocket Logging System

A sophisticated WebSocket-based logging system with hierarchical tracing, cross-platform async context management, and a modern React frontend. Built with TypeScript and designed for complex distributed applications.

## 🚀 Features

### Core Capabilities
- **WebSocket-based real-time logging** with persistent connections
- **Hierarchical function tracing** with nesting level visualization
- **Cross-platform async context management** (Node.js AsyncLocalStorage + Browser AsyncContext)
- **Advanced filtering** with regex patterns and multi-dimensional criteria
- **Configurable routing** for different log types and outputs
- **Real-time statistics** and monitoring dashboard
- **Batch processing** for high-performance scenarios

### Frontend Dashboard
- **Modern React UI** with Tailwind CSS styling
- **Real-time log streaming** with WebSocket connections
- **Hierarchical trace visualization** showing function call depth
- **Interactive filtering** by levels, sources, and patterns
- **Live statistics** with charts and metrics
- **Auto-scrolling** and search capabilities

### Advanced Tracing
- **Thread-local context** emulation across async operations
- **Function entry/exit** tracking with execution timing
- **Nesting level** visualization for complex call stacks
- **Error tracking** with stack traces
- **Cross-platform compatibility** (Node.js and Browser)

## 📁 Project Structure

```
wslog/
├── shared/             # Common types and utilities
│   ├── src/
│   │   ├── context-helper.ts    # Cross-platform async context
│   │   ├── types.ts             # Shared interfaces
│   │   └── index.ts
│   └── package.json
├── server/             # WebSocket logging server
│   ├── src/
│   │   ├── WSLogServer.ts       # Main server implementation
│   │   └── index.ts             # CLI entry point
│   ├── wslog-server.config.json # Server configuration
│   └── package.json
├── client/             # TypeScript logging client
│   ├── src/
│   │   ├── WSLogClient.ts       # Client library
│   │   ├── cli.ts               # Command-line interface
│   │   └── index.ts
│   └── package.json
├── frontend/           # React dashboard
│   ├── src/
│   │   ├── components/          # React components
│   │   ├── App.tsx              # Main application
│   │   └── main.tsx
│   └── package.json
├── wslog-server.config.json     # Default server configuration
├── pnpm-workspace.yaml          # Workspace configuration
└── package.json                 # Root package
```

## 🔧 Installation & Setup

### Prerequisites
- Node.js 18+ 
- pnpm (recommended) or npm

### Quick Start

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Build all packages:**
   ```bash
   pnpm run build:all
   ```

3. **Start the server:**
   ```bash
   pnpm run dev:server
   ```
   
   Or for production:
   ```bash
   pnpm run start:server
   ```

4. **Start the frontend (new terminal):**
   ```bash
   pnpm run dev:frontend
   # Access at: http://localhost:3000
   ```

5. **Test the client CLI:**
   ```bash
   pnpm run client info "Hello from WSLog!"
   pnpm run client --help
   ```

### Development Scripts

| Command | Description |
|---------|-------------|
| `pnpm run dev:server` | Start the server in development mode with watch |
| `pnpm run dev:frontend` | Start the React frontend development server |
| `pnpm run dev:client` | Start the CLI in development mode |
| `pnpm run start:server` | Start the server in production mode |
| `pnpm run build:all` | Build all packages |
| `pnpm run clean:all` | Clean all build artifacts |
| `pnpm test` | Run tests |
| `pnpm run client <command>` | Use the logging CLI |

## 📋 Usage Examples

### Basic Logging with CLI

```bash
# Send different log levels
pnpm run client info "Application started successfully"
pnpm run client warn "Memory usage at 85%" --source "monitoring"
pnpm run client error "Database connection failed" --source "db-pool"
pnpm run client debug "Processing user request #12345"

# Interactive mode
pnpm run client interactive

# Monitor logs from server
pnpm run client monitor

# Check server connectivity
pnpm run client ping
```

### Advanced Tracing

```javascript
import { WSLogClient } from '@wslog/client';

const logger = new WSLogClient({
  serverUrl: 'ws://localhost:8085',
  source: 'my-service',
  enableTracing: true,
  maxTraceLevel: 5,
});

// Automatic function tracing
const result = logger.exec(myComplexFunction, param1, param2);

// Manual tracing
logger.traceEntry('processOrder', [orderId, userId]);
try {
  const order = await processOrder(orderId, userId);
  logger.traceExit('processOrder', order);
  return order;
} catch (error) {
  logger.traceExit('processOrder', undefined, error);
  throw error;
}
```

## 🎛️ Configuration

### Server Configuration

The server looks for `wslog-server.config.json` in the server directory. You can create a default configuration:

```bash
cd server
node dist/index.js --create-config
```

Example configuration:
```json
{
  "port": 8085,
  "maxConnections": 1000,
  "heartbeatInterval": 30000,
  "logRetention": 10000,
  "enableCompression": true,
  "routes": [
    {
      "route": "/logs",
      "output": "./logs.jsonl",
      "capture": "payloadOnly",
      "format": "jsonl"
    },
    {
      "route": "/tracer",
      "output": "console",
      "capture": "bodyOnly", 
      "format": "text"
    }
  ]
}
```

### Client Configuration

```javascript
const client = new WSLogClient({
  serverUrl: 'ws://localhost:8085',      // WebSocket server URL
  source: 'my-app',                      // Source identifier
  enableTracing: true,                   // Enable function tracing
  maxTraceLevel: -1,                     // Max nesting level (-1 = unlimited)
  regexInclude: ['.*important.*'],       // Include patterns
  regexExclude: ['.*debug.*'],           // Exclude patterns
});
```

## 🎨 Frontend Features

- **Real-time log viewer** with syntax highlighting
- **Hierarchical trace viewer** with visual nesting
- **Connection status** with URL management  
- **Statistics panel** with charts and metrics
- **Advanced filtering** with regex support

Access the frontend at: `http://localhost:3000`

## 🚀 Production Deployment

### Server
```bash
pnpm run build:all
pnpm run start:server

# Or with custom config:
cd server
node dist/index.js --config /path/to/config.json
```

### Frontend
```bash
cd frontend
pnpm run build
pnpm run preview
```

## 🔧 Troubleshooting

### Server Won't Start
- Check if port 8085 is already in use: `lsof -i :8085`
- Verify the config file exists: `server/wslog-server.config.json`
- Check server logs for specific error messages

### Client Connection Issues
- Ensure the server is running on the expected port
- Check WebSocket URL in client configuration
- Verify firewall settings allow WebSocket connections

### Build Issues
- Clean and rebuild: `pnpm run clean:all && pnpm run build:all`
- Check Node.js version compatibility (requires Node.js 18+)
- Ensure all dependencies are installed: `pnpm install`

## 📚 API Reference

### WSLogClient Methods

```typescript
// Basic logging
logger.info(message: string, data?: any): void
logger.error(message: string, data?: any): void

// Function tracing
logger.exec<T>(func: Function, ...args): T
logger.traceEntry(functionName: string, args?: any[]): void
logger.traceExit(functionName: string, returnValue?: any): void

// Context management
logger.runInContext<T>(context, callback): Promise<T>
logger.wrapFunction<T>(name: string, func: T): T
```

## 📄 License

MIT License