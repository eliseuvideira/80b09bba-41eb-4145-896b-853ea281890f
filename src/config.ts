import { z } from "zod";

export const CONFIG_SCHEMA = z.object({
  RABBITMQ_URL: z.string().default("amqp://localhost"),
  RABBITMQ_QUEUE: z.string().default("queue_example"),
});

export type Config = z.infer<typeof CONFIG_SCHEMA>;

export function buildConfig(env: unknown): Config {
  return CONFIG_SCHEMA.parse(env);
}
