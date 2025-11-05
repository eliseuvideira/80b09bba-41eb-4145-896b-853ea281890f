import type { Message } from "amqplib";
import type { Logger } from "../../types/Logger";
import type { AppState } from "../types/AppState";
import type { MessageHandler } from "../types/MessageHandler";
import type { ErrorReply, SuccessReply } from "../types/Reply";

export const withMessageHandling = <Context extends { logger: Logger }>(
  handler: MessageHandler<Context>,
  createContext: () => Context,
  state: AppState,
) => {
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

      const ctx = createContext();

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
