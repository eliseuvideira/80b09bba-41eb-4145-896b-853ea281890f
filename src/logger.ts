import pino from "pino";
import type { Logger as LoggerType } from "./types/Logger";

type LogFn = (msg: string, data?: Record<string, unknown>) => void;

const wrapLogger = (pinoLogger: pino.Logger): LoggerType => {
  const createLogFn = (level: pino.Level): LogFn => {
    return (msg: string, data?: Record<string, unknown>) => {
      if (!data) {
        pinoLogger[level](msg);
        return;
      }

      const transformedData = { ...data };
      if ("error" in transformedData) {
        transformedData.err = transformedData.error;
        delete transformedData.error;
      }

      pinoLogger[level](transformedData, msg);
    };
  };

  return {
    info: createLogFn("info"),
    warn: createLogFn("warn"),
    error: createLogFn("error"),
    fatal: createLogFn("fatal"),
    debug: createLogFn("debug"),
    trace: createLogFn("trace"),
    child: (bindings: Record<string, unknown>) => {
      return wrapLogger(pinoLogger.child(bindings));
    },
  };
};

const build = async (env: Record<string, unknown>): Promise<LoggerType> => {
  const pinoLogger = pino(
    env.NODE_ENV === "development"
      ? {
          transport: {
            target: "pino-pretty",
          },
        }
      : {},
  );

  return wrapLogger(pinoLogger);
};

export const Logger = {
  build,
};
