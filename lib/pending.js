import { PENDING_ACTION_TIMEOUT, PENDING_DEPLOY_TIMEOUT } from "./constants.js";
import { isResourceRunning } from "./status.js";

/**
 * Drops the pending entries Coolify has caught up with: a deployment that is no
 * longer queued/in progress, a start that now reports running, a stop that no
 * longer does (or any of them timed out). `activeDeployments` that isn't a list
 * is unknown, which keeps deployments. Entries added after `fetchStartedAt` are
 * kept: this fetch's data predates them.
 * Returns the same object when nothing changed, to skip a write.
 */
export function prunePending(
  pending,
  resources,
  activeDeployments,
  fetchStartedAt,
  now = Date.now(),
) {
  const activeUuids = Array.isArray(activeDeployments)
    ? new Set(activeDeployments.map((d) => d.deployment_uuid))
    : null;
  const next = {};
  let changed = false;

  for (const [uuid, entry] of Object.entries(pending)) {
    let done;
    if (entry.since > fetchStartedAt) {
      done = false;
    } else if (entry.kind === "deploying") {
      done =
        now - entry.since > PENDING_DEPLOY_TIMEOUT ||
        (activeUuids !== null && !activeUuids.has(entry.deploymentUuid));
    } else {
      // Missing when its list failed to load this time: keep waiting.
      const resource = resources.find((r) => r.uuid === uuid);
      done =
        now - entry.since > PENDING_ACTION_TIMEOUT ||
        (resource !== undefined &&
          isResourceRunning(resource.status) === (entry.kind === "starting"));
    }

    if (done) changed = true;
    else next[uuid] = entry;
  }

  return changed ? next : pending;
}

const storageKey = (instanceId) => `pending:${instanceId}`;

export async function readPending(instanceId) {
  const key = storageKey(instanceId);
  const stored = await chrome.storage.session.get(key);
  return stored[key] ?? {};
}

/**
 * Changes the entries of an instance. Storage has no atomic update, and the
 * service worker and any open page write here: the lock makes them take turns.
 * Writes nothing when `update` returns the object it was given.
 */
export function updatePending(instanceId, update) {
  const key = storageKey(instanceId);
  return navigator.locks.request(key, async () => {
    const current = await readPending(instanceId);
    const next = update(current);
    if (next !== current) {
      await chrome.storage.session.set({ [key]: next });
    }
    return next;
  });
}

export function setPendingEntry(instanceId, uuid, entry) {
  return updatePending(instanceId, (current) => ({ ...current, [uuid]: entry }));
}

export function onPendingChanged(instanceId, callback) {
  const key = storageKey(instanceId);
  const listener = (changes, area) => {
    if (area === "session" && key in changes) {
      callback(changes[key].newValue ?? {});
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
