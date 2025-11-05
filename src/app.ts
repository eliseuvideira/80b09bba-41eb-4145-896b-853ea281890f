import { AppBuilder } from "./app-builder";
import { handler } from "./handler";
import { createContext } from "./types/Context";

export const App = AppBuilder((config) => ({
  queue: config.RABBITMQ_QUEUE,
  handler,
  createContext,
}));
