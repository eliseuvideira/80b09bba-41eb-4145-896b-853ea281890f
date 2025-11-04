import type { Message } from "amqplib";
import amqplib from "amqplib";
import type { Config } from "./config";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type App = {
  run: () => Promise<void>;
  stop: () => Promise<void>;
};

type MessageHandler = (message: Message) => Promise<unknown>;

async function handleMessage(message: Message): Promise<unknown> {
  const content = message.content.toString();
  console.log("Received message:", content);

  const payload = JSON.parse(content);

  console.log("Processing message (1s delay)...");
  await sleep(1000);

  return {
    status: "success",
    received: payload,
    processedAt: new Date().toISOString(),
  };
}

export async function buildApp(config: Config): Promise<App> {
  let isShuttingDown = false;
  let inFlightMessages = 0;
  let consumerTag: string | null = null;

  const connection = await amqplib.connect(config.RABBITMQ_URL);
  const channel = await connection.createChannel();
  channel.on("close", () => {
    console.log("Channel closed");
  });
  connection.on("close", () => {
    console.log("Connection closed");
  });
  await channel.assertQueue(config.RABBITMQ_QUEUE, { durable: true });

  function withMessageHandling(handler: MessageHandler) {
    return async (message: Message | null) => {
      if (!message) {
        return;
      }

      if (isShuttingDown) {
        console.log("Shutting down, requeuing message");
        channel.nack(message, false, true);
        return;
      }

      inFlightMessages++;

      try {
        const result = await handler(message);

        if (message.properties.replyTo) {
          console.log(`Sending reply to: ${message.properties.replyTo}`);
          channel.sendToQueue(
            message.properties.replyTo,
            Buffer.from(JSON.stringify(result)),
            {
              correlationId: message.properties.correlationId,
            },
          );
        }

        channel.ack(message);
        console.log("Message processed and acked");
      } catch (error) {
        console.error("Error processing message: ", error);
        channel.nack(message, false, false);
      } finally {
        inFlightMessages--;
      }
    };
  }

  return {
    async run() {
      const handler = withMessageHandling(handleMessage);
      const consumeResult = await channel.consume(
        config.RABBITMQ_QUEUE,
        handler,
      );

      consumerTag = consumeResult.consumerTag;
      console.log(`Listening on queue: ${config.RABBITMQ_QUEUE}`);
    },

    async stop() {
      console.log("Stopping consumer...");
      isShuttingDown = true;

      if (consumerTag) {
        await channel.cancel(consumerTag).catch(() => {});
        console.log("Consumer cancelled");
      }

      console.log(`Waiting for ${inFlightMessages} in-flight messages...`);
      while (inFlightMessages > 0) {
        await sleep(100);
      }
      console.log("All in-flight messages completed");

      await channel.close().catch(() => {});
      await connection.close().catch(() => {});

      console.log("App stopped");
    },
  };
}
