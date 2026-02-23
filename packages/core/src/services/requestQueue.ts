const DEFAULT_MIN_INTERVAL_MS = 1000;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export class RateLimitedQueue {
  private readonly minIntervalMs: number;
  private tail: Promise<void> = Promise.resolve();
  private nextAllowedAt = 0;

  constructor(minIntervalMs = DEFAULT_MIN_INTERVAL_MS) {
    this.minIntervalMs = minIntervalMs;
  }

  enqueue<T>(task: () => Promise<T>): Promise<T> {
    const runTask = async () => {
      const now = Date.now();
      const waitMs = Math.max(0, this.nextAllowedAt - now);
      if (waitMs > 0) {
        await sleep(waitMs);
      }
      this.nextAllowedAt = Date.now() + this.minIntervalMs;
      return task();
    };

    const result = this.tail.then(runTask, runTask);
    this.tail = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }
}

const globalQueues = new Map<string, RateLimitedQueue>();

export function getGlobalRateLimitedQueue(name: string, minIntervalMs = DEFAULT_MIN_INTERVAL_MS) {
  const existing = globalQueues.get(name);
  if (existing) return existing;
  const queue = new RateLimitedQueue(minIntervalMs);
  globalQueues.set(name, queue);
  return queue;
}

export interface QueuedJsonRequestOptions {
  method?: 'GET' | 'POST';
  headers?: HeadersInit;
  body?: BodyInit | null;
  signal?: AbortSignal;
  maxRetries?: number;
  baseBackoffMs?: number;
  parseAs?: 'json' | 'text';
}

function shouldRetry(status: number) {
  return status === 429 || status >= 500;
}

function retryDelayMs(response: Response, attempt: number, baseBackoffMs: number) {
  const retryAfter = response.headers.get('Retry-After');
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (!Number.isNaN(seconds) && seconds >= 0) {
      return Math.ceil(seconds * 1000);
    }
    const dateMs = Date.parse(retryAfter);
    if (!Number.isNaN(dateMs)) {
      return Math.max(0, dateMs - Date.now());
    }
  }
  return Math.min(8000, baseBackoffMs * 2 ** attempt);
}

export async function queuedRequest(
  queue: RateLimitedQueue,
  url: string,
  options: QueuedJsonRequestOptions = {}
): Promise<Response> {
  const {
    method = 'GET',
    headers,
    body = null,
    signal,
    maxRetries = 2,
    baseBackoffMs = 500,
  } = options;

  let attempt = 0;
  let lastError: unknown;

  while (attempt <= maxRetries) {
    try {
      const response = await queue.enqueue(() =>
        fetch(url, {
          method,
          headers,
          body,
          signal,
        })
      );

      if (!response.ok && shouldRetry(response.status) && attempt < maxRetries) {
        const delayMs = retryDelayMs(response, attempt, baseBackoffMs);
        await sleep(delayMs);
        attempt += 1;
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;
      if (attempt >= maxRetries) break;
      await sleep(Math.min(8000, baseBackoffMs * 2 ** attempt));
      attempt += 1;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Request failed');
}

export async function queuedJson<T>(
  queue: RateLimitedQueue,
  url: string,
  options: QueuedJsonRequestOptions = {}
): Promise<T> {
  const response = await queuedRequest(queue, url, options);
  if (!response.ok) {
    const message = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status}: ${message || response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export async function queuedText(
  queue: RateLimitedQueue,
  url: string,
  options: QueuedJsonRequestOptions = {}
): Promise<string> {
  const response = await queuedRequest(queue, url, options);
  if (!response.ok) {
    const message = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status}: ${message || response.statusText}`);
  }
  return response.text();
}
