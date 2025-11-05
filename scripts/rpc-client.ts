import { randomUUID } from "node:crypto";
import amqplib from "amqplib";
import dotenv from "dotenv";

dotenv.config();

const sendRpcRequest = async () => {
  const rabbitmqUrl = process.env.RABBITMQ_URL || "amqp://localhost";
  const queueName = process.env.RABBITMQ_QUEUE || "queue_example";

  const payload = process.argv[2] || '{"test": "hello"}';

  const connection = await amqplib.connect(rabbitmqUrl);
  const channel = await connection.createChannel();

  const replyQueue = await channel.assertQueue("", { exclusive: true });
  const correlationId = randomUUID();

  console.log("Sending request:", payload);
  console.log("Correlation ID:", correlationId);

  const responsePromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Request timeout after 30s"));
    }, 30000);

    channel.consume(
      replyQueue.queue,
      (message) => {
        if (!message) {
          return;
        }

        if (message.properties.correlationId === correlationId) {
          clearTimeout(timeout);
          const response = JSON.parse(message.content.toString());
          resolve(response);
        }
      },
      { noAck: true },
    );
  });

  channel.sendToQueue(queueName, Buffer.from(payload), {
    correlationId,
    replyTo: replyQueue.queue,
    persistent: true,
  });

  console.log("Waiting for response...");
  const response = await responsePromise;

  console.log("Received response:", response);

  await channel.close();
  await connection.close();
};

sendRpcRequest().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
