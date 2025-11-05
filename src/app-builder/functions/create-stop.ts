import { noop } from "../../functions/noop";
import { sleep } from "../../functions/sleep";
import type { Logger } from "../../types/Logger";
import type { AppState } from "../types/AppState";

export const createStop = (state: AppState, logger: Logger) => {
  let done = false;

  return async () => {
    if (done) {
      return;
    }
    done = true;

    logger.info("Stopping consumer");
    state.isShuttingDown = true;

    if (state.consumerTag) {
      await state.channel.cancel(state.consumerTag).catch(noop);
      logger.info("Consumer cancelled");
    }

    logger.info("Waiting for in-flight messages", {
      inFlightMessages: state.inFlightMessages,
    });
    while (state.inFlightMessages > 0) {
      await sleep(100);
    }
    logger.info("All in-flight messages completed");

    await state.channel.close().catch(noop);
    await state.connection.close().catch(noop);

    logger.info("App stopped");
  };
};
