import type { Channel, ChannelModel, Message } from "amqplib";
import amqplib from "amqplib";
import type { Config } from "./config";
import { noop } from "./functions/noop";
import { sleep } from "./functions/sleep";
import { handler, type MessageContext, type MessageHandler } from "./handler";

type App = {
  run: () => Promise<void>;
  stop: () => Promise<void>;
};

type SuccessReply = {
  status: "success";
  data: unknown;
  processedAt: string;
};

type ErrorReply = {
  status: "error";
  error: {
    message: string;
    type: string;
  };
  processedAt: string;
};

type AppState = {
  channel: Channel;
  connection: ChannelModel;
  consumerTag: string | null;
  isShuttingDown: boolean;
  inFlightMessages: number;
};

const withMessageHandling = (handler: MessageHandler, state: AppState) => {
  return async (message: Message | null) => {
    if (!message) {
      return;
    }

    if (state.isShuttingDown) {
      console.log("Shutting down, requeuing message");
      state.channel.nack(message, false, true);
      return;
    }

    state.inFlightMessages++;

    try {
      const content = JSON.parse(message.content.toString());
      console.log("Received message:", JSON.stringify(content));

      const ctx: MessageContext = {
        logger: {
          log: (...args: unknown[]) => console.log(...args),
        },
      };

      const result = await handler(content, ctx);

      if (message.properties.replyTo) {
        const reply: SuccessReply = {
          status: "success",
          data: result,
          processedAt: new Date().toISOString(),
        };

        console.log(`Sending reply to: ${message.properties.replyTo}`);
        state.channel.sendToQueue(
          message.properties.replyTo,
          Buffer.from(JSON.stringify(reply)),
          {
            correlationId: message.properties.correlationId,
          },
        );
      }

      state.channel.ack(message);
      console.log("Message processed and acked");
    } catch (error) {
      console.error("Error processing message:", error);

      if (message.properties.replyTo) {
        const reply: ErrorReply = {
          status: "error",
          error: {
            message: error instanceof Error ? error.message : String(error),
            type: error instanceof Error ? error.constructor.name : "Error",
          },
          processedAt: new Date().toISOString(),
        };

        state.channel.sendToQueue(
          message.properties.replyTo,
          Buffer.from(JSON.stringify(reply)),
          {
            correlationId: message.properties.correlationId,
          },
        );
      }

      state.channel.nack(message, false, false);
    } finally {
      state.inFlightMessages--;
    }
  };
};

const createRun = (
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

const createStop = (state: AppState) => {
  return async () => {
    console.log("Stopping consumer...");
    state.isShuttingDown = true;

    if (state.consumerTag) {
      await state.channel.cancel(state.consumerTag).catch(noop);
      console.log("Consumer cancelled");
    }

    console.log(`Waiting for ${state.inFlightMessages} in-flight messages...`);
    while (state.inFlightMessages > 0) {
      await sleep(100);
    }
    console.log("All in-flight messages completed");

    await state.channel.close().catch(noop);
    await state.connection.close().catch(noop);

    console.log("App stopped");
  };
};

export const AppBuilder = {
  create: (
    define: (config: Config) => { queue: string; handler: MessageHandler },
  ) => {
    return {
      async build(config: Config): Promise<App> {
        const { queue, handler } = define(config);

        const connection = await amqplib.connect(config.RABBITMQ_URL);
        const channel = await connection.createChannel();
        channel.on("close", () => {
          console.log("Channel closed");
        });
        connection.on("close", () => {
          console.log("Connection closed");
        });
        await channel.assertQueue(queue, { durable: true });

        const state: AppState = {
          channel,
          connection,
          consumerTag: null,
          isShuttingDown: false,
          inFlightMessages: 0,
        };

        const wrappedHandler = withMessageHandling(handler, state);

        return {
          run: createRun(wrappedHandler, state, queue),
          stop: createStop(state),
        };
      },
    };
  },
};

export const App = AppBuilder.create((config) => ({
  queue: config.RABBITMQ_QUEUE,
  handler,
}));
