import dotenv from "dotenv";
import { buildApp } from "./app";
import { buildConfig } from "./config";

const main = async (): Promise<void> => {
  dotenv.config();

  const config = buildConfig(process.env);
  const app = await buildApp(config);

  const shutdown = async (): Promise<void> => {
    console.log("Shutting down...");
    await app.stop();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  await app.run();
};

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
