import { randomUUID } from "node:crypto";
import amqplib from "amqplib";
import { buildApp } from "../src/app";
import type { Config } from "../src/config";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendRpcRequest(
  rabbitmqUrl: string,
  queueName: string,
  payload: object,
  timeout = 30000,
): Promise<object> {
  const connection = await amqplib.connect(rabbitmqUrl);
  const channel = await connection.createChannel();

  const replyQueue = await channel.assertQueue("", { exclusive: true });
  const correlationId = randomUUID();

  const responsePromise = new Promise<object>((resolve, reject) => {
    const timeoutHandle = setTimeout(() => {
      reject(new Error(`Request timeout after ${timeout}ms`));
    }, timeout);

    channel.consume(
      replyQueue.queue,
      (message) => {
        if (!message) {
          return;
        }

        if (message.properties.correlationId === correlationId) {
          clearTimeout(timeoutHandle);
          const response = JSON.parse(message.content.toString());
          resolve(response);
        }
      },
      { noAck: true },
    );
  });

  channel.sendToQueue(queueName, Buffer.from(JSON.stringify(payload)), {
    correlationId,
    replyTo: replyQueue.queue,
    persistent: true,
  });

  const response = await responsePromise;

  await channel.close();
  await connection.close();

  return response;
}

describe("App Integration Tests", () => {
  const rabbitmqUrl = process.env.RABBITMQ_URL || "amqp://localhost";

  it("should process message and send reply", async () => {
    const testQueue = `test-queue-${randomUUID()}`;

    const testConfig: Config = {
      RABBITMQ_URL: rabbitmqUrl,
      RABBITMQ_QUEUE: testQueue,
    };

    const app = await buildApp(testConfig);

    const runPromise = app.run();

    await sleep(500);

    const request = { test: "hello", value: 42 };
    const response = await sendRpcRequest(rabbitmqUrl, testQueue, request);

    expect(response).toMatchObject({
      status: "success",
      received: request,
    });
    expect(response).toHaveProperty("processedAt");

    await app.stop();
    await runPromise;
  });

  it("should handle multiple concurrent messages", async () => {
    const testQueue = `test-queue-${randomUUID()}`;

    const testConfig: Config = {
      RABBITMQ_URL: rabbitmqUrl,
      RABBITMQ_QUEUE: testQueue,
    };

    const app = await buildApp(testConfig);

    const runPromise = app.run();

    await sleep(500);

    const requests = [
      { test: "message1", value: 1 },
      { test: "message2", value: 2 },
      { test: "message3", value: 3 },
    ];

    const responses = await Promise.all(
      requests.map((req) => sendRpcRequest(rabbitmqUrl, testQueue, req)),
    );

    expect(responses).toHaveLength(3);

    for (let i = 0; i < 3; i++) {
      expect(responses[i]).toMatchObject({
        status: "success",
        received: requests[i],
      });
    }

    await app.stop();
    await runPromise;
  });

  it("should gracefully handle shutdown with in-flight messages", async () => {
    const testQueue = `test-queue-${randomUUID()}`;

    const testConfig: Config = {
      RABBITMQ_URL: rabbitmqUrl,
      RABBITMQ_QUEUE: testQueue,
    };

    const app = await buildApp(testConfig);

    const runPromise = app.run();

    await sleep(500);

    const request = { test: "shutdown-test", value: 99 };
    const responsePromise = sendRpcRequest(
      rabbitmqUrl,
      testQueue,
      request,
      15000,
    );

    await sleep(100);

    const stopPromise = app.stop();

    const response = await responsePromise;

    expect(response).toMatchObject({
      status: "success",
      received: request,
    });

    await stopPromise;
    await runPromise;
  });
});
