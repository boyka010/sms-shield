import { createClient, RedisClientType } from 'ioredis';

const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redis.on('error', (err) => console.error('[CircuitBreaker] Redis error:', err));

interface CircuitState {
  failures: number;
  lastFailure: number;
  nextAttempt: number;
  status: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

interface CircuitConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  halfOpenAttempts: number;
}

const DEFAULT_CONFIG: CircuitConfig = {
  failureThreshold: 5,
  recoveryTimeout: 30000,
  halfOpenAttempts: 3
};

class CircuitBreaker {
  private circuitKey: string;
  private config: CircuitConfig;
  private state: CircuitState = {
    failures: 0,
    lastFailure: 0,
    nextAttempt: 0,
    status: 'CLOSED'
  };

  constructor(
    private serviceName: string,
    config: Partial<CircuitConfig> = {}
  ) {
    this.circuitKey = `circuit:${serviceName}`;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async isAvailable(): Promise<boolean> {
    const now = Date.now();
    const key = `${this.circuitKey}:state`;

    const cached = await redis.get(key);
    if (cached) {
      this.state = JSON.parse(cached);
    }

    if (this.state.status === 'CLOSED') {
      return true;
    }

    if (this.state.status === 'OPEN') {
      if (now >= this.state.nextAttempt) {
        this.state.status = 'HALF_OPEN';
        this.state.failures = 0;
        await this.persistState();
        return true;
      }
      return false;
    }

    if (this.state.status === 'HALF_OPEN') {
      return true;
    }

    return true;
  }

  async recordSuccess(): Promise<void> {
    if (this.state.status === 'HALF_OPEN') {
      this.state.status = 'CLOSED';
      this.state.failures = 0;
      this.state.nextAttempt = 0;
      console.log(`[CircuitBreaker] ${this.serviceName} circuit CLOSED`);
    }
    
    this.state.failures = Math.max(0, this.state.failures - 1);
    await this.persistState();
  }

  async recordFailure(error?: Error): Promise<void> {
    const now = Date.now();
    this.state.failures++;
    this.state.lastFailure = now;

    console.warn(`[CircuitBreaker] ${this.serviceName} failure #${this.state.failures}:`, error?.message);

    if (this.state.status === 'HALF_OPEN') {
      this.state.status = 'OPEN';
      this.state.nextAttempt = now + this.config.recoveryTimeout;
      console.error(`[CircuitBreaker] ${this.serviceName} circuit OPEN after half-open failure`);
    } else if (this.state.failures >= this.config.failureThreshold) {
      this.state.status = 'OPEN';
      this.state.nextAttempt = now + this.config.recoveryTimeout;
      console.error(`[CircuitBreaker] ${this.serviceName} circuit OPEN after ${this.state.failures} failures`);
    }

    await this.persistState();
  }

  getStatus(): CircuitState {
    return { ...this.state };
  }

  async reset(): Promise<void> {
    this.state = {
      failures: 0,
      lastFailure: 0,
      nextAttempt: 0,
      status: 'CLOSED'
    };
    await redis.del(this.circuitKey);
    await redis.del(`${this.circuitKey}:state`);
    console.log(`[CircuitBreaker] ${this.serviceName} circuit RESET`);
  }

  private async persistState(): Promise<void> {
    await redis.set(
      `${this.circuitKey}:state`,
      JSON.stringify(this.state),
      'EX',
      3600
    );
  }
}

const smsMisrBreaker = new CircuitBreaker('sms-misr', {
  failureThreshold: 5,
  recoveryTimeout: 30000
});

const victoryLinkBreaker = new CircuitBreaker('victory-link', {
  failureThreshold: 5,
  recoveryTimeout: 30000
});

const weApiBreaker = new CircuitBreaker('we-api', {
  failureThreshold: 5,
  recoveryTimeout: 30000
});

export const circuitBreakers = {
  'SMS_MISR': smsMisrBreaker,
  'VICTORY_LINK': victoryLinkBreaker,
  'WE_API': weApiBreaker
};

export async function getAvailableGateway(): Promise<string | null> {
  const gateways = ['SMS_MISR', 'VICTORY_LINK', 'WE_API'];
  
  for (const name of gateways) {
    const breaker = circuitBreakers[name];
    if (await breaker.isAvailable()) {
      return name;
    }
  }

  console.error('[CircuitBreaker] No gateways available');
  return null;
}

export async function recordGatewaySuccess(gateway: string): Promise<void> {
  const breaker = circuitBreakers[gateway];
  if (breaker) {
    await breaker.recordSuccess();
  }
}

export async function recordGatewayFailure(gateway: string, error?: Error): Promise<void> {
  const breaker = circuitBreakers[gateway];
  if (breaker) {
    await breaker.recordFailure(error);
  }
}

export { CircuitBreaker, redis };
