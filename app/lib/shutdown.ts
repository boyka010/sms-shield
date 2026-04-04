import { PrismaClient } from '@prisma/client';
import { cache } from './database';

interface GracefulShutdownOptions {
  gracefulShutdownTimeout: number;
  drainInterval: number;
  onShutdown: () => Promise<void>;
  onDrain?: () => Promise<void>;
}

class GracefulShutdownManager {
  private isShuttingDown = false;
  private activeConnections = 0;
  private options: Required<GracefulShutdownOptions>;

  constructor(options: Partial<GracefulShutdownOptions> = {}) {
    this.options = {
      gracefulShutdownTimeout: options.gracefulShutdownTimeout ?? 30000,
      drainInterval: options.drainInterval ?? 1000,
      onShutdown: options.onShutdown ?? (async () => {}),
      onDrain: options.onDrain ?? (async () => {})
    };
  }

  registerConnection(): () => void {
    if (this.isShuttingDown) {
      throw new Error('Cannot register new connection during shutdown');
    }
    
    this.activeConnections++;
    
    return () => {
      this.activeConnections--;
    };
  }

  async beginShutdown(): Promise<void> {
    if (this.isShuttingDown) {
      console.log('[Shutdown] Shutdown already in progress');
      return;
    }

    this.isShuttingDown = true;
    console.log('[Shutdown] Initiating graceful shutdown...');
    console.log(`[Shutdown] Active connections: ${this.activeConnections}`);

    console.log('[Shutdown] Closing Redis connection...');
    try {
      await cache.quit();
    } catch (error) {
      console.error('[Shutdown] Error closing Redis:', error);
    }

    if (this.activeConnections === 0) {
      await this.completeShutdown();
      return;
    }

    const drainStartTime = Date.now();
    
    const drainInterval = setInterval(() => {
      const elapsed = Date.now() - drainStartTime;
      
      console.log(`[Shutdown] Waiting for ${this.activeConnections} connections... (${elapsed}ms)`);
      
      if (this.activeConnections === 0) {
        clearInterval(drainInterval);
        this.completeShutdown();
        return;
      }

      if (elapsed >= this.options.gracefulShutdownTimeout) {
        console.log('[Shutdown] Timeout reached, forcing shutdown...');
        clearInterval(drainInterval);
        this.completeShutdown();
        return;
      }
    }, this.options.drainInterval);
  }

  private async completeShutdown(): Promise<void> {
    console.log('[Shutdown] All connections drained, completing shutdown...');
    
    try {
      await this.options.onShutdown();
    } catch (error) {
      console.error('[Shutdown] Error in shutdown handler:', error);
    }

    console.log('[Shutdown] Process exiting...');
    process.exit(0);
  }

  isShuttingDownState(): boolean {
    return this.isShuttingDown;
  }

  getActiveConnections(): number {
    return this.activeConnections;
  }
}

const prisma = new PrismaClient();

const shutdownManager = new GracefulShutdownManager({
  gracefulShutdownTimeout: 30000,
  drainInterval: 1000,
  onShutdown: async () => {
    console.log('[Shutdown] Disconnecting Prisma...');
    await prisma.$disconnect();
    console.log('[Shutdown] Prisma disconnected');
  }
});

function registerProcessHandlers(): void {
  process.on('SIGTERM', async () => {
    console.log('[Shutdown] Received SIGTERM');
    await shutdownManager.beginShutdown();
  });

  process.on('SIGINT', async () => {
    console.log('[Shutdown] Received SIGINT');
    await shutdownManager.beginShutdown();
  });

  process.on('uncaughtException', (error) => {
    console.error('[Shutdown] Uncaught exception:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('[Shutdown] Unhandled rejection at:', promise, 'reason:', reason);
  });

  console.log('[Shutdown] Process handlers registered');
}

function createConnectionHandler(): () => void {
  return shutdownManager.registerConnection();
}

function createAsyncConnectionHandler(): () => Promise<void> {
  const release = shutdownManager.registerConnection();
  
  return async () => {
    release();
  };
}

export {
  GracefulShutdownManager,
  shutdownManager,
  registerProcessHandlers,
  createConnectionHandler,
  createAsyncConnectionHandler
};

export default shutdownManager;
