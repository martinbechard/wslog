import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { IncomingMessage } from 'http';
import {
  ServerConfig,
  RouteConfig,
  ClientMessage,
  ServerMessage,
  LogMessage,
  TraceEntry,
  ConnectionInfo,
  ServerStats,
  LogLevel,
  generateId,
  formatTimestamp
} from '@wslog/shared';

interface ClientConnection {
  id: string;
  ws: WebSocket;
  info: ConnectionInfo;
  route?: string;
}

export class WSLogServer {
  private wss: WebSocketServer;
  private clients: Map<string, ClientConnection> = new Map();
  private config: Required<ServerConfig>;
  private stats: ServerStats;
  private startTime: number;
  private messageCount: number = 0;
  private messageHistory: number[] = [];

  constructor(config: ServerConfig = {}) {
    this.config = {
      port: config.port || 8085,
      maxConnections: config.maxConnections || 1000,
      heartbeatInterval: config.heartbeatInterval || 30000,
      logRetention: config.logRetention || 10000,
      enableCompression: config.enableCompression || true,
      routes: config.routes || this.getDefaultRoutes(),
    };

    this.startTime = Date.now();
    this.stats = this.initializeStats();

    this.wss = new WebSocketServer({
      port: this.config.port,
      perMessageDeflate: this.config.enableCompression,
    });

    this.setupWebSocketServer();
    this.startHeartbeat();
    this.startStatsCollection();

    console.log(`WSLog server running on port ${this.config.port}`);
    this.logRouteConfiguration();
  }

  private getDefaultRoutes(): RouteConfig[] {
    return [
      {
        route: '/',
        output: './wslog-requests.jsonl',
        capture: 'full',
        format: 'jsonl'
      },
      {
        route: '/tracer',
        output: 'console',
        capture: 'bodyOnly',
        format: 'text'
      },
      {
        route: '/trace',
        output: './trace.log',
        capture: 'full',
        format: 'text'
      },
      {
        route: '/settings',
        output: './.wslog-settings.json',
        capture: 'bodyOnly',
        format: 'json',
        allowWriteFile: true,
        allowReadFile: true
      }
    ];
  }

  private initializeStats(): ServerStats {
    return {
      uptime: 0,
      connections: 0,
      totalMessages: 0,
      messagesPerSecond: 0,
      memoryUsage: {
        rss: 0,
        heapTotal: 0,
        heapUsed: 0,
        external: 0,
      },
    };
  }

  private logRouteConfiguration(): void {
    console.log('Route Configuration:');
    for (const route of this.config.routes) {
      console.log(`  ${route.route} -> ${route.output} [capture: ${route.capture}, format: ${route.format || 'text'}]`);
    }
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const clientId = uuidv4();
      const client: ClientConnection = {
        id: clientId,
        ws,
        info: {
          id: clientId,
          connectedAt: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
          messageCount: 0,
          subscriptions: [],
        },
      };

      this.clients.set(clientId, client);
      this.stats.connections = this.clients.size;

      console.log(`Client connected: ${clientId} (${this.clients.size} total)`);

      // Send welcome message
      this.sendToClient(client, {
        type: 'status',
        status: 'connected',
        data: { clientId, serverTime: new Date().toISOString() },
      });

      ws.on('message', (data: Buffer) => {
        try {
          const message: ClientMessage = JSON.parse(data.toString());
          this.handleClientMessage(client, message);
        } catch (error) {
          console.error(`Error parsing message from ${clientId}:`, error);
          this.sendToClient(client, {
            type: 'error',
            error: 'Invalid message format',
          });
        }
      });

      ws.on('close', () => {
        this.clients.delete(clientId);
        this.stats.connections = this.clients.size;
        console.log(`Client disconnected: ${clientId} (${this.clients.size} total)`);
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
        this.clients.delete(clientId);
        this.stats.connections = this.clients.size;
      });

      ws.on('pong', () => {
        client.info.lastActivity = new Date().toISOString();
      });
    });
  }

  private handleClientMessage(client: ClientConnection, message: ClientMessage): void {
    client.info.lastActivity = new Date().toISOString();
    client.info.messageCount++;
    this.messageCount++;
    this.stats.totalMessages++;

    switch (message.type) {
      case 'log':
        this.handleLogMessage(client, message);
        break;
      case 'trace':
        this.handleTraceMessage(client, message);
        break;
      case 'ping':
        this.sendToClient(client, { type: 'pong' });
        break;
      case 'subscribe':
        this.handleSubscription(client, message);
        break;
      case 'unsubscribe':
        this.handleUnsubscription(client, message);
        break;
      default:
        console.log(`Unknown message type: ${message.type}`);
        this.sendToClient(client, {
          type: 'error',
          error: 'Unknown message type',
        });
    }
  }

  private handleLogMessage(client: ClientConnection, message: ClientMessage): void {
    const logMessage = message.data as LogMessage;
    const route = message.route || client.route || '/';
    
    const routeConfig = this.getRouteConfig(route);
    if (!routeConfig) {
      this.sendToClient(client, {
        type: 'error',
        error: 'No route configuration found',
      });
      return;
    }

    // Process and store the log message
    this.processLogMessage(routeConfig, logMessage, client);

    // Broadcast to subscribed clients
    this.broadcastLogMessage(logMessage, route);

    // Send acknowledgment
    this.sendToClient(client, {
      type: 'status',
      status: 'ok',
      id: message.id,
    });
  }

  private handleTraceMessage(client: ClientConnection, message: ClientMessage): void {
    const traceEntry = message.data as TraceEntry;
    const route = message.route || client.route || '/trace';
    
    const routeConfig = this.getRouteConfig(route);
    if (!routeConfig) {
      this.sendToClient(client, {
        type: 'error',
        error: 'No route configuration found',
      });
      return;
    }

    // Process and store the trace entry
    this.processTraceEntry(routeConfig, traceEntry, client);

    // Broadcast to subscribed clients
    this.broadcastTraceEntry(traceEntry, route);

    // Send acknowledgment
    this.sendToClient(client, {
      type: 'status',
      status: 'ok',
      id: message.id,
    });
  }

  private handleSubscription(client: ClientConnection, message: ClientMessage): void {
    const route = message.route || '/';
    if (!client.info.subscriptions.includes(route)) {
      client.info.subscriptions.push(route);
    }
    
    if (message.filters) {
      client.info.filters = message.filters;
    }

    client.route = route;

    this.sendToClient(client, {
      type: 'status',
      status: 'subscribed',
      data: { route, filters: client.info.filters },
    });

    console.log(`Client ${client.id} subscribed to ${route}`);
  }

  private handleUnsubscription(client: ClientConnection, message: ClientMessage): void {
    const route = message.route || '/';
    const index = client.info.subscriptions.indexOf(route);
    if (index > -1) {
      client.info.subscriptions.splice(index, 1);
    }

    this.sendToClient(client, {
      type: 'status',
      status: 'unsubscribed',
      data: { route },
    });

    console.log(`Client ${client.id} unsubscribed from ${route}`);
  }

  private processLogMessage(routeConfig: RouteConfig, logMessage: LogMessage, client: ClientConnection): void {
    let logEntry: any;

    if (routeConfig.capture === 'payloadOnly') {
      logEntry = {
        timestamp: new Date().toISOString(),
        data: logMessage,
      };
    } else if (routeConfig.capture === 'bodyOnly') {
      logEntry = logMessage;
    } else {
      logEntry = {
        timestamp: new Date().toISOString(),
        clientId: client.id,
        route: client.route,
        type: 'log',
        data: logMessage,
      };
    }

    this.writeToOutput(routeConfig, logEntry);
  }

  private processTraceEntry(routeConfig: RouteConfig, traceEntry: TraceEntry, client: ClientConnection): void {
    let logEntry: any;

    if (routeConfig.capture === 'payloadOnly') {
      logEntry = {
        timestamp: new Date().toISOString(),
        data: traceEntry,
      };
    } else if (routeConfig.capture === 'bodyOnly') {
      logEntry = traceEntry;
    } else {
      logEntry = {
        timestamp: new Date().toISOString(),
        clientId: client.id,
        route: client.route,
        type: 'trace',
        data: traceEntry,
      };
    }

    this.writeToOutput(routeConfig, logEntry);
  }

  private writeToOutput(routeConfig: RouteConfig, logEntry: any): void {
    if (routeConfig.output === 'console') {
      if (typeof logEntry === 'string') {
        console.log(logEntry);
      } else {
        console.log(JSON.stringify(logEntry, null, 2));
      }
    } else {
      const logFile = path.resolve(routeConfig.output || './wslog-default.log');
      const content = JSON.stringify(logEntry) + '\n';
      
      try {
        fs.appendFileSync(logFile, content);
      } catch (error) {
        console.error(`Failed to write to log file ${logFile}:`, error);
      }
    }
  }

  private broadcastLogMessage(logMessage: LogMessage, route: string): void {
    const message: ServerMessage = {
      type: 'log',
      data: logMessage,
    };

    this.broadcastToSubscribers(message, route);
  }

  private broadcastTraceEntry(traceEntry: TraceEntry, route: string): void {
    const message: ServerMessage = {
      type: 'trace',
      data: traceEntry,
    };

    this.broadcastToSubscribers(message, route);
  }

  private broadcastToSubscribers(message: ServerMessage, route: string): void {
    this.clients.forEach((client) => {
      if (client.info.subscriptions.includes(route) && this.shouldSendToClient(client, message)) {
        this.sendToClient(client, message);
      }
    });
  }

  private shouldSendToClient(client: ClientConnection, message: ServerMessage): boolean {
    if (!client.info.filters) return true;

    const data = message.data as LogMessage | TraceEntry;
    
    // Filter by log levels
    if (client.info.filters.levels && client.info.filters.levels.length > 0) {
      if (!client.info.filters.levels.includes(data.level)) {
        return false;
      }
    }

    // Filter by sources
    if (client.info.filters.sources && client.info.filters.sources.length > 0) {
      if (!data.source || !client.info.filters.sources.includes(data.source)) {
        return false;
      }
    }

    // Filter by regex patterns
    if (client.info.filters.regexInclude && client.info.filters.regexInclude.length > 0) {
      const includeMatch = client.info.filters.regexInclude.some(pattern => {
        const regex = new RegExp(pattern);
        return regex.test(data.message);
      });
      if (!includeMatch) return false;
    }

    if (client.info.filters.regexExclude && client.info.filters.regexExclude.length > 0) {
      const excludeMatch = client.info.filters.regexExclude.some(pattern => {
        const regex = new RegExp(pattern);
        return regex.test(data.message);
      });
      if (excludeMatch) return false;
    }

    return true;
  }

  private sendToClient(client: ClientConnection, message: ServerMessage): void {
    if (client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error(`Failed to send message to client ${client.id}:`, error);
      }
    }
  }

  private getRouteConfig(route: string): RouteConfig | null {
    // Find the most specific matching route (longest prefix match)
    let match: RouteConfig | null = null;
    let maxLen = -1;
    
    for (const routeConfig of this.config.routes) {
      if (route.startsWith(routeConfig.route) && routeConfig.route.length > maxLen) {
        match = routeConfig;
        maxLen = routeConfig.route.length;
      }
    }

    return match;
  }

  private startHeartbeat(): void {
    setInterval(() => {
      this.clients.forEach((client) => {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.ping();
        }
      });
    }, this.config.heartbeatInterval);
  }

  private startStatsCollection(): void {
    setInterval(() => {
      this.updateStats();
    }, 1000);

    // Log stats every 30 seconds
    setInterval(() => {
      console.log(`Server Stats: ${this.stats.connections} connections, ${this.stats.totalMessages} total messages, ${this.stats.messagesPerSecond.toFixed(1)} msg/sec`);
    }, 30000);
  }

  private updateStats(): void {
    this.stats.uptime = Date.now() - this.startTime;
    this.stats.connections = this.clients.size;

    // Calculate messages per second
    this.messageHistory.push(this.messageCount);
    if (this.messageHistory.length > 60) {
      this.messageHistory.shift();
    }
    
    const messagesInLastMinute = this.messageHistory.reduce((sum, count) => sum + count, 0);
    this.stats.messagesPerSecond = messagesInLastMinute / Math.min(this.messageHistory.length, 60);

    // Update memory usage
    const memUsage = process.memoryUsage();
    this.stats.memoryUsage = {
      rss: memUsage.rss,
      heapTotal: memUsage.heapTotal,
      heapUsed: memUsage.heapUsed,
      external: memUsage.external,
    };

    this.messageCount = 0; // Reset for next interval
  }

  public getStats(): ServerStats {
    return { ...this.stats };
  }

  public getConnections(): ConnectionInfo[] {
    return Array.from(this.clients.values()).map(client => ({ ...client.info }));
  }

  public close(): void {
    this.wss.close();
    console.log('WSLog server closed');
  }
}
