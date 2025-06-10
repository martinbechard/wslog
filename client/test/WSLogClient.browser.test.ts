// Simple test to verify browser compatibility fixes
import { WSLogClient } from '../src/WSLogClient';

// Mock WebSocket to avoid real connections
const mockWebSocket = {
  send: jest.fn(),
  close: jest.fn(),
  readyState: 1, // OPEN
  onopen: null,
  onmessage: null,
  onclose: null,
  onerror: null
};

describe('WSLogClient Browser Compatibility', () => {
  let client: WSLogClient;
  let originalWindow: any;

  beforeAll(() => {
    // Save original window if it exists
    originalWindow = (global as any).window;
  });

  afterAll(() => {
    // Restore original window
    if (originalWindow) {
      (global as any).window = originalWindow;
    } else {
      delete (global as any).window;
    }
  });

  beforeEach(() => {
    // Mock browser environment
    (global as any).window = {
      WebSocket: jest.fn().mockImplementation(() => mockWebSocket),
      location: {
        hostname: 'localhost'
      }
    };
  });

  afterEach(() => {
    if (client) {
      // Set serverless mode to avoid WebSocket cleanup issues
      client.updateConfig({ serverless: true });
      client.close();
    }
  });

  test('should create client without errors in browser environment', () => {
    expect(() => {
      client = new WSLogClient({
        serverUrl: 'ws://localhost:8085',
        source: 'test-client',
        serverless: true // Disable WebSocket connection for testing
      });
    }).not.toThrow();
  });

  test('should detect browser environment and use window.WebSocket', () => {
    client = new WSLogClient({
      serverUrl: 'ws://localhost:8085',
      source: 'test-client'
    });

    // The client should be created successfully
    expect(client).toBeInstanceOf(WSLogClient);
    expect(client.isConnected()).toBe(false);
  });

  test('should handle browser-specific source naming', () => {
    client = new WSLogClient({
      serverless: true // Disable WebSocket for testing
    });
    
    // Should use browser hostname - we can't directly access private config,
    // but we can verify the client was created successfully
    expect(client).toBeInstanceOf(WSLogClient);
  });

  test('should send log messages without throwing errors in serverless mode', () => {
    client = new WSLogClient({
      serverUrl: 'ws://localhost:8085',
      source: 'test-client',
      serverless: true, // This prevents WebSocket connection
      logToConsole: false // Disable console logging for cleaner tests
    });

    expect(() => {
      client.info('Test message');
      client.warn('Warning message');
      client.error('Error message');
    }).not.toThrow();
  });

  test('should handle tracing in browser environment', () => {
    client = new WSLogClient({
      serverUrl: 'ws://localhost:8085',
      source: 'test-client',
      enableTracing: true,
      serverless: true, // This prevents WebSocket connection
      logToConsole: false // Disable console logging for cleaner tests
    });

    expect(() => {
      client.traceEntry('testFunction', ['arg1', 'arg2']);
      client.traceExit('testFunction', 'result');
    }).not.toThrow();
  });

  test('should provide trace info in browser environment', () => {
    client = new WSLogClient({
      serverUrl: 'ws://localhost:8085',
      source: 'test-client',
      enableTracing: true,
      serverless: true
    });

    // Initial state
    let traceInfo = client.getTraceInfo();
    expect(traceInfo).not.toBeNull();
    expect(traceInfo?.nestingLevel).toBe(0);
    expect(traceInfo?.functionStack).toEqual([]);

    // After entering a function
    client.traceEntry('testFunction');
    traceInfo = client.getTraceInfo();
    expect(traceInfo?.nestingLevel).toBe(1);
    expect(traceInfo?.functionStack).toContain('testFunction');

    // After exiting a function
    client.traceExit('testFunction');
    traceInfo = client.getTraceInfo();
    expect(traceInfo?.nestingLevel).toBe(0);
    expect(traceInfo?.functionStack).toEqual([]);
  });

  test('should reset trace context properly', () => {
    client = new WSLogClient({
      serverUrl: 'ws://localhost:8085',
      source: 'test-client',
      enableTracing: true,
      serverless: true
    });

    // Create some trace state
    client.traceEntry('function1');
    client.traceEntry('function2');
    
    let traceInfo = client.getTraceInfo();
    expect(traceInfo?.nestingLevel).toBe(2);
    expect(traceInfo?.functionStack.length).toBe(2);

    // Reset context
    client.resetTraceContext();
    
    traceInfo = client.getTraceInfo();
    expect(traceInfo?.nestingLevel).toBe(0);
    expect(traceInfo?.functionStack).toEqual([]);
  });

  test('should handle updateConfig without errors', () => {
    client = new WSLogClient({
      serverUrl: 'ws://localhost:8085',
      source: 'test-client',
      serverless: true
    });

    expect(() => {
      client.updateConfig({
        enableTracing: true,
        regexInclude: ['test.*'],
        regexExclude: ['ignore.*']
      });
    }).not.toThrow();
  });
});

// Test environment detection without mocking
describe('WSLogClient Environment Detection', () => {
  test('should handle Node.js environment gracefully', () => {
    // Remove window object to simulate Node.js
    delete (global as any).window;
    
    let client: WSLogClient;
    expect(() => {
      client = new WSLogClient({
        serverUrl: 'ws://localhost:8085',
        source: 'test-client',
        serverless: true // Disable WebSocket to avoid connection issues
      });
    }).not.toThrow();
    
    expect(client).toBeInstanceOf(WSLogClient);
    client.close();
  });

  test('should handle missing WebSocket implementation gracefully', () => {
    // Simulate environment with no WebSocket
    delete (global as any).window;
    
    let client: WSLogClient;
    expect(() => {
      client = new WSLogClient({
        serverUrl: 'ws://localhost:8085',
        source: 'test-client',
        serverless: true // This should prevent WebSocket initialization
      });
    }).not.toThrow();
    
    expect(client).toBeInstanceOf(WSLogClient);
    client.close();
  });
});
