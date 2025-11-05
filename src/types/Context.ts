import type { Logger } from "./Logger";

export type Context = {
  logger: Logger;
};

export const createContext = (): Context => {
  return {
    logger: {
      log: (...args: unknown[]) => console.log(...args),
    },
  };
};
