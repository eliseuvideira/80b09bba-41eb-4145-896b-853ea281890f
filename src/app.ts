import type { Channel, ChannelModel, Message } from "amqplib";
import amqplib from "amqplib";
import type { Config } from "./config";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class App {
  public static async build(config: Config): Promise<App> {
    const connection = await amqplib.connect(config.RABBITMQ_URL);
    const channel = await connection.createChannel();

    await channel.assertQueue(config.RABBITMQ_QUEUE, { durable: true });

    return new App({
      connection,
      channel,
      queue: config.RABBITMQ_QUEUE,
    });
  }

  private readonly connection: ChannelModel;
  private readonly channel: Channel;
  private readonly queue: string;
  private consumerTag: string | null = null;
  private inFlightMessages = 0;
  private isShuttingDown = false;

  constructor({
    connection,
    channel,
    queue,
  }: {
    connection: ChannelModel;
    channel: Channel;
    queue: string;
  }) {
    this.connection = connection;
    this.channel = channel;
    this.queue = queue;
  }

  public async run(): Promise<void> {
    const consumeResult = await this.channel.consume(
      this.queue,
      async (message) => {
        if (!message) {
          return;
        }

        await this.handleMessage(message);
      },
    );

    this.consumerTag = consumeResult.consumerTag;

    console.log(`Listening on queue: ${this.queue}`);
  }

  public async stop(): Promise<void> {
    console.log("Stopping consumer...");
    this.isShuttingDown = true;

    if (this.consumerTag) {
      await this.channel.cancel(this.consumerTag).catch(() => {});
      console.log("Consumer cancelled");
    }

    console.log(`Waiting for ${this.inFlightMessages} in-flight messages...`);
    while (this.inFlightMessages > 0) {
      await sleep(100);
    }
    console.log("All in-flight messages completed");

    await this.channel.close().catch(() => {});
    await this.connection.close().catch(() => {});

    console.log("App stopped");
  }

  private async handleMessage(message: Message): Promise<void> {
    if (this.isShuttingDown) {
      console.log("Shutting down, requeuing message");
      this.channel.nack(message, false, true);
      return;
    }

    this.inFlightMessages++;

    try {
      const content = message.content.toString();
      console.log("Received message:", content);

      const payload = JSON.parse(content);

      console.log("Processing message (1s delay)...");
      await sleep(1000);

      const reply = {
        status: "success",
        received: payload,
        processedAt: new Date().toISOString(),
      };

      if (message.properties.replyTo) {
        console.log(`Sending reply to: ${message.properties.replyTo}`);
        this.channel.sendToQueue(
          message.properties.replyTo,
          Buffer.from(JSON.stringify(reply)),
          {
            correlationId: message.properties.correlationId,
          },
        );
      }

      this.channel.ack(message);
      console.log("Message processed and acked");
    } catch (error) {
      console.error("Error processing message:", error);
      this.channel.nack(message, false, false);
    } finally {
      this.inFlightMessages--;
    }
  }
}
