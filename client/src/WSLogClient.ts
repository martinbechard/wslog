// Type declarations for cross-environment compatibility
declare const window: any;
declare const global: any;

// Environment detection and WebSocket implementation
function getWebSocketImplementation(): any {
  // Check if we're in a browser environment
  if (typeof window !== 'undefined' && typeof window.WebSocket !== 'undefined') {
    return window.WebSocket;
  }
  
  // Check if we're in a Node.js environment with WebSocket available globally
  if (typeof global !== 'undefined' && global.WebSocket) {
    return global.WebSocket;
  }
  
  // Try to import ws for Node.js environment
  try {
    const ws = require('ws');
    return ws.default || ws;
  } catch (error) {
    throw new Error('WebSocket is not available. In Node.js, please install the "ws" package. In browsers, WebSocket should be available natively.');
  }
}

// Environment-specific imports and polyfills
let fs: any = null;
let path: any = null;
let EventEmitter: any = null;

try {
  // Try to import Node.js modules
  fs = require('fs');
  path = require('path');
  EventEmitter = require('events').EventEmitter;
} catch (error) {
  // In browser environment, provide minimal polyfills
  if (typeof window !== 'undefined') {
    // Browser EventEmitter polyfill
    class BrowserEventEmitter {
      private listeners: { [key: string]: Function[] } = {};

      on(event: string, listener: Function): this {
        if (!this.listeners[event]) {
          this.listeners[event] = [];
        }
        this.listeners[event].push(listener);
        return this;
      }

      emit(event: string, ...args: any[]): boolean {
        if (!this.listeners[event]) return false;
        this.listeners[event].forEach(listener => {
          try {
            listener(...args);
          } catch (error) {
            console.error('EventEmitter error:', error);
          }
        });
        return true;
      }

      removeListener(event: string, listener: Function): this {
        if (!this.listeners[event]) return this;
        const index = this.listeners[event].indexOf(listener);
        if (index > -1) {
          this.listeners[event].splice(index, 1);
        }
        return this;
      }

      removeAllListeners(event?: string): this {
        if (event) {
          delete this.listeners[event];
        } else {
          this.listeners = {};
        }
        return this;
      }
    }

    EventEmitter = BrowserEventEmitter;

    // Browser fs polyfill (no-op functions for file operations)
    fs = {
      existsSync: () => false,
      mkdirSync: () => {},
      writeFileSync: () => {},
      appendFileSync: () => {}
    };

    // Browser path polyfill
    path = {
      dirname: (filePath: string) => {
        const parts = filePath.split('/');
        return parts.slice(0, -1).join('/') || '.';
      }
    };
  }
}

import {
  LoggerConfig,
  ExtendedLoggerConfig,
  ClientMessage,
  ServerMessage,
  LogMessage,
  TraceEntry,
  LogLevel,
  TraceContext,
  createLogMessage,
  createTraceEntry,
  generateId,
  createContext,
  IContextVariable,
  deepCopy,
  stringify
} from '@wslog/shared';

export class WSLogClient extends EventEmitter {
  private ws: any = null;
  private config: Required<ExtendedLoggerConfig>;
  private reconnectAttempts = 0;
  private messageQueue: ClientMessage[] = [];
  private batchTimeout: any = null;
  private context: IContextVariable<TraceContext>;
  private threadIdCounter = 1;
  private reconnectTimer: any = null;
  private WebSocketClass: any;
  
  // Persistent context for interactive mode
  private persistentContext: TraceContext | null = null;
  private isInteractiveMode: boolean = false;

  // Current context for non-interactive mode
  private currentContext: TraceContext | null = null;

  constructor(config: ExtendedLoggerConfig = {}) {
    super();
    
    // Get the appropriate WebSocket implementation
    this.WebSocketClass = getWebSocketImplementation();
    
    this.config = {
      serverUrl: config.serverUrl || 'ws://localhost:8085',
      source: config.source || this.getDefaultSource(),
      batchSize: config.batchSize || 10,
      batchTimeout: config.batchTimeout || 1000,
      maxRetries: config.maxRetries || 5,
      enableTracing: config.enableTracing || false,
      maxTraceLevel: config.maxTraceLevel || -1,
      regexInclude: config.regexInclude || [],
      regexExclude: config.regexExclude || [],
      debugTraceRequests: config.debugTraceRequests || false,
      errorStackTraceDepth: config.errorStackTraceDepth || 5,
      serverless: config.serverless || false,
      logToFile: config.logToFile || false,
      logToConsole: config.logToConsole || false,
      logFilePath: config.logFilePath || 'trace.log',
      clearLogFileOnStart: config.clearLogFileOnStart || false,
    };

    this.context = createContext<TraceContext>();
    
    // Initialize file logging if needed (only in Node.js)
    if (this.config.logToFile && fs) {
      this.initializeFileLogging();
    }
    
    // Only connect to WebSocket if not in serverless mode
    if (!this.config.serverless) {
      this.connect();
    }
  }  private initializeFileLogging(): void {
    if (!this.config.logFilePath || !fs || !path) return;
    
    // Ensure directory exists
    const dir = path.dirname(this.config.logFilePath);
    if (dir && dir !== '.' && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Clear log file if requested
    if (this.config.clearLogFileOnStart) {
      fs.writeFileSync(this.config.logFilePath, '');
    }
  }  private getDefaultSource(): string {
    try {
      // Try Node.js hostname first
      if (typeof require !== 'undefined') {
        const os = require('os');
        return `${os.hostname()}-wslog`;
      }
    } catch {
      // Fallback for browser environment
    }
    
    // Browser fallback
    if (typeof window !== 'undefined') {
      return `${(window as any).location?.hostname || 'browser'}-wslog`;
    }
    
    return 'wslog-client';
  }  public connect(): void {
    try {
      this.ws = new this.WebSocketClass(this.config.serverUrl);

      this.ws.onopen = () => {
        console.log(`Connected to WSLog server at ${this.config.serverUrl}`);
        this.reconnectAttempts = 0;
        this.emit('connected');
        this.flushMessageQueue();
      };

      this.ws.onmessage = (event: any) => {
        try {
          const data = event.data || event;
          const message: ServerMessage = JSON.parse(data.toString());
          this.handleServerMessage(message);
        } catch (error) {
          console.error('Error parsing server message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('Disconnected from WSLog server');
        this.ws = null;
        this.emit('disconnected');
        this.scheduleReconnect();
      };

      this.ws.onerror = (error: any) => {
        console.error('WebSocket error:', error);
        this.emit('error', error);
      };

    } catch (error) {
      console.error('Failed to connect to WSLog server:', error);
      this.scheduleReconnect();
    }
  }

  private handleServerMessage(message: ServerMessage): void {
    switch (message.type) {
      case 'status':
        this.emit('status', message);
        break;
      case 'error':
        this.emit('serverError', message.error);
        break;
      case 'pong':
        this.emit('pong');
        break;
      default:
        this.emit('message', message);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxRetries) {
      console.error('Max reconnection attempts reached. Giving up.');
      this.emit('maxRetriesReached');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.config.maxRetries})`);
    
    // Clear any existing timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private formatTimestamp(date: Date): string {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
    
    return `${hours}.${minutes}.${seconds}.${milliseconds}`;
  }

  private formatLogMessage(message: string, nestingLevel: number = 0): string {
    const timestamp = this.formatTimestamp(new Date());
    const prefix = nestingLevel > 0 ? '|'.repeat(nestingLevel) : '';
    // For trace messages, don't add extra space as it's already in the message
    // For log messages, add space after pipes
    const isTraceMessage = message.startsWith('>>>') || message.startsWith('<<<');
    const formattedMessage = nestingLevel > 0 && !isTraceMessage ? ` ${message}` : message;
    return `[${timestamp}] ${prefix}${formattedMessage}\n`;
  }

  private writeToFile(message: string): void {
    if (this.config.logToFile && this.config.logFilePath && fs) {
      fs.appendFileSync(this.config.logFilePath, message);
    }
  }

  private writeToConsole(message: string): void {
    if (this.config.logToConsole) {
      // Remove trailing newline for console output and add [TRACE] prefix
      console.debug(`[TRACE] ${message.trimEnd()}`);
    }
  }

  private getWebSocketState(): number {
    if (!this.ws) return 3; // CLOSED
    
    // Handle both Node.js ws and browser WebSocket APIs
    if (typeof this.ws.readyState !== 'undefined') {
      return this.ws.readyState;
    }
    
    // Fallback
    return 3; // CLOSED
  }

  private sendMessage(message: ClientMessage): void {
    // Handle file/console logging for log and trace messages
    if (message.type === 'log' || message.type === 'trace') {
      const data = message.data as LogMessage | TraceEntry;
      const nestingLevel = data.nestingLevel || 0;
      let formattedMessage = '';
      
      if (message.type === 'log') {
        const logData = data as LogMessage;
        formattedMessage = this.formatLogMessage(logData.message, nestingLevel);
      } else {
        const traceData = data as TraceEntry;
        formattedMessage = this.formatLogMessage(traceData.message, nestingLevel);
      }
      
      this.writeToFile(formattedMessage);
      this.writeToConsole(formattedMessage);
    }
    
    // Send to WebSocket if connected and not in serverless mode
    if (!this.config.serverless && this.ws && this.getWebSocketState() === 1) { // 1 = OPEN
      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Failed to send message:', error);
        this.messageQueue.push(message);
      }
    } else if (!this.config.serverless) {
      // Queue messages if not serverless and not connected
      this.messageQueue.push(message);
    }
    // In serverless mode, just write to file/console and don't queue
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.sendMessage(message);
      }
    }
  }

  private getOrCreateContext(): TraceContext {
    // For interactive mode, use persistent context
    if (this.isInteractiveMode) {
      if (!this.persistentContext) {
        this.persistentContext = {
          threadId: this.threadIdCounter++,
          nestingLevel: 0,
          functionStack: [],
          source: this.config.source,
          filters: {
            regexInclude: this.config.regexInclude.map((pattern: string) => new RegExp(pattern)),
            regexExclude: this.config.regexExclude.map((pattern: string) => new RegExp(pattern)),
          },
        };
      }
      return this.persistentContext;
    }

    // For non-interactive mode, check async context first
    let ctx = this.context.get();
    if (ctx) {
      return ctx;
    }

    // If no async context, use current context
    if (this.currentContext) {
      return this.currentContext;
    }

    // Create new context
    this.currentContext = {
      threadId: this.threadIdCounter++,
      nestingLevel: 0,
      functionStack: [],
      source: this.config.source,
      filters: {
        regexInclude: this.config.regexInclude.map((pattern: string) => new RegExp(pattern)),
        regexExclude: this.config.regexExclude.map((pattern: string) => new RegExp(pattern)),
      },
    };
    return this.currentContext;
  }

  private shouldTraceMessage(message: string, ctx: TraceContext): boolean {
    if (this.config.maxTraceLevel === 0) return false;
    if (this.config.maxTraceLevel !== -1 && ctx.nestingLevel > this.config.maxTraceLevel) return false;

    // Check include patterns first
    if (ctx.filters?.regexInclude && ctx.filters.regexInclude.length > 0) {
      const included = ctx.filters.regexInclude.some((regex: RegExp) => regex.test(message));
      if (included) {
        // Message matches include pattern - include it regardless of exclude patterns
        return true;
      } else {
        // Message doesn't match include pattern - exclude it
        return false;
      }
    }

    // No include patterns exist, check exclude patterns
    if (ctx.filters?.regexExclude && ctx.filters.regexExclude.length > 0) {
      const excluded = ctx.filters.regexExclude.some((regex: RegExp) => regex.test(message));
      if (excluded) return false;
    }

    return true;
  }

  private isPromiseLike(value: any): value is Promise<any> {
    return value && typeof value === 'object' && typeof value.then === 'function';
  }

  // Public API methods

  /**
   * Enable interactive mode for persistent context across multiple commands
   */
  public enableInteractiveMode(): void {
    this.isInteractiveMode = true;
    console.log('🔄 Interactive mode enabled - context will persist across commands');
  }

  /**
   * Disable interactive mode and reset context
   */
  public disableInteractiveMode(): void {
    this.isInteractiveMode = false;
    this.persistentContext = null;
    console.log('🔄 Interactive mode disabled - context reset');
  }

  /**
   * Reset the trace context (useful for starting a new trace session)
   */
  public resetTraceContext(): void {
    if (this.isInteractiveMode) {
      this.persistentContext = null;
      console.log('🔄 Trace context reset');
    } else {
      this.currentContext = null;
    }
  }

  /**
   * Get current trace context info for debugging
   */
  public getTraceInfo(): { nestingLevel: number; functionStack: string[]; threadId: number } | null {
    const ctx = this.isInteractiveMode ? this.persistentContext : (this.context.get() || this.currentContext);
    if (!ctx) return null;
    
    return {
      nestingLevel: ctx.nestingLevel,
      functionStack: ctx.functionStack.map((f: any) => f.functionName),
      threadId: ctx.threadId,
    };
  }

  /**
   * Get the current thread ID (for backward compatibility)
   */
  public getCurrentThreadId(): number {
    const ctx = this.getOrCreateContext();
    return ctx.threadId;
  }

  public log(level: LogLevel, message: string, data?: any): void {
    // Get current trace context to include nesting level and thread ID
    const ctx = this.getOrCreateContext();
    
    // IMPORTANT FIX: Log messages should be at nestingLevel + 1 when inside a trace
    // This makes them children of the current function being traced
    const logNestingLevel = ctx && ctx.functionStack.length > 0 
      ? ctx.nestingLevel + 1  // FIXED: Make log messages children of current function
      : (ctx?.nestingLevel || 0);
    
    // Don't add space here - let formatLogMessage handle it
    const logMessage = createLogMessage(level, message, {
      source: this.config.source,
      data: data ? deepCopy(data) : undefined,
      // Include trace context information for proper indentation
      threadId: ctx?.threadId,
      nestingLevel: logNestingLevel,
    });

    this.sendMessage({
      type: 'log',
      id: generateId(),
      data: logMessage,
      route: '/logs',
    });
  }

  public info(message: string, data?: any): void {
    this.log('info', message, data);
  }

  public warn(message: string, data?: any): void {
    this.log('warn', message, data);
  }

  public error(message: string, data?: any): void {
    // Handle error with stack trace if configured
    let errorMessage = message;
    let errorData = data;
    
    if (this.config.errorStackTraceDepth && this.config.errorStackTraceDepth > 0) {
      const stack = new Error().stack
        ?.split('\n')
        .slice(2, 2 + this.config.errorStackTraceDepth)
        .join('\n');
      
      if (stack) {
        errorMessage += `\nStack (top ${this.config.errorStackTraceDepth}):\n${stack}`;
      }
      
      // If data is an Error object, include its stack too
      if (data instanceof Error) {
        errorData = {
          errorMessage: data.message,
          errorStack: data.stack,
          name: data.name
        };
      }
    }
    
    this.log('error', errorMessage, errorData);
  }

  public debug(message: string, data?: any): void {
    // Only log debug messages if debugTraceRequests is enabled
    if (this.config.debugTraceRequests) {
      this.log('debug', message, data);
    }
  }

  public trace(type: TraceEntry['type'], functionName: string, message: string, options: Partial<TraceEntry> = {}): void {
    if (!this.config.enableTracing) return;

    const ctx = this.getOrCreateContext();
    
    if (!this.shouldTraceMessage(message, ctx)) return;

    const traceEntry = createTraceEntry(type, 'debug', message, {
      functionName,
      source: this.config.source,
      threadId: ctx.threadId,
      nestingLevel: ctx.nestingLevel,
      ...options,
    });

    this.sendMessage({
      type: 'trace',
      id: generateId(),
      data: traceEntry,
      route: '/trace',
    });
  }

  public traceEntry(functionName: string, args?: any[]): void {
    const ctx = this.getOrCreateContext();
    
    ctx.nestingLevel++;
    ctx.functionStack.push({
      functionName,
      startTime: Date.now(),
      level: ctx.nestingLevel,
    });

    const argsString = args ? ` ${stringify(args)}` : '';
    this.trace('entry', functionName, `>>> Call ${functionName}${argsString}`);
  }

  public traceExit(functionName: string, returnValue?: any, error?: Error): void {
    const ctx = this.getOrCreateContext();
    if (!ctx) {
      console.warn(`No trace context found for exit of ${functionName}`);
      return;
    }

    const functionCall = ctx.functionStack.pop();
    const executionTime = functionCall ? Date.now() - functionCall.startTime : undefined;

    // Validate that we're exiting the correct function
    if (functionCall && functionCall.functionName !== functionName) {
      console.warn(`Trace mismatch: Expected to exit ${functionCall.functionName}, but got ${functionName}`);
    }

    // Build the exit message
    let message = `<<< Exit ${functionName}`;
    let data: any = {};

    if (error) {
      message += ` [ERROR]`;
      data.error = error.message;
      data.stack = error.stack;
    } else if (returnValue !== undefined) {
      message += ` ${stringify(returnValue)}`;
      data.returnValue = deepCopy(returnValue);
    }

    if (executionTime !== undefined) {
      data.executionTime = executionTime;
    }

    // Send the trace message at the current nesting level
    this.trace('exit', functionName, message, {
      returnValue: data.returnValue,
      executionTime,
      data: Object.keys(data).length > 0 ? data : undefined,
    });

    // NOW decrement the nesting level AFTER sending the log
    ctx.nestingLevel = Math.max(0, ctx.nestingLevel - 1);
  }

  public exec<F extends (...args: any[]) => any>(
    func: F,
    ...args: Parameters<F>
  ): ReturnType<F> {
    const functionName = func.name || 'anonymous';
    
    this.traceEntry(functionName, args);

    try {
      const result = func(...args);
      
      // Handle async functions
      if (this.isPromiseLike(result)) {
        return result
          .then((value: any) => {
            this.traceExit(functionName, value);
            return value;
          })
          .catch((error: Error) => {
            this.traceExit(functionName, undefined, error);
            throw error;
          }) as ReturnType<F>;
      } else {
        this.traceExit(functionName, result);
        return result;
      }
    } catch (error) {
      this.traceExit(functionName, undefined, error as Error);
      throw error;
    }
  }

  public wrapFunction<T extends (...args: any[]) => any>(
    functionName: string,
    func: T
  ): T {
    const client = this;
    
    return ((...args: Parameters<T>): ReturnType<T> => {
      return client.exec(func, ...args);
    }) as T;
  }

  public async runInContext<T>(contextData: Partial<TraceContext>, callback: () => T): Promise<T> {
    const existingCtx = this.getOrCreateContext();
    const newCtx = { ...existingCtx, ...contextData };
    
    return new Promise<T>((resolve, reject) => {
      this.context.run(newCtx, () => {
        try {
          const result = callback();
          
          if (this.isPromiseLike(result)) {
            // Handle promises - result is already a Promise<any>
            result.then(resolve).catch(reject);
          } else {
            // Handle synchronous results
            resolve(result);
          }
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  public subscribe(route: string, filters?: ClientMessage['filters']): void {
    this.sendMessage({
      type: 'subscribe',
      route,
      filters,
    });
  }

  public unsubscribe(route: string): void {
    this.sendMessage({
      type: 'unsubscribe',
      route,
    });
  }

  public ping(): void {
    this.sendMessage({
      type: 'ping',
      id: generateId(),
    });
  }

  public close(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    if (this.ws) {
      this.ws.close();
    }
  }

  public isConnected(): boolean {
    return !this.config.serverless && this.getWebSocketState() === 1; // 1 = OPEN
  }

  public updateConfig(config: Partial<ExtendedLoggerConfig>): void {
    Object.assign(this.config, config);
    
    // Update regex filters
    if (config.regexInclude !== undefined || config.regexExclude !== undefined) {
      const newFilters = {
        regexInclude: this.config.regexInclude.map((pattern: string) => new RegExp(pattern)),
        regexExclude: this.config.regexExclude.map((pattern: string) => new RegExp(pattern)),
      };
      
      // Update filters in all contexts
      // 1. Update async context if it exists
      const asyncCtx = this.context.get();
      if (asyncCtx) {
        asyncCtx.filters = newFilters;
      }
      
      // 2. Update current context if it exists
      if (this.currentContext) {
        this.currentContext.filters = newFilters;
      }
      
      // 3. Update persistent context if in interactive mode
      if (this.isInteractiveMode && this.persistentContext) {
        this.persistentContext.filters = newFilters;
      }
    }
  }

  /**
   * Clear the log file (for compatibility with old tracer)
   */
  public clearLogFile(): void {
    if (this.config.logToFile && this.config.logFilePath && fs) {
      fs.writeFileSync(this.config.logFilePath, '');
    }
  }
}
