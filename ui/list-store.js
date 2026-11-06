import {
  getAutoRefreshEnabled,
  onAutoRefreshChanged,
} from "../lib/config-storage.js";
import { AUTO_REFRESH_INTERVAL } from "../lib/constants.js";
import { createPoller } from "../lib/poll.js";

/**
 * A list that refreshes itself while visible, if Auto-refresh is on. After a
 * failed refresh the last items stay, with `error` set: only the latest request
 * may update them, an older one can resolve after it.
 */
export function createListStore(load) {
  const listeners = new Set();

  let items = [];
  let hasLoaded = false;
  let error = null;
  let autoRefresh = true;
  let started = false;
  let stopListening = null;
  let lastRequest = 0;

  const notify = () => {
    for (const listener of listeners) listener();
  };

  async function refresh() {
    const request = ++lastRequest;
    try {
      const next = await load();
      if (request !== lastRequest) return;
      items = next;
      error = null;
    } catch (err) {
      if (request !== lastRequest) return;
      error = err.message;
    }
    hasLoaded = true;
    notify();
  }

  const poller = createPoller({
    refresh,
    interval: AUTO_REFRESH_INTERVAL,
    isEnabled: () => autoRefresh,
  });

  return {
    get: () => ({ items, isLoading: !hasLoaded, error }),
    refresh,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    async start() {
      if (started) return;
      started = true;
      stopListening = onAutoRefreshChanged((enabled) => {
        autoRefresh = enabled;
      });
      autoRefresh = await getAutoRefreshEnabled();
      if (!started) return;
      poller.start();
      await refresh();
    },

    stop() {
      started = false;
      poller.stop();
      stopListening?.();
      stopListening = null;
    },
  };
}
