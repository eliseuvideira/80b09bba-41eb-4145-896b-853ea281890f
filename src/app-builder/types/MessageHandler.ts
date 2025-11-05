import type { Logger } from "../../types/Logger";

export type MessageHandler<
  Context extends { logger: Logger } = { logger: Logger },
> = (content: unknown, ctx: Context) => Promise<unknown>;
