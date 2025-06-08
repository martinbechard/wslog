import WebSocket from 'ws';
import { EventEmitter } from 'events';
import {
  LoggerConfig,
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
  private ws: WebSocket | null = null;
  private config: Required<LoggerConfig>;
  private reconnectAttempts = 0;
  private messageQueue: ClientMessage[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private context: IContextVariable<TraceContext>;
  private threadIdCounter = 1;
  
  // Persistent context for interactive mode
  private persistentContext: TraceContext | null = null;
  private isInteractiveMode: boolean = false;

  constructor(config: LoggerConfig = {}) {
    super();
    
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
    };

    this.context = createContext<TraceContext>();
    this.connect();
  }

  private getDefaultSource(): string {
    try {
      const os = require('os');
      return `${os.hostname()}-wslog`;
    } catch {
      return 'wslog-client';
    }
  }

  private connect(): void {
    try {
      this.ws = new WebSocket(this.config.serverUrl);

      this.ws.on('open', () => {
        console.log(`Connected to WSLog server at ${this.config.serverUrl}`);
        this.reconnectAttempts = 0;
        this.emit('connected');
        this.flushMessageQueue();
      });

      this.ws.on('message', (data: Buffer) => {
        try {
          const message: ServerMessage = JSON.parse(data.toString());
          this.handleServerMessage(message);
        } catch (error) {
          console.error('Error parsing server message:', error);
        }
      });

      this.ws.on('close', () => {
        console.log('Disconnected from WSLog server');
        this.ws = null;
        this.emit('disconnected');
        this.scheduleReconnect();
      });

      this.ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.emit('error', error);
      });

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
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  private sendMessage(message: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Failed to send message:', error);
        this.messageQueue.push(message);
      }
    } else {
      this.messageQueue.push(message);
    }
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
            regexInclude: this.config.regexInclude.map(pattern => new RegExp(pattern)),
            regexExclude: this.config.regexExclude.map(pattern => new RegExp(pattern)),
          },
        };
      }
      return this.persistentContext;
    }

    // For non-interactive mode, use async context
    let ctx = this.context.get();
    if (!ctx) {
      ctx = {
        threadId: this.threadIdCounter++,
        nestingLevel: 0,
        functionStack: [],
        source: this.config.source,
        filters: {
          regexInclude: this.config.regexInclude.map(pattern => new RegExp(pattern)),
          regexExclude: this.config.regexExclude.map(pattern => new RegExp(pattern)),
        },
      };
    }
    return ctx;
  }

  private shouldTraceMessage(message: string, ctx: TraceContext): boolean {
    if (this.config.maxTraceLevel === 0) return false;
    if (this.config.maxTraceLevel !== -1 && ctx.nestingLevel > this.config.maxTraceLevel) return false;

    // Check include patterns first
    if (ctx.filters?.regexInclude && ctx.filters.regexInclude.length > 0) {
      const included = ctx.filters.regexInclude.some(regex => regex.test(message));
      if (!included) return false;
    }

    // Check exclude patterns
    if (ctx.filters?.regexExclude && ctx.filters.regexExclude.length > 0) {
      const excluded = ctx.filters.regexExclude.some(regex => regex.test(message));
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
    }
  }

  /**
   * Get current trace context info for debugging
   */
  public getTraceInfo(): { nestingLevel: number; functionStack: string[]; threadId: number } | null {
    const ctx = this.isInteractiveMode ? this.persistentContext : this.context.get();
    if (!ctx) return null;
    
    return {
      nestingLevel: ctx.nestingLevel,
      functionStack: ctx.functionStack.map(f => f.functionName),
      threadId: ctx.threadId,
    };
  }

  public log(level: LogLevel, message: string, data?: any): void {
    // Get current trace context to include nesting level and thread ID
    const ctx = this.isInteractiveMode ? this.persistentContext : this.context.get();
    
    // IMPORTANT FIX: Log messages should be at nestingLevel + 1 when inside a trace
    // This makes them children of the current function being traced
    const logNestingLevel = ctx && ctx.functionStack.length > 0 
      ? ctx.nestingLevel + 1  // FIXED: Make log messages children of current function
      : (ctx?.nestingLevel || 0);
    
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
    this.log('error', message, data);
  }

  public debug(message: string, data?: any): void {
    this.log('debug', message, data);
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

    // For interactive mode, context is already persistent
    // For non-interactive mode, run in context scope
    if (this.isInteractiveMode) {
      const argsString = args ? ` ${stringify(args)}` : '';
      this.trace('entry', functionName, `>>> Call ${functionName}${argsString}`);
    } else {
      this.context.run(ctx, () => {
        const argsString = args ? ` ${stringify(args)}` : '';
        this.trace('entry', functionName, `>>> Call ${functionName}${argsString}`);
      });
    }
  }

  public traceExit(functionName: string, returnValue?: any, error?: Error): void {
    const ctx = this.isInteractiveMode ? this.persistentContext : this.context.get();
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

    // IMPORTANT: Send the trace message FIRST (at the current nesting level)
    // THEN decrement the nesting level for symmetry with entry messages
    if (this.isInteractiveMode) {
      this.trace('exit', functionName, message, {
        returnValue: data.returnValue,
        executionTime,
        data: Object.keys(data).length > 0 ? data : undefined,
      });
    } else {
      this.context.run(ctx, () => {
        this.trace('exit', functionName, message, {
          returnValue: data.returnValue,
          executionTime,
          data: Object.keys(data).length > 0 ? data : undefined,
        });
      });
    }

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
    
    if (this.ws) {
      this.ws.close();
    }
  }

  public isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  public updateConfig(config: Partial<LoggerConfig>): void {
    Object.assign(this.config, config);
    
    // Update regex filters
    if (config.regexInclude || config.regexExclude) {
      const ctx = this.isInteractiveMode ? this.persistentContext : this.context.get();
      if (ctx) {
        ctx.filters = {
          regexInclude: this.config.regexInclude.map(pattern => new RegExp(pattern)),
          regexExclude: this.config.regexExclude.map(pattern => new RegExp(pattern)),
        };
      }
    }
  }
}