import amqplib from "amqplib";
import type { Config } from "../config";
import type { Logger } from "../types/Logger";
import { createRun } from "./functions/create-run";
import { createStop } from "./functions/create-stop";
import { withMessageHandling } from "./functions/with-message-handling";
import type { App } from "./types/App";
import type { AppState } from "./types/AppState";
import type { MessageHandler } from "./types/MessageHandler";

export const AppBuilder = <Context extends { logger: Logger }>(
  define: (config: Config) => {
    queue: string;
    handler: MessageHandler<Context>;
  },
) => {
  return {
    async build(config: Config, logger: Logger): Promise<App> {
      const { queue, handler } = define(config);

      const connection = await amqplib.connect(config.RABBITMQ_URL);
      const channel = await connection.createChannel();
      await channel.assertQueue(queue, { durable: true });

      const state: AppState = {
        channel,
        connection,
        consumerTag: null,
        isShuttingDown: false,
        inFlightMessages: 0,
      };

      const wrappedHandler = withMessageHandling(handler, logger, state);

      return {
        run: createRun(wrappedHandler, state, queue, logger),
        stop: createStop(state, logger),
      };
    },
  };
};
