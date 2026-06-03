export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  ts: number;
  level: LogLevel;
  scope: string;
  message: string;
  data?: unknown;
}

const STORAGE_KEY = 'mochi_cast_debug_logs';
const MAX_BUFFER = 300;

let enabled = false;
const buffer: LogEntry[] = [];
let persistTimer: ReturnType<typeof setTimeout> | undefined;

export function setDebugEnabled(on: boolean): void {
  enabled = on;
  if (!on) return;
  log('system', 'debug logging enabled');
}

export function isDebugEnabled(): boolean {
  return enabled;
}

export function log(
  scope: string,
  message: string,
  data?: unknown,
  level: LogLevel = 'info',
): void {
  if (!enabled) return;

  const entry: LogEntry = {
    ts: Date.now(),
    level,
    scope,
    message,
    data: data === undefined ? undefined : sanitizeData(data),
  };

  buffer.push(entry);
  if (buffer.length > MAX_BUFFER) buffer.splice(0, buffer.length - MAX_BUFFER);

  const prefix = `[mochi-cast:${scope}]`;
  const payload = entry.data ?? '';
  switch (level) {
    case 'error':
      console.error(prefix, message, payload);
      break;
    case 'warn':
      console.warn(prefix, message, payload);
      break;
    case 'debug':
      console.debug(prefix, message, payload);
      break;
    default:
      console.log(prefix, message, payload);
  }

  schedulePersist();
}

export function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message?.trim();
    return msg || error.name || 'Unknown error';
  }
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    if (typeof record.message === 'string' && record.message.trim()) {
      return record.message.trim();
    }
    if (typeof record.error === 'string' && record.error.trim()) {
      return record.error.trim();
    }
    try {
      const json = JSON.stringify(error);
      if (json && json !== '{}') return json;
    } catch {
      /* ignore */
    }
  }
  return String(error);
}

export function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(formatUnknownError(error));
}

export function logError(scope: string, message: string, error: unknown, extra?: unknown): void {
  log(
    scope,
    message,
    {
      extra,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : formatUnknownError(error),
    },
    'error',
  );
}

function sanitizeData(data: unknown): unknown {
  if (data === null || typeof data !== 'object') return data;
  try {
    return JSON.parse(JSON.stringify(data));
  } catch {
    return String(data);
  }
}

function schedulePersist(): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = undefined;
    void chrome.storage.local.set({ [STORAGE_KEY]: buffer });
  }, 500);
}

export async function loadPersistedLogs(): Promise<LogEntry[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const stored = result[STORAGE_KEY] as LogEntry[] | undefined;
  if (stored?.length) {
    buffer.splice(0, buffer.length, ...stored.slice(-MAX_BUFFER));
  }
  return getLogBuffer();
}

export function getLogBuffer(): LogEntry[] {
  return [...buffer];
}

export function clearLogBuffer(): void {
  buffer.length = 0;
  void chrome.storage.local.remove(STORAGE_KEY);
}

/** Wrap fetch to log LAN probe results (timing, status, errors). */
export function createLoggingFetch(
  scope: string,
  baseFetch: typeof fetch = fetch,
): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const started = Date.now();
    try {
      const response = await baseFetch(input, init);
      if (!response.ok || Date.now() - started > 800) {
        log(scope, 'fetch', {
          url,
          ok: response.ok,
          status: response.status,
          ms: Date.now() - started,
        }, response.ok ? 'debug' : 'warn');
      }
      return response;
    } catch (error) {
      log(scope, 'fetch_failed', {
        url,
        ms: Date.now() - started,
        error: error instanceof Error ? error.message : String(error),
      }, 'warn');
      throw error;
    }
  };
}

export function formatLogLines(entries: LogEntry[]): string {
  return entries
    .map((e) => {
      const time = new Date(e.ts).toISOString().slice(11, 23);
      const data = e.data !== undefined ? ` ${JSON.stringify(e.data)}` : '';
      return `${time} [${e.level}] ${e.scope}: ${e.message}${data}`;
    })
    .join('\n');
}
