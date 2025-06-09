import { WSLogClient } from '../src/WSLogClient';
import WebSocket from 'ws';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';

// Mock WebSocket
jest.mock('ws');

// Mock fs for file logging tests
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  appendFileSync: jest.fn(),
}));

// Mock console methods
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

describe('WSLogClient', () => {
  let client: WSLogClient;
  let mockWs: jest.Mocked<WebSocket>;
  let mockFs: jest.Mocked<typeof fs>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Silence console output during tests
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
    
    // Setup mock WebSocket
    mockWs = new EventEmitter() as any;
    mockWs.send = jest.fn();
    mockWs.close = jest.fn();
    // Use Object.defineProperty to mock readyState
    Object.defineProperty(mockWs, 'readyState', {
      writable: true,
      value: WebSocket.OPEN
    });
    
    (WebSocket as unknown as jest.Mock).mockImplementation(() => mockWs);
    
    // Setup mock fs
    mockFs = fs as jest.Mocked<typeof fs>;
    mockFs.existsSync.mockReturnValue(true);
  });

  afterEach(() => {
    jest.useRealTimers();
    if (client) {
      client.close();
    }
    // Restore console
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
  });

  describe('constructor and initialization', () => {
    it('should create client with default config', () => {
      client = new WSLogClient();
      
      expect(WebSocket).toHaveBeenCalledWith('ws://localhost:8085');
      expect(client.isConnected()).toBe(true);
    });

    it('should create client with custom config', () => {
      const config = {
        serverUrl: 'ws://custom:9090',
        source: 'test-source',
        batchSize: 20,
        enableTracing: true,
      };
      
      client = new WSLogClient(config);
      
      expect(WebSocket).toHaveBeenCalledWith('ws://custom:9090');
    });

    it('should handle serverless mode', () => {
      const config = {
        serverless: true,
      };
      
      client = new WSLogClient(config);
      
      expect(WebSocket).not.toHaveBeenCalled();
      expect(client.isConnected()).toBe(false);
    });
  });

  describe('connection management', () => {
    beforeEach(() => {
      client = new WSLogClient();
    });

    it('should emit connected event on open', () => {
      const connectedHandler = jest.fn();
      client.on('connected', connectedHandler);
      
      mockWs.emit('open');
      
      expect(connectedHandler).toHaveBeenCalled();
    });

    it('should emit disconnected event on close', () => {
      const disconnectedHandler = jest.fn();
      client.on('disconnected', disconnectedHandler);
      
      mockWs.emit('close');
      
      expect(disconnectedHandler).toHaveBeenCalled();
    });

    it('should handle reconnection with exponential backoff', () => {
      mockWs.emit('close');
      
      // Should have scheduled a reconnect timer
      expect(jest.getTimerCount()).toBeGreaterThan(0);
      
      // Clear all timers to start fresh
      jest.clearAllTimers();
      
      // Manually trigger reconnect with incremented attempts
      mockWs.emit('close');
      
      // Should still have a timer scheduled
      expect(jest.getTimerCount()).toBeGreaterThan(0);
    });

    it('should stop reconnecting after max retries', () => {
      const maxRetriesHandler = jest.fn();
      client.on('maxRetriesReached', maxRetriesHandler);
      
      // Simulate max retries
      for (let i = 0; i < 5; i++) {
        mockWs.emit('close');
        jest.runAllTimers();
      }
      
      mockWs.emit('close');
      
      expect(maxRetriesHandler).toHaveBeenCalled();
    });
  });

  describe('message queuing', () => {
    beforeEach(() => {
      client = new WSLogClient();
    });

    it('should queue messages when disconnected', () => {
      Object.defineProperty(mockWs, 'readyState', {
        writable: true,
        value: WebSocket.CLOSED
      });
      
      client.info('test message');
      
      expect(mockWs.send).not.toHaveBeenCalled();
    });

    it('should flush queue on reconnection', () => {
      Object.defineProperty(mockWs, 'readyState', {
        writable: true,
        value: WebSocket.CLOSED
      });
      
      client.info('queued message 1');
      client.info('queued message 2');
      
      Object.defineProperty(mockWs, 'readyState', {
        writable: true,
        value: WebSocket.OPEN
      });
      mockWs.emit('open');
      
      expect(mockWs.send).toHaveBeenCalledTimes(2);
    });
  });

  describe('logging methods', () => {
    beforeEach(() => {
      client = new WSLogClient();
    });

    it('should send info log', () => {
      client.info('info message', { data: 'test' });
      
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"level":"info"')
      );
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"message":"info message"')
      );
    });

    it('should send warn log', () => {
      client.warn('warning message');
      
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"level":"warn"')
      );
    });

    it('should send error log', () => {
      client.error('error message');
      
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"level":"error"')
      );
    });

    it('should send debug log', () => {
      // Need to enable debugTraceRequests for debug logs to work
      client = new WSLogClient({ debugTraceRequests: true });
      
      client.debug('debug message');
      
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"level":"debug"')
      );
    });
  });

  describe('tracing functionality', () => {
    beforeEach(() => {
      client = new WSLogClient({ enableTracing: true });
    });

    it('should trace function entry', () => {
      client.traceEntry('testFunction', ['arg1', 'arg2']);
      
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('>>> Call testFunction')
      );
    });

    it('should trace function exit', async () => {
      // Use runInContext to ensure context is maintained
      await client.runInContext({}, () => {
        client.traceEntry('testFunction');
        client.traceExit('testFunction', 'returnValue');
      });
      
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('<<< Exit testFunction')
      );
    });

    it('should track nesting level', async () => {
      await client.runInContext({}, () => {
        const info = client.getTraceInfo();
        expect(info?.nestingLevel).toBe(0);
        
        client.traceEntry('func1');
        expect(client.getTraceInfo()?.nestingLevel).toBe(1);
        
        client.traceEntry('func2');
        expect(client.getTraceInfo()?.nestingLevel).toBe(2);
        
        client.traceExit('func2');
        expect(client.getTraceInfo()?.nestingLevel).toBe(1);
        
        client.traceExit('func1');
        expect(client.getTraceInfo()?.nestingLevel).toBe(0);
      });
    });

    it('should not trace when disabled', () => {
      client.updateConfig({ enableTracing: false });
      
      client.traceEntry('testFunction');
      
      expect(mockWs.send).not.toHaveBeenCalled();
    });
  });

  describe('exec and wrapFunction', () => {
    beforeEach(() => {
      client = new WSLogClient({ enableTracing: true });
    });

    it('should execute synchronous function with tracing', async () => {
      const testFn = jest.fn((a: number, b: number) => a + b);
      
      const result = await client.runInContext({}, () => client.exec(testFn, 2, 3));
      
      expect(result).toBe(5);
      expect(mockWs.send).toHaveBeenCalledTimes(2); // entry and exit
    });

    it('should execute async function with tracing', async () => {
      const testFn = jest.fn(async (a: number) => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return a * 2;
      });
      
      const promise = client.runInContext({}, () => client.exec(testFn, 5));
      expect(mockWs.send).toHaveBeenCalledTimes(1); // entry
      
      jest.runAllTimers();
      const result = await promise;
      
      expect(result).toBe(10);
      expect(mockWs.send).toHaveBeenCalledTimes(2); // entry and exit
    });

    it('should handle function errors', async () => {
      const error = new Error('test error');
      const testFn = jest.fn(() => {
        throw error;
      });
      
      await expect(
        client.runInContext({}, () => client.exec(testFn))
      ).rejects.toThrow(error);
      
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR]')
      );
    });

    it('should wrap function for automatic tracing', async () => {
      const originalFn = (a: number, b: number) => a * b;
      const wrapped = client.wrapFunction('multiply', originalFn);
      
      const result = await client.runInContext({}, () => wrapped(4, 5));
      
      expect(result).toBe(20);
      expect(mockWs.send).toHaveBeenCalledTimes(2); // entry and exit
    });
  });

  describe('filtering', () => {
    beforeEach(() => {
      client = new WSLogClient({
        enableTracing: true,
        regexInclude: ['.*important.*'],
        regexExclude: ['.*skip.*'],
      });
    });

    it('should include messages matching include pattern', () => {
      client.trace('entry', 'test', 'important message');
      
      expect(mockWs.send).toHaveBeenCalled();
    });

    it('should exclude messages matching exclude pattern', () => {
      client.trace('entry', 'test', 'skip this message');
      
      expect(mockWs.send).not.toHaveBeenCalled();
    });

    it('should prioritize include over exclude', async () => {
      // First create the client with initial filters
      client = new WSLogClient({
        enableTracing: true,
      });
      
      // Run in context and update config within that context
      await client.runInContext({}, () => {
        client.updateConfig({
          regexInclude: ['.*important.*'],
          regexExclude: ['.*message.*'],
        });
        
        client.trace('entry', 'test', 'important message');
      });
      
      expect(mockWs.send).toHaveBeenCalled();
    });
  });

  describe('interactive mode', () => {
    beforeEach(() => {
      client = new WSLogClient({ enableTracing: true });
    });

    it('should maintain persistent context in interactive mode', () => {
      client.enableInteractiveMode();
      
      client.traceEntry('func1');
      const info1 = client.getTraceInfo();
      
      // Simulate new command/context
      client.traceEntry('func2');
      const info2 = client.getTraceInfo();
      
      expect(info2?.functionStack).toContain('func1');
      expect(info2?.functionStack).toContain('func2');
      expect(info2?.nestingLevel).toBe(2);
    });

    it('should reset context when disabling interactive mode', () => {
      client.enableInteractiveMode();
      client.traceEntry('func1');
      
      client.disableInteractiveMode();
      
      expect(client.getTraceInfo()).toBeNull();
    });

    it('should reset trace context on demand', () => {
      client.enableInteractiveMode();
      client.traceEntry('func1');
      
      client.resetTraceContext();
      
      expect(client.getTraceInfo()).toBeNull();
    });
  });

  describe('async context management', () => {
    beforeEach(() => {
      client = new WSLogClient({ enableTracing: true });
    });

    it('should maintain separate contexts for async operations', async () => {
      const results: string[] = [];
      
      const async1 = client.runInContext({ source: 'async1' }, async () => {
        client.traceEntry('async1Func');
        await new Promise(resolve => setTimeout(resolve, 50));
        results.push('async1');
        client.traceExit('async1Func');
      });
      
      const async2 = client.runInContext({ source: 'async2' }, async () => {
        client.traceEntry('async2Func');
        await new Promise(resolve => setTimeout(resolve, 25));
        results.push('async2');
        client.traceExit('async2Func');
      });
      
      jest.runAllTimers();
      await Promise.all([async1, async2]);
      
      expect(results).toEqual(['async2', 'async1']);
      // Each async operation should have its own trace context
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('async1Func')
      );
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('async2Func')
      );
    });
  });

  describe('file logging', () => {
    beforeEach(() => {
      jest.setSystemTime(new Date('2025-01-01T12:34:56.789Z'));
    });

    it('should write to file when configured', () => {
      client = new WSLogClient({
        logToFile: true,
        logFilePath: 'test.log',
        serverless: true,
      });
      
      client.info('test message');
      
      expect(mockFs.appendFileSync).toHaveBeenCalledWith(
        'test.log',
        expect.stringContaining('test message')
      );
      // Check that it contains a timestamp
      const call = mockFs.appendFileSync.mock.calls[0][1] as string;
      expect(call).toMatch(/\[\d{2}\.\d{2}\.\d{2}\.\d{3}\]/);
    });

    it('should create directory if not exists', () => {
      mockFs.existsSync.mockReturnValue(false);
      
      client = new WSLogClient({
        logToFile: true,
        logFilePath: 'logs/test.log',
        serverless: true,
      });
      
      expect(mockFs.mkdirSync).toHaveBeenCalledWith('logs', { recursive: true });
    });

    it('should format nested messages correctly', () => {
      client = new WSLogClient({
        logToFile: true,
        logFilePath: 'test.log',
        serverless: true,
        enableTracing: true,
      });
      
      client.traceEntry('testFunc');
      client.info('nested message');
      
      // First call is the trace entry
      expect(mockFs.appendFileSync).toHaveBeenNthCalledWith(
        1,
        'test.log',
        expect.stringContaining('|>>> Call testFunc')
      );
      
      // Second call is the nested info message - should have double pipe
      expect(mockFs.appendFileSync).toHaveBeenNthCalledWith(
        2,
        'test.log',
        expect.stringContaining('|| nested message')
      );
    });

    it('should clear log file when configured', () => {
      client = new WSLogClient({
        logToFile: true,
        logFilePath: 'test.log',
        clearLogFileOnStart: true,
        serverless: true,
      });
      
      expect(mockFs.writeFileSync).toHaveBeenCalledWith('test.log', '');
    });
  });

  describe('console logging', () => {
    let consoleLogSpy: jest.SpyInstance;
    let consoleDebugSpy: jest.SpyInstance;
    
    beforeEach(() => {
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation();
      jest.setSystemTime(new Date('2025-01-01T12:34:56.789Z'));
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
      consoleDebugSpy.mockRestore();
    });

    it('should log to console when configured', () => {
      client = new WSLogClient({
        logToConsole: true,
        serverless: true,
      });
      
      client.info('console message');
      
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        expect.stringContaining('[TRACE]')
      );
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        expect.stringContaining('console message')
      );
    });

    it('should format nested console messages', () => {
      client = new WSLogClient({
        logToConsole: true,
        serverless: true,
        enableTracing: true,
        debugTraceRequests: true,
      });
      
      client.traceEntry('testFunc');
      client.debug('nested debug');
      
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        expect.stringContaining('[TRACE]')
      );
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        expect.stringContaining('|>>> Call testFunc')
      );
      // The debug message should have double pipes
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        expect.stringContaining('|| nested debug')
      );
    });
  });

  describe('error handling with stack traces', () => {
    beforeEach(() => {
      client = new WSLogClient({
        errorStackTraceDepth: 3,
        logToFile: true,
        logFilePath: 'test.log',
        serverless: true,
      });
    });

    it('should include stack trace in error logs', () => {
      const error = new Error('test error');
      client.error('Error occurred', error);
      
      expect(mockFs.appendFileSync).toHaveBeenCalledWith(
        'test.log',
        expect.stringMatching(/Error occurred.*\n.*Stack \(top 3\):/s)
      );
    });

    it('should respect stack trace depth setting', () => {
      client.updateConfig({ errorStackTraceDepth: 0 });
      
      const error = new Error('test error');
      client.error('Error occurred', error);
      
      expect(mockFs.appendFileSync).toHaveBeenCalledWith(
        'test.log',
        expect.not.stringContaining('Stack (top')
      );
    });
  });

  describe('serverless mode', () => {
    it('should work without WebSocket connection', () => {
      client = new WSLogClient({
        serverless: true,
        logToFile: true,
        logFilePath: 'test.log',
      });
      
      expect(WebSocket).not.toHaveBeenCalled();
      expect(client.isConnected()).toBe(false);
      
      client.info('serverless message');
      
      expect(mockFs.appendFileSync).toHaveBeenCalled();
    });

    it('should queue messages in serverless mode without file/console', () => {
      client = new WSLogClient({
        serverless: true,
      });
      
      // Should not throw, just queue messages
      expect(() => client.info('test')).not.toThrow();
    });
  });

  describe('backwards compatibility', () => {
    beforeEach(() => {
      client = new WSLogClient({
        logToFile: true,
        logFilePath: 'test.log',
        serverless: true,
        enableTracing: true,
      });
      jest.setSystemTime(new Date('2025-01-01T12:34:56.789Z'));
    });

    it('should maintain exact log format for entry/exit', async () => {
      await client.runInContext({}, () => {
        client.traceEntry('myFunction', [1, 2, 3]);
        client.traceExit('myFunction', 'result');
      });
      
      expect(mockFs.appendFileSync).toHaveBeenNthCalledWith(
        1,
        'test.log',
        expect.stringMatching(/\[\d{2}\.\d{2}\.\d{2}\.\d{3}\] \|>>> Call myFunction \[1,2,3\]\n/)
      );
      
      expect(mockFs.appendFileSync).toHaveBeenNthCalledWith(
        2,
        'test.log',
        expect.stringMatching(/\[\d{2}\.\d{2}\.\d{2}\.\d{3}\] \|<<< Exit myFunction "result"\n/)
      );
    });

    it('should format timestamp correctly', () => {
      // Test with different times to ensure padding works
      // Mock Date to return local time matching expected format
      const mockDate = new Date('2025-01-01T01:02:03.004Z');
      // Override getHours, getMinutes, etc. to return expected values
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(1);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(2);
      jest.spyOn(Date.prototype, 'getSeconds').mockReturnValue(3);
      jest.spyOn(Date.prototype, 'getMilliseconds').mockReturnValue(4);
      
      client.info('test');
      
      expect(mockFs.appendFileSync).toHaveBeenCalledWith(
        'test.log',
        expect.stringContaining('[01.02.03.004]')
      );
    });
  });
});
