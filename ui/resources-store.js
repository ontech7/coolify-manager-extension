import {
  getAutoRefreshEnabled,
  onAutoRefreshChanged,
} from "../lib/config-storage.js";
import { AUTO_REFRESH_INTERVAL } from "../lib/constants.js";
import {
  onPendingChanged,
  prunePending,
  readPending,
  updatePending,
} from "../lib/pending.js";
import { createPoller } from "../lib/poll.js";
import { mergeResources } from "../lib/resources.js";

const valueOf = (settled) =>
  settled.status === "fulfilled" ? settled.value : null;

/**
 * All the resources of the instance, the port of the app's useResources. Each
 * list is fetched independently so a failure in one type still surfaces the
 * others. Pending entries are written by the service worker, and this store
 * only drops the ones Coolify has caught up with.
 */
export function createResourcesStore(ctx) {
  const instanceId = ctx.instance.id;
  const listeners = new Set();

  let resources = [];
  let pending = {};
  let isLoading = true;
  let isRefreshing = false;
  let error = null;
  let autoRefresh = true;
  let started = false;
  let stopListening = [];
  // Only the latest request may update state: an older one can resolve after it.
  let lastRequest = 0;

  const notify = () => {
    for (const listener of listeners) listener();
  };

  async function refresh({ manual = false } = {}) {
    const request = ++lastRequest;
    if (manual) {
      isRefreshing = true;
      notify();
    }

    const fetchStartedAt = Date.now();
    // Only ask for deployments while one started from here is pending.
    const hasDeploying = Object.values(pending).some(
      (entry) => entry.kind === "deploying",
    );

    const [apps, dbs, svcs, active] = await Promise.allSettled([
      ctx.api.getApplications(),
      ctx.api.getDatabases(),
      ctx.api.getServices(),
      hasDeploying ? ctx.api.getDeployments() : Promise.resolve(null),
    ]);
    if (request !== lastRequest) return;

    const merged = mergeResources(valueOf(apps), valueOf(dbs), valueOf(svcs));
    const failed = [apps, dbs, svcs].every((r) => r.status === "rejected");

    // Everything failed: keep what is listed, under the banner.
    if (!failed) resources = merged;
    error = failed ? apps.reason.message : null;
    isLoading = false;
    isRefreshing = false;

    pending = await updatePending(instanceId, (current) =>
      prunePending(current, merged, valueOf(active), fetchStartedAt),
    );
    if (request === lastRequest) notify();
  }

  const poller = createPoller({
    refresh,
    interval: AUTO_REFRESH_INTERVAL,
    isEnabled: () => autoRefresh,
  });

  return {
    /** Resources without a pending action are passed through untouched. */
    get() {
      return {
        resources: resources.map((resource) =>
          pending[resource.uuid]
            ? { ...resource, pending: pending[resource.uuid] }
            : resource,
        ),
        isLoading,
        isRefreshing,
        error,
      };
    },

    refresh,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /** Loads now and starts polling. Coming back to a hidden list refreshes it. */
    async start() {
      if (started) return;
      started = true;

      stopListening = [
        onPendingChanged(instanceId, (next) => {
          pending = next;
          notify();
        }),
        onAutoRefreshChanged((enabled) => {
          autoRefresh = enabled;
        }),
      ];

      [pending, autoRefresh] = await Promise.all([
        readPending(instanceId),
        getAutoRefreshEnabled(),
      ]);
      if (!started) return;

      notify();
      poller.start();
      await refresh();
    },

    stop() {
      started = false;
      poller.stop();
      for (const unsubscribe of stopListening) unsubscribe();
      stopListening = [];
    },
  };
}
