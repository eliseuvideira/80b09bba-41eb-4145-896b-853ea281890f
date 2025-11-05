import { sleep } from "./functions/sleep";
import type { Context } from "./types/Context";

export const handler = async (
  content: unknown,
  ctx: Context,
): Promise<unknown> => {
  ctx.logger.log("Processing message (1s delay)...");
  await sleep(1000);

  return content;
};
