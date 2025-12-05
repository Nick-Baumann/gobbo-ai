import { logWebSelfId, sendMessageWeb } from "../providers/web/index.js";

export type CliDeps = {
  sendMessageWeb: typeof sendMessageWeb;
};

export function createDefaultDeps(): CliDeps {
  return {
    sendMessageWeb,
  };
}

export { logWebSelfId };
