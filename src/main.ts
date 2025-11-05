import dotenv from "dotenv";
import { App } from "./app";
import { Config } from "./config";
import { Logger } from "./logger";

const main = async (): Promise<void> => {
  dotenv.config({
    quiet: true,
  });

  const config = await Config.build(process.env);
  const logger = await Logger.build(process.env);

  const app = await App.build(config, logger);

  const shutdown = async (): Promise<void> => {
    logger.info("Shutting down...");
    await app.stop();
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  await app.run();
};

main().catch(async (error) => {
  const logger = await Logger.build(process.env);
  logger.fatal("Fatal error", { error });
  process.exit(1);
});
