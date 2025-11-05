import { sleep } from "./functions/sleep";

export const handler = async (
  content: unknown,
  ctx: { logger: { log: (...args: unknown[]) => void } },
): Promise<unknown> => {
  ctx.logger.log("Processing message (1s delay)...");
  await sleep(1000);

  return content;
};
