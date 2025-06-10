# WSLog Browser Integration Guide

## Problem Solved

The original WSLogClient was failing in browser environments with the error:
```
WSLogClient.js:141 Failed to connect to WSLog server: Error: ws does not work in the browser. Browser clients must use the native WebSocket object
```

## Solution

The WSLogClient has been updated to automatically detect the runtime environment and use the appropriate WebSocket implementation:

- **Browser**: Uses native `WebSocket` API
- **Node.js**: Uses the `ws` library
- **Cross-platform**: Provides polyfills for missing APIs

## Usage Examples

### Browser Environment

```html
<!DOCTYPE html>
<html>
<head>
    <title>WSLog Browser Example</title>
</head>
<body>
    <script src="path/to/wslog-client.js"></script>
    <script>
        // Initialize the client
        const logger = new WSLogClient({
            serverUrl: 'ws://localhost:8085',
            source: 'my-browser-app',
            enableTracing: true,
            logToConsole: true
        });

        // Connect to server
        logger.on('connected', () => {
            console.log('Connected to WSLog server');
            
            // Send log messages
            logger.info('Application started');
            logger.warn('This is a warning');
            logger.error('Something went wrong');
            
            // Function tracing
            logger.traceEntry('myFunction', ['arg1', 'arg2']);
            // ... do some work ...
            logger.traceExit('myFunction', 'return value');
        });

        logger.on('disconnected', () => {
            console.log('Disconnected from server');
        });

        // Start connection
        logger.connect();
    </script>
</body>
</html>
```

### Node.js Environment

```javascript
const { WSLogClient } = require('@wslog/client');

const logger = new WSLogClient({
    serverUrl: 'ws://localhost:8085',
    source: 'my-node-app',
    enableTracing: true,
    logToFile: true,
    logFilePath: './app.log'
});

// Use the same API as browser
logger.info('Server starting...');
logger.traceEntry('startServer');
// ... server logic ...
logger.traceExit('startServer');
```

### React/Webpack Environment

```javascript
import { WSLogClient } from '@wslog/client';

// The client will automatically detect it's in a browser
const logger = new WSLogClient({
    serverUrl: process.env.REACT_APP_WSLOG_URL || 'ws://localhost:8085',
    source: 'react-app',
    enableTracing: true
});

export default logger;
```

## Integration with cibc-driver

To fix the issue in your cibc-driver project:

1. **Update the WSLog client**: Make sure you're using the latest version
2. **Import correctly**: Use the updated client that handles both environments
3. **Configure for browser**: Set browser-specific options

```javascript
// In your cibc-driver project
import { WSLogClient } from '@wslog/client';

const logger = new WSLogClient({
    serverUrl: 'ws://localhost:8085',
    source: 'cibc-driver',
    enableTracing: true,
    // Browser-specific settings
    logToConsole: true,  // Logs will appear in browser console
    serverless: false    // Enable WebSocket connection
});

// The client will automatically use browser WebSocket API
logger.connect();
```

## Environment Detection

The client automatically detects the environment using these checks:

1. **Browser**: `typeof window !== 'undefined' && window.WebSocket`
2. **Node.js with global WebSocket**: `typeof global !== 'undefined' && global.WebSocket`
3. **Node.js with ws library**: `require('ws')`

## Features that Work Cross-Platform

- ✅ WebSocket connection management
- ✅ Log message sending (info, warn, error, debug)
- ✅ Function tracing (entry/exit)
- ✅ Hierarchical nesting levels
- ✅ Event emission (connected, disconnected, error)
- ✅ Message queuing when disconnected
- ✅ Ping/pong functionality

## Browser-Specific Features

- ✅ Console logging (replaces file logging)
- ✅ Browser hostname detection
- ✅ Native WebSocket events (onopen, onmessage, onclose, onerror)

## Node.js-Specific Features

- ✅ File logging
- ✅ OS hostname detection
- ✅ Full EventEmitter support
- ✅ Advanced WebSocket options

## Troubleshooting

### Still getting "ws does not work in the browser"?

1. Make sure you're using the updated WSLogClient
2. Check that the build process is including the updated files
3. Clear browser cache and rebuild

### WebSocket connection fails?

1. Ensure WSLog server is running on the specified port
2. Check for CORS issues (browser security)
3. Verify the WebSocket URL is correct

### Import errors?

1. For browsers: Include the compiled JavaScript file
2. For Node.js: Use CommonJS `require()` or ES6 `import`
3. For bundlers: The client should work with Webpack, Rollup, etc.
