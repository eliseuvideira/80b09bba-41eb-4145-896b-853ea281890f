import { AppBuilder } from "./app-builder";
import { handler } from "./handler";

export const App = AppBuilder((config) => ({
  queue: config.RABBITMQ_QUEUE,
  handler,
}));
