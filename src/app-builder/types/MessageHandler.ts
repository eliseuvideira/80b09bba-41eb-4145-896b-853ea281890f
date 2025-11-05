export type MessageContext = {
  logger: {
    log: (...args: unknown[]) => void;
  };
};

export type MessageHandler = (
  content: unknown,
  ctx: MessageContext,
) => Promise<unknown>;
