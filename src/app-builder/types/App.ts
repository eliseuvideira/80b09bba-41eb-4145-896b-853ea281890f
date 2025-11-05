export type App = {
  run: () => Promise<void>;
  stop: () => Promise<void>;
};
