// ─────────────────────────────────────────────────────────────────────────────
// SMS-Shield Queue System — Registry, Types & InMemoryQueue Implementation
// ─────────────────────────────────────────────────────────────────────────────

// ── Types ────────────────────────────────────────────────────────────────────

export type QueueName =
  | 'sms-send'
  | 'webhook-process'
  | 'rfm-calculate'
  | 'cart-abandonment-check'
  | 'campaign-send';

export interface QueueJob<T = unknown> {
  id: string;
  queue: QueueName;
  data: T;
  attempts: number;
  maxAttempts: number;
  priority: number; // 1-10, lower = higher priority
  createdAt: Date;
  scheduledFor?: Date;
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
  startedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  lastError?: string;
}

export interface QueueProcessor<T = unknown> {
  (job: QueueJob<T>): Promise<void>;
}

export interface QueueOptions {
  maxRetries?: number;
  retryDelay?: number; // ms — exponential backoff base
  concurrency?: number;
  removeOnComplete?: number; // keep last N completed jobs
  removeOnFail?: number; // keep last N failed jobs
}

export interface QueueStats {
  name: QueueName;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function clampPriority(p: number): number {
  return Math.max(1, Math.min(10, Math.round(p)));
}

/** Exponential backoff with jitter: base * 2^attempt + random jitter */
function calculateBackoff(baseMs: number, attempt: number): number {
  const exponential = baseMs * Math.pow(2, attempt);
  const jitter = Math.random() * baseMs * 0.5;
  return Math.min(exponential + jitter, 5 * 60 * 1000); // cap at 5 min
}

// ── InMemoryQueue ────────────────────────────────────────────────────────────

export class InMemoryQueue<T = unknown> {
  private jobs: Map<string, QueueJob<T>> = new Map();
  private waitingHeap: QueueJob<T>[] = [];
  private activeSet: Set<string> = new Set();
  private processor: QueueProcessor<T> | null = null;
  private concurrency: number;
  private maxRetries: number;
  private retryDelay: number;
  private removeOnComplete: number;
  private removeOnFail: number;
  private completedHistory: QueueJob<T>[] = [];
  private failedHistory: QueueJob<T>[] = [];
  private processing = false;
  private drainResolve: (() => void) | null = null;

  constructor(
    public readonly name: QueueName,
    options: QueueOptions = {},
  ) {
    this.concurrency = options.concurrency ?? 5;
    this.maxRetries = options.maxRetries ?? 3;
    this.retryDelay = options.retryDelay ?? 1000;
    this.removeOnComplete = options.removeOnComplete ?? 100;
    this.removeOnFail = options.removeOnFail ?? 50;
  }

  // ── Processor registration ────────────────────────────────────────────

  register(processor: QueueProcessor<T>): void {
    this.processor = processor;
    // Start the processing loop when a processor is registered
    void this.processLoop();
  }

  // ── Job lifecycle ────────────────────────────────────────────────────

  add(data: T, options?: { priority?: number; delayMs?: number; jobId?: string; maxAttempts?: number }): QueueJob<T> {
    const id = options?.jobId ?? generateJobId();
    const now = new Date();
    const job: QueueJob<T> = {
      id,
      queue: this.name,
      data,
      attempts: 0,
      maxAttempts: options?.maxAttempts ?? this.maxRetries + 1,
      priority: clampPriority(options?.priority ?? 5),
      createdAt: now,
      scheduledFor: options?.delayMs ? new Date(now.getTime() + options.delayMs) : undefined,
      status: options?.delayMs ? 'delayed' : 'waiting',
    };

    this.jobs.set(id, job);

    if (job.status === 'delayed') {
      // Schedule promotion to waiting when delay expires
      const delayUntil = job.scheduledFor!.getTime() - Date.now();
      setTimeout(() => this.promoteDelayedJob(id), Math.max(delayUntil, 0));
    } else {
      this.insertByPriority(this.waitingHeap, job);
      void this.processLoop();
    }

    return job;
  }

  async addAndWait(
    data: T,
    options?: { priority?: number; delayMs?: number; jobId?: string; maxAttempts?: number; timeoutMs?: number },
  ): Promise<QueueJob<T>> {
    const job = this.add(data, options);
    const timeoutMs = options?.timeoutMs ?? 30_000;
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        if (elapsed > timeoutMs) {
          clearInterval(interval);
          reject(new Error(`Job ${job.id} timed out after ${timeoutMs}ms`));
          return;
        }
        const current = this.jobs.get(job.id);
        if (current && (current.status === 'completed' || current.status === 'failed')) {
          clearInterval(interval);
          resolve(current);
        }
      }, 100);
    });
  }

  private promoteDelayedJob(id: string): void {
    const job = this.jobs.get(id);
    if (!job || job.status !== 'delayed') return;
    if (new Date() < job.scheduledFor!) return; // not yet

    job.status = 'waiting';
    this.insertByPriority(this.waitingHeap, job);
    void this.processLoop();
  }

  /** Binary-insert into sorted array (ascending priority, then FIFO). */
  private insertByPriority(heap: QueueJob<T>[], job: QueueJob<T>): void {
    let lo = 0;
    let hi = heap.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (heap[mid].priority < job.priority) {
        lo = mid + 1;
      } else if (heap[mid].priority > job.priority) {
        hi = mid;
      } else {
        // Same priority — FIFO: earlier createdAt goes first
        if (heap[mid].createdAt < job.createdAt) {
          lo = mid + 1;
        } else {
          hi = mid;
        }
      }
    }
    heap.splice(lo, 0, job);
  }

  // ── Processing loop ──────────────────────────────────────────────────

  private async processLoop(): Promise<void> {
    if (!this.processor) return;
    if (this.processing) return;
    if (this.waitingHeap.length === 0 && this.activeSet.size === 0) {
      if (this.drainResolve) {
        this.drainResolve();
        this.drainResolve = null;
      }
      return;
    }

    this.processing = true;

    while (this.waitingHeap.length > 0 && this.activeSet.size < this.concurrency) {
      const job = this.waitingHeap.shift()!;
      if (this.jobs.get(job.id)?.status !== 'waiting') continue;

      job.status = 'active';
      job.startedAt = new Date();
      this.activeSet.add(job.id);
      this.jobs.set(job.id, job);

      // Fire-and-forget — errors are handled inside processJob
      void this.processJob(job).catch(() => { /* logged inside */ });
    }

    // If we still have capacity, we might get new jobs later.
    // We reset processing flag and let the next add() re-trigger.
    this.processing = false;

    // Check if we should resolve drain waiters
    if (this.waitingHeap.length === 0 && this.activeSet.size === 0) {
      if (this.drainResolve) {
        this.drainResolve();
        this.drainResolve = null;
      }
    }
  }

  private async processJob(job: QueueJob<T>): Promise<void> {
    try {
      await this.processor!(job);

      // Success
      job.status = 'completed';
      job.completedAt = new Date();
      this.jobs.set(job.id, job);

      // Track in history
      this.completedHistory.unshift(job);
      if (this.completedHistory.length > this.removeOnComplete) {
        const removed = this.completedHistory.splice(this.removeOnComplete);
        for (const r of removed) this.jobs.delete(r.id);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      job.attempts += 1;
      job.lastError = errorMessage;

      if (job.attempts < job.maxAttempts) {
        // Retryable — schedule with backoff
        const backoff = calculateBackoff(this.retryDelay, job.attempts - 1);
        job.status = 'delayed';
        job.scheduledFor = new Date(Date.now() + backoff);
        this.jobs.set(job.id, job);

        setTimeout(() => this.promoteDelayedJob(job.id), backoff);
      } else {
        // Final failure
        job.status = 'failed';
        job.failedAt = new Date();
        this.jobs.set(job.id, job);

        this.failedHistory.unshift(job);
        if (this.failedHistory.length > this.removeOnFail) {
          const removed = this.failedHistory.splice(this.removeOnFail);
          for (const r of removed) this.jobs.delete(r.id);
        }
      }
    } finally {
      this.activeSet.delete(job.id);
      // Attempt to process next job
      void this.processLoop();
    }
  }

  // ── Query / control ──────────────────────────────────────────────────

  getJob(id: string): QueueJob<T> | undefined {
    return this.jobs.get(id);
  }

  getStats(): QueueStats {
    let waiting = 0;
    let active = 0;
    let completed = 0;
    let failed = 0;
    let delayed = 0;

    for (const job of this.jobs.values()) {
      switch (job.status) {
        case 'waiting':
          waiting++;
          break;
        case 'active':
          active++;
          break;
        case 'completed':
          completed++;
          break;
        case 'failed':
          failed++;
          break;
        case 'delayed':
          delayed++;
          break;
      }
    }

    return { name: this.name, waiting, active, completed, failed, delayed };
  }

  async pause(): Promise<void> {
    this.processing = false;
  }

  async resume(): Promise<void> {
    void this.processLoop();
  }

  async drain(timeoutMs = 30_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (this.waitingHeap.length === 0 && this.activeSet.size === 0) return;
      await new Promise<void>((resolve) => {
        const remaining = deadline - Date.now();
        if (remaining <= 0) {
          resolve();
          return;
        }
        this.drainResolve = resolve;
        setTimeout(resolve, Math.min(remaining, 500));
      });
    }
    throw new Error(`Queue ${this.name} drain timed out after ${timeoutMs}ms`);
  }

  async clear(): Promise<void> {
    this.waitingHeap = [];
    // Remove all non-active jobs
    for (const [id, job] of this.jobs.entries()) {
      if (job.status !== 'active') {
        this.jobs.delete(id);
      }
    }
    this.completedHistory = [];
    this.failedHistory = [];
  }

  async remove(id: string): Promise<boolean> {
    const job = this.jobs.get(id);
    if (!job) return false;
    if (job.status === 'active') return false; // can't remove active jobs

    // Remove from waiting heap
    const idx = this.waitingHeap.findIndex((j) => j.id === id);
    if (idx !== -1) this.waitingHeap.splice(idx, 1);

    this.jobs.delete(id);
    return true;
  }

  getWaitingCount(): number {
    return this.waitingHeap.length;
  }

  getActiveCount(): number {
    return this.activeSet.size;
  }

  isEmpty(): boolean {
    return this.waitingHeap.length === 0 && this.activeSet.size === 0;
  }
}

// ── Queue Registry ──────────────────────────────────────────────────────────

const ALL_QUEUE_NAMES: QueueName[] = [
  'sms-send',
  'webhook-process',
  'rfm-calculate',
  'cart-abandonment-check',
  'campaign-send',
];

export class QueueRegistry {
  private queues: Map<QueueName, InMemoryQueue> = new Map();
  private static instance: QueueRegistry | null = null;

  private constructor() {
    for (const name of ALL_QUEUE_NAMES) {
      const defaultOptions: QueueOptions = {
        concurrency: 5,
        maxRetries: 3,
        retryDelay: 1000,
        removeOnComplete: 100,
        removeOnFail: 50,
      };

      // Tune per-queue defaults
      switch (name) {
        case 'sms-send':
          defaultOptions.concurrency = 10;
          defaultOptions.retryDelay = 2000;
          break;
        case 'webhook-process':
          defaultOptions.concurrency = 20;
          defaultOptions.retryDelay = 500;
          break;
        case 'rfm-calculate':
          defaultOptions.concurrency = 2;
          defaultOptions.retryDelay = 5000;
          break;
        case 'cart-abandonment-check':
          defaultOptions.concurrency = 5;
          defaultOptions.retryDelay = 3000;
          break;
        case 'campaign-send':
          defaultOptions.concurrency = 10;
          defaultOptions.retryDelay = 2000;
          break;
      }

      this.queues.set(name, new InMemoryQueue(name, defaultOptions));
    }
  }

  static getInstance(): QueueRegistry {
    if (!QueueRegistry.instance) {
      QueueRegistry.instance = new QueueRegistry();
    }
    return QueueRegistry.instance;
  }

  getQueue<T = unknown>(name: QueueName): InMemoryQueue<T> {
    const queue = this.queues.get(name);
    if (!queue) {
      throw new Error(`Queue "${name}" not registered. Available: ${ALL_QUEUE_NAMES.join(', ')}`);
    }
    return queue as InMemoryQueue<T>;
  }

  getAllQueues(): Map<QueueName, InMemoryQueue> {
    return new Map(this.queues);
  }

  getAllStats(): QueueStats[] {
    const stats: QueueStats[] = [];
    for (const queue of this.queues.values()) {
      stats.push(queue.getStats());
    }
    return stats;
  }

  async pauseAll(): Promise<void> {
    for (const queue of this.queues.values()) {
      await queue.pause();
    }
  }

  async resumeAll(): Promise<void> {
    for (const queue of this.queues.values()) {
      await queue.resume();
    }
  }

  async drainAll(timeoutMs?: number): Promise<void> {
    await Promise.all(
      Array.from(this.queues.values()).map((q) => q.drain(timeoutMs)),
    );
  }

  async clearAll(): Promise<void> {
    for (const queue of this.queues.values()) {
      await queue.clear();
    }
  }
}

// ── Singleton export ────────────────────────────────────────────────────────

export const queueRegistry = QueueRegistry.getInstance();

// ── Convenience ─────────────────────────────────────────────────────────────

export function getQueue<T = unknown>(name: QueueName): InMemoryQueue<T> {
  return queueRegistry.getQueue<T>(name);
}
