/**
 * Common types and interfaces for the wslog system
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogMessage {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  source?: string;
  threadId?: number;
  nestingLevel?: number;
  data?: any;
  stack?: string;
}

export interface TraceEntry {
  id: string;
  timestamp: string;
  type: 'entry' | 'exit' | 'log' | 'error';
  functionName?: string;
  level: LogLevel;
  message: string;
  source?: string;
  threadId?: number;
  nestingLevel?: number;
  args?: any[];
  returnValue?: any;
  executionTime?: number;
  data?: any;
  stack?: string;
}

// Unified interface for frontend display
export interface UnifiedLogMessage {
  id: string;
  timestamp: string;
  type: 'info' | 'warn' | 'error' | 'debug' | 'trace-entry' | 'trace-exit';
  level: LogLevel;
  message: string;
  source?: string;
  caller?: string;
  threadId?: number;
  nestingLevel?: number;
  data?: any;
  stack?: string;
  functionName?: string;
  args?: any[];
  returnValue?: any;
  executionTime?: number;
}

export interface LoggerConfig {
  serverUrl?: string;
  source?: string;
  batchSize?: number;
  batchTimeout?: number;
  maxRetries?: number;
  enableTracing?: boolean;
  maxTraceLevel?: number;
  regexInclude?: string[];
  regexExclude?: string[];
  debugTraceRequests?: boolean;
  errorStackTraceDepth?: number;
}

export interface ServerConfig {
  port?: number;
  maxConnections?: number;
  heartbeatInterval?: number;
  logRetention?: number;
  enableCompression?: boolean;
  routes?: RouteConfig[];
}

export interface RouteConfig {
  route: string;
  output?: string;
  capture?: 'full' | 'payloadOnly' | 'bodyOnly';
  format?: 'text' | 'json' | 'jsonl';
  allowReadFile?: boolean;
  allowWriteFile?: boolean;
}

export interface ClientMessage {
  type: 'log' | 'trace' | 'ping' | 'subscribe' | 'unsubscribe';
  id?: string;
  data?: LogMessage | TraceEntry | any;
  route?: string;
  filters?: {
    levels?: LogLevel[];
    sources?: string[];
    regexInclude?: string[];
    regexExclude?: string[];
  };
}

export interface ServerMessage {
  type: 'log' | 'trace' | 'pong' | 'error' | 'status' | 'batch';
  id?: string;
  data?: LogMessage | TraceEntry | LogMessage[] | TraceEntry[] | any;
  error?: string;
  status?: string;
}

export interface ConnectionInfo {
  id: string;
  connectedAt: string;
  lastActivity: string;
  messageCount: number;
  subscriptions: string[];
  filters?: {
    levels?: LogLevel[];
    sources?: string[];
    regexInclude?: string[];
    regexExclude?: string[];
  };
}

export interface ServerStats {
  uptime: number;
  connections: number;
  totalMessages: number;
  messagesPerSecond: number;
  memoryUsage: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
}

// Context interface for thread-local storage
export interface TraceContext {
  threadId: number;
  nestingLevel: number;
  functionStack: Array<{
    functionName: string;
    startTime: number;
    level: number;
  }>;
  source?: string;
  filters?: {
    regexInclude?: RegExp[];
    regexExclude?: RegExp[];
  };
}

// Utility functions
export function createLogMessage(
  level: LogLevel,
  message: string,
  options: Partial<LogMessage> = {}
): LogMessage {
  return {
    id: generateId(),
    timestamp: new Date().toISOString(),
    level,
    message,
    ...options,
  };
}

export function createTraceEntry(
  type: TraceEntry['type'],
  level: LogLevel,
  message: string,
  options: Partial<TraceEntry> = {}
): TraceEntry {
  return {
    id: generateId(),
    timestamp: new Date().toISOString(),
    type,
    level,
    message,
    ...options,
  };
}

// Convert LogMessage or TraceEntry to UnifiedLogMessage for frontend
export function toUnifiedLogMessage(msg: LogMessage | TraceEntry): UnifiedLogMessage {
  if ('type' in msg) {
    // This is a TraceEntry
    let unifiedType: UnifiedLogMessage['type'];
    switch (msg.type) {
      case 'entry':
        unifiedType = 'trace-entry';
        break;
      case 'exit':
        unifiedType = 'trace-exit';
        break;
      case 'log':
        unifiedType = msg.level; // Use the level as type for log entries
        break;
      case 'error':
        unifiedType = 'error';
        break;
      default:
        unifiedType = msg.level; // Fallback to level
    }
    
    return {
      ...msg,
      type: unifiedType,
      functionName: msg.functionName,
      args: msg.args,
      returnValue: msg.returnValue,
      executionTime: msg.executionTime,
    };
  } else {
    // This is a LogMessage  
    return {
      ...msg,
      type: msg.level, // Use level as type for regular log messages
    };
  }
}

export function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export function formatTimestamp(date: Date = new Date()): string {
  const milliseconds = date.getMilliseconds();
  const paddedMilliseconds = String(milliseconds).padStart(3, '0');
  
  const formattedDate = date
    .toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    .replace(/:/g, '.');
    
  return `${formattedDate}.${paddedMilliseconds}`;
}

export function deepCopy(obj: any, seen = new Set()): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (seen.has(obj)) {
    return '[Circular]';
  }

  seen.add(obj);

  if (Array.isArray(obj)) {
    const copy: any[] = [];
    for (const item of obj) {
      copy.push(deepCopy(item, seen));
    }
    return copy;
  }

  const copy: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      copy[key] = deepCopy(obj[key], seen);
    }
  }
  return copy;
}

export function stringify(value: any): string {
  if (typeof value === 'object') {
    return JSON.stringify(deepCopy(value));
  }
  return JSON.stringify(value);
}