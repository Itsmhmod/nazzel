/**
 * @fileoverview Structured logger for Nazzel.
 *
 * All production code must use this logger, never console.log.
 * In --no-tui mode, log level 'info' and above goes to stderr (not stdout).
 * In TUI mode, logs are buffered and displayed in the diagnostics screen.
 *
 * Output is newline-delimited JSON for structured parsing.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface ILogEntry {
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly message: string;
  readonly context?: Readonly<Record<string, unknown>>;
}

export interface ILogger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  child(context: Record<string, unknown>): ILogger;
}

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger implements ILogger {
  private readonly baseContext: Record<string, unknown>;
  private readonly minLevel: LogLevel;
  private readonly sink: (entry: ILogEntry) => void;

  constructor(
    minLevel: LogLevel,
    sink: (entry: ILogEntry) => void,
    baseContext: Record<string, unknown> = {},
  ) {
    this.minLevel = minLevel;
    this.sink = sink;
    this.baseContext = baseContext;
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.write('debug', message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.write('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.write('warn', message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.write('error', message, context);
  }

  child(context: Record<string, unknown>): ILogger {
    return new Logger(this.minLevel, this.sink, { ...this.baseContext, ...context });
  }

  private write(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (LOG_LEVEL_ORDER[level] < LOG_LEVEL_ORDER[this.minLevel]) {
      return;
    }
    const hasContext =
      Object.keys(this.baseContext).length > 0 ||
      (context !== undefined && Object.keys(context).length > 0);
    const mergedContext = hasContext ? { ...this.baseContext, ...context } : undefined;
    const entry: ILogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(mergedContext !== undefined ? { context: mergedContext } : {}),
    };
    this.sink(entry);
  }
}

/** Sink that writes JSON log lines to stderr. Used in non-TUI mode. */
function stderrSink(entry: ILogEntry): void {
  process.stderr.write(JSON.stringify(entry) + '\n');
}

/** Sink that discards all log output. Used in TUI mode (TUI manages its own display). */
function nullSink(_entry: ILogEntry): void {
  // intentionally empty
}

let _logger: ILogger | null = null;

/**
 * Initialize the global logger. Must be called once at startup.
 */
export function initLogger(options: { level: LogLevel; tui: boolean }): void {
  const sink = options.tui ? nullSink : stderrSink;
  _logger = new Logger(options.level, sink);
}

/**
 * Get the global logger instance.
 * Throws if initLogger has not been called.
 */
export function getLogger(): ILogger {
  if (_logger === null) {
    throw new Error('Logger not initialized. Call initLogger() first.');
  }
  return _logger;
}

/**
 * Create a no-op logger for tests.
 */
export function createNullLogger(): ILogger {
  return new Logger('error', nullSink);
}
