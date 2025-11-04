import dotenv from "dotenv";
import { App } from "./app";
import { buildConfig } from "./config";

const main = async (): Promise<void> => {
  dotenv.config();

  const config = buildConfig(process.env);
  const app = await App.build(config);

  const shutdown = async (): Promise<void> => {
    console.log("Shutting down...");
    await app.stop();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);

  await app.run();
};

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
