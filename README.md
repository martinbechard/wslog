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
├── wslog-server.config.json     # Server configuration
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
   pnpm build
   ```

3. **Start the server:**
   ```bash
   pnpm dev:server
   ```

4. **Start the frontend (new terminal):**
   ```bash
   pnpm dev:frontend
   # Access at: http://localhost:3000
   ```

## 📋 Usage Examples

### Basic Logging with CLI

```bash
# Send different log levels
pnpm client info "Application started successfully"
pnpm client warn "Memory usage at 85%" --source "monitoring"
pnpm client error "Database connection failed" --source "db-pool"
pnpm client debug "Processing user request #12345"

# Interactive mode
pnpm client interactive
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

## 🚀 Production Deployment

### Server
```bash
pnpm build
cd server
node dist/index.js --config /path/to/config.json
```

### Frontend
```bash
cd frontend
pnpm build
pnpm preview
```

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
