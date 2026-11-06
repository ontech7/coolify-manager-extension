import { ensureApiMode, getConfig } from "./config-storage.js";
import { CoolifyAPI, UnsupportedVersionError } from "./coolify-api.js";
import { setPendingEntry } from "./pending.js";

const deploying = (deploymentUuid) =>
  deploymentUuid ? { kind: "deploying", deploymentUuid } : null;
const starting = () => ({ kind: "starting" });
const stopping = () => ({ kind: "stopping" });
const nothing = () => null;

/** Each allowed action, and the pending entry its result leaves on the resource. */
const ACTIONS = new Map([
  ["startApplication", deploying],
  ["restartApplication", deploying],
  ["deployApplication", (r) => deploying(r?.deployments?.[0]?.deployment_uuid)],
  ["rollbackApplication", (r) => deploying(r?.deployment_uuid)],
  ["startDatabase", starting],
  ["startService", starting],
  ["stopApplication", stopping],
  ["stopDatabase", stopping],
  ["stopService", stopping],
  ["restartDatabase", nothing],
  ["restartService", nothing],
  ["pullLatestImagesService", nothing],
  ["cancelDeployment", nothing],
  ["runDatabaseBackup", nothing],
  ["serviceContainerAction", nothing],
  ["validateServer", nothing],
  ["restartProxy", nothing],
  ["runDockerCleanup", nothing],
]);

export const ACTION_NAMES = [...ACTIONS.keys()];

/** Runs an allowed method of the client. Never throws. */
export async function runAction(api, name, args) {
  if (!ACTIONS.has(name) || !Array.isArray(args)) {
    return {
      ok: false,
      message: `Unknown action: ${name}`,
      unsupported: false,
    };
  }

  try {
    const data = await api[name](...args);
    const entry = ACTIONS.get(name)(data);
    return {
      ok: true,
      data,
      pending: entry
        ? { uuid: args[0], entry: { ...entry, since: Date.now() } }
        : null,
    };
  } catch (error) {
    return {
      ok: false,
      message: error.message,
      unsupported: error instanceof UnsupportedVersionError,
    };
  }
}

const errorsKey = (instanceId) => `actionErrors:${instanceId}`;

/** Same turns as updatePending: see the comment there. */
function updateErrors(instanceId, update) {
  const key = errorsKey(instanceId);
  return navigator.locks.request(key, async () => {
    const stored = await chrome.storage.session.get(key);
    const { result, next } = update(stored[key] ?? []);
    await chrome.storage.session.set({ [key]: next });
    return result;
  });
}

async function storeActionError(instanceId, label, message) {
  const id = crypto.randomUUID();
  await updateErrors(instanceId, (errors) => ({
    next: [...errors, { id, label, message }],
  }));
  return id;
}

/** The errors of actions whose page is gone. Each one is returned once. */
export function consumeActionErrors(instanceId) {
  return updateErrors(instanceId, (errors) => ({ result: errors, next: [] }));
}

export function clearActionError(instanceId, id) {
  return updateErrors(instanceId, (errors) => ({
    next: errors.filter((error) => error.id !== id),
  }));
}

async function run({ instanceId, action, args }) {
  const { instances } = await getConfig();
  const instance = instances.find((item) => item.id === instanceId);

  if (!instance) {
    return {
      ok: false,
      message: "This instance no longer exists.",
      unsupported: false,
    };
  }

  // Refused before any request: detecting the mode would call the server.
  if (!ACTIONS.has(action) || !Array.isArray(args)) {
    return runAction(null, action, args);
  }

  const apiMode = await ensureApiMode(instance);
  const api = new CoolifyAPI(instance.serverUrl, instance.apiToken, apiMode);
  return runAction(api, action, args);
}

/**
 * The service worker's `run-action` message. The result is saved before
 * answering, because the page that asked may be gone: a pending entry shows on
 * the next open, and so does an error, until a page that's still there clears
 * it on delivery.
 */
export async function handleRunAction(message) {
  const { instanceId, label } = message;
  const result = await run(message);

  if (result.ok) {
    if (result.pending) {
      await setPendingEntry(instanceId, result.pending.uuid, result.pending.entry);
    }
    return result;
  }

  return {
    ...result,
    errorId: await storeActionError(instanceId, label, result.message),
  };
}
