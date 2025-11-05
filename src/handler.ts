import { sleep } from "./functions/sleep";

export type MessageContext = {
  logger: {
    log: (...args: unknown[]) => void;
  };
};

export type MessageHandler = (
  content: unknown,
  ctx: MessageContext,
) => Promise<unknown>;

export const handler: MessageHandler = async (content, ctx) => {
  ctx.logger.log("Processing message (1s delay)...");
  await sleep(1000);

  return content;
};
