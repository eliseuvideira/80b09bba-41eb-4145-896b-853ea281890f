import type { Channel, ChannelModel } from "amqplib";

export type AppState = {
  channel: Channel;
  connection: ChannelModel;
  consumerTag: string | null;
  isShuttingDown: boolean;
  inFlightMessages: number;
};
