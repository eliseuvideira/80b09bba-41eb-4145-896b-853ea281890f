import { z } from "zod";

const CONFIG_SCHEMA = z.object({
  RABBITMQ_URL: z.string().default("amqp://localhost"),
  RABBITMQ_QUEUE: z.string().default("queue_example"),
});

export type Config = z.infer<typeof CONFIG_SCHEMA>;

const build = async (env: unknown): Promise<Config> => {
  return CONFIG_SCHEMA.parse(env);
};

export const Config = {
  build,
};
