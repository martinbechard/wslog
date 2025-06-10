# WSLog Browser Demo

This directory contains demonstration files showing how the WSLogClient works in browser environments.

## Files

- **`browser-demo.html`** - Interactive browser demo showing WSLogClient features

## Browser Demo

The browser demo is a complete, standalone HTML file that demonstrates the browser-compatible WSLogClient in action.

### Features Demonstrated

- ✅ **Environment Detection** - Automatically uses native browser WebSocket
- ✅ **Connection Management** - Connect/disconnect to WSLog server
- ✅ **Log Messages** - Send info, warn, error messages
- ✅ **Function Tracing** - Entry/exit tracing with nesting levels
- ✅ **Real-time Output** - See logs in the browser console and demo UI
- ✅ **Advanced Features** - Ping/pong, trace context info, reset functionality

### How to Use

1. **Start WSLog Server** (if you want to test real connections):
   ```bash
   cd server
   pnpm run dev
   ```

2. **Open Demo** in your browser:
   ```bash
   open client/demo/browser-demo.html
   ```
   Or simply double-click the file to open it in your default browser.

3. **Test the Features**:
   - Enter a server URL (default: `ws://localhost:8085`)
   - Click "Connect" to establish WebSocket connection
   - Try sending log messages and function traces
   - Watch the output in both the demo UI and browser console

### Offline Mode

The demo works even without a running WSLog server:
- Messages will be queued when disconnected
- Local console logging still functions
- All client-side features work (tracing, context management, etc.)

### Integration Example

The demo shows exactly how to use WSLogClient in a browser environment. You can copy the WSLogClient class implementation or see how it integrates with your own projects.

### Troubleshooting

**Connection fails?**
- Ensure WSLog server is running on the specified port
- Check browser console for detailed error messages
- Try with CORS-enabled server if needed

**WebSocket errors?**
- This demo proves the "ws does not work in browser" issue is resolved
- The client automatically detects browser environment and uses native WebSocket

## Development

This demo uses a simplified version of WSLogClient embedded directly in the HTML for demonstration purposes. In your actual projects, you would import the compiled WSLogClient from the npm package:

```javascript
import { WSLogClient } from '@wslog/client';
```
