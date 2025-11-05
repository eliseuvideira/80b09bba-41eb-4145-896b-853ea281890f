type LogFn = (msg: string, data?: Record<string, unknown>) => void;

export type Logger = {
  info: LogFn;
  warn: LogFn;
  error: LogFn;
  fatal: LogFn;
  debug: LogFn;
  trace: LogFn;
  child: (bindings: Record<string, unknown>) => Logger;
};
