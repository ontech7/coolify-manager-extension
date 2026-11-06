import { clearActionError } from "./action-runner.js";
import { UnsupportedVersionError } from "./coolify-api.js";

/** How pages run state-changing actions: through the service worker. */
export function createActionsClient(instanceId) {
  return {
    async run(action, args = [], { label } = {}) {
      // Chrome rejects when the service worker dies before answering.
      const response = await chrome.runtime
        .sendMessage({ type: "run-action", instanceId, action, args, label })
        .catch(() => null);

      if (!response) {
        throw new Error("The extension did not answer. The action may or may not have run.");
      }
      if (response.ok) {
        return response.data;
      }

      // This page shows the error: it must not show again on the next open.
      if (response.errorId) {
        await clearActionError(instanceId, response.errorId);
      }

      if (response.unsupported) {
        const error = new UnsupportedVersionError();
        error.message = response.message;
        throw error;
      }
      throw new Error(response.message);
    },
  };
}
