/**
 * Cross-platform async context management
 * Provides unified interface for Node.js AsyncLocalStorage and Browser AsyncContext
 */

interface IContextVariable<T> {
  run<R>(value: T, callback: () => R): R;
  get(): T | undefined;
}

class NodeContextVariable<T> implements IContextVariable<T> {
  private storage: any;

  constructor() {
    // Dynamic import to avoid issues in browser environments
    try {
      const { AsyncLocalStorage } = require('async_hooks');
      this.storage = new AsyncLocalStorage();
    } catch (error) {
      throw new Error('AsyncLocalStorage not available in this environment');
    }
  }

  run<R>(value: T, callback: () => R): R {
    return this.storage.run(value, callback);
  }

  get(): T | undefined {
    return this.storage.getStore();
  }
}

class BrowserContextVariable<T> implements IContextVariable<T> {
  private variable: any;

  constructor() {
    try {
      // Check if AsyncContext is available (requires polyfill in most browsers)
      if (typeof (globalThis as any).AsyncContext !== 'undefined') {
        this.variable = new (globalThis as any).AsyncContext.Variable();
      } else {
        // Fallback to a simple context tracking mechanism
        this.variable = new FallbackContextVariable<T>();
      }
    } catch (error) {
      this.variable = new FallbackContextVariable<T>();
    }
  }

  run<R>(value: T, callback: () => R): R {
    return this.variable.run(value, callback);
  }

  get(): T | undefined {
    return this.variable.get();
  }
}

/**
 * Fallback context variable for environments without AsyncContext support
 * Uses a simple stack-based approach (not truly async-safe but better than nothing)
 */
class FallbackContextVariable<T> implements IContextVariable<T> {
  private contextStack: T[] = [];

  run<R>(value: T, callback: () => R): R {
    this.contextStack.push(value);
    try {
      return callback();
    } finally {
      this.contextStack.pop();
    }
  }

  get(): T | undefined {
    return this.contextStack[this.contextStack.length - 1];
  }
}

/**
 * Creates a new context variable that works across Node.js and Browser environments
 */
export function createContext<T>(): IContextVariable<T> {
  const isNode = typeof process !== 'undefined' && process.versions?.node;
  
  if (isNode) {
    try {
      return new NodeContextVariable<T>();
    } catch (error) {
      console.warn('Failed to create Node.js context, falling back to browser implementation');
      return new BrowserContextVariable<T>();
    }
  } else {
    return new BrowserContextVariable<T>();
  }
}

// Export the interface for type checking
export type { IContextVariable };
