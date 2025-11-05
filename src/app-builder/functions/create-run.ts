import type { Message } from "amqplib";
import type { AppState } from "../types/AppState";

export const createRun = (
  wrappedHandler: (message: Message | null) => Promise<void>,
  state: AppState,
  queueName: string,
) => {
  return async () => {
    const consumeResult = await state.channel.consume(queueName, wrappedHandler);
    state.consumerTag = consumeResult.consumerTag;
    console.log(`Listening on queue: ${queueName}`);
  };
};
