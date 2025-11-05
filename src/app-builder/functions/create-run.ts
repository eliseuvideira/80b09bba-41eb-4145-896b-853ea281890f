import type { Message } from "amqplib";
import type { Logger } from "../../types/Logger";
import type { AppState } from "../types/AppState";

export const createRun = (
  wrappedHandler: (message: Message | null) => Promise<void>,
  state: AppState,
  queueName: string,
  logger: Logger,
) => {
  return async () => {
    const consumeResult = await state.channel.consume(queueName, wrappedHandler);
    state.consumerTag = consumeResult.consumerTag;
    logger.info("Listening on queue", { queue: queueName });
  };
};
