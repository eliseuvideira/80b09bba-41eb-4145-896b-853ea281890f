import { noop } from "../../functions/noop";
import { sleep } from "../../functions/sleep";
import type { AppState } from "../types/AppState";

export const createStop = (state: AppState) => {
  return async () => {
    console.log("Stopping consumer...");
    state.isShuttingDown = true;

    if (state.consumerTag) {
      await state.channel.cancel(state.consumerTag).catch(noop);
      console.log("Consumer cancelled");
    }

    console.log(`Waiting for ${state.inFlightMessages} in-flight messages...`);
    while (state.inFlightMessages > 0) {
      await sleep(100);
    }
    console.log("All in-flight messages completed");

    await state.channel.close().catch(noop);
    await state.connection.close().catch(noop);

    console.log("App stopped");
  };
};
