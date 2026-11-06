import { POST_ACTIONS_MIN_VERSION } from "./constants.js";
import { CoolifyAPI } from "./coolify-api.js";
import { isVersionAtLeast } from "./version.js";

const STORAGE_KEYS = {
  INSTANCES: "instances",
  ACTIVE_INSTANCE_ID: "activeInstanceId",
  AUTO_REFRESH_ENABLED: "autoRefreshEnabled",
  LEGACY_SERVER_URL: "serverUrl",
  LEGACY_API_TOKEN: "apiToken",
};

const API_MODES = ["legacy", "current"];

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function sanitizeServerUrl(rawUrl) {
  const trimmed = (rawUrl ?? "").trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.replace(/\/+$/, "");
}

function deriveInstanceName(serverUrl) {
  try {
    return new URL(serverUrl).host || "Coolify Instance";
  } catch (error) {
    return "Coolify Instance";
  }
}

/** Sets `apiMode` when valid and leaves the field out otherwise. */
function withApiMode({ apiMode: _previous, ...instance }, apiMode) {
  return API_MODES.includes(apiMode) ? { ...instance, apiMode } : instance;
}

function normalizeInstance(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const serverUrl = sanitizeServerUrl(raw.serverUrl);
  const apiToken = typeof raw.apiToken === "string" ? raw.apiToken.trim() : "";

  if (!id || !serverUrl || !apiToken) {
    return null;
  }

  return withApiMode(
    { id, name: name || deriveInstanceName(serverUrl), serverUrl, apiToken },
    raw.apiMode,
  );
}

async function migrateLegacyConfig() {
  const legacy = await chrome.storage.sync.get({
    [STORAGE_KEYS.INSTANCES]: null,
    [STORAGE_KEYS.ACTIVE_INSTANCE_ID]: null,
    [STORAGE_KEYS.LEGACY_SERVER_URL]: null,
    [STORAGE_KEYS.LEGACY_API_TOKEN]: null,
  });

  const hasInstances =
    Array.isArray(legacy[STORAGE_KEYS.INSTANCES]) &&
    legacy[STORAGE_KEYS.INSTANCES].length > 0;

  if (hasInstances) {
    if (
      legacy[STORAGE_KEYS.LEGACY_SERVER_URL] ||
      legacy[STORAGE_KEYS.LEGACY_API_TOKEN]
    ) {
      await chrome.storage.sync.remove([
        STORAGE_KEYS.LEGACY_SERVER_URL,
        STORAGE_KEYS.LEGACY_API_TOKEN,
      ]);
    }
    return;
  }

  const legacyUrl = sanitizeServerUrl(legacy[STORAGE_KEYS.LEGACY_SERVER_URL]);
  const legacyToken =
    typeof legacy[STORAGE_KEYS.LEGACY_API_TOKEN] === "string"
      ? legacy[STORAGE_KEYS.LEGACY_API_TOKEN].trim()
      : "";

  if (!legacyUrl || !legacyToken) {
    return;
  }

  const instance = {
    id: generateId(),
    name: deriveInstanceName(legacyUrl),
    serverUrl: legacyUrl,
    apiToken: legacyToken,
  };

  await chrome.storage.sync.set({
    [STORAGE_KEYS.INSTANCES]: [instance],
    [STORAGE_KEYS.ACTIVE_INSTANCE_ID]: instance.id,
  });

  await chrome.storage.sync.remove([
    STORAGE_KEYS.LEGACY_SERVER_URL,
    STORAGE_KEYS.LEGACY_API_TOKEN,
  ]);
}

export async function getConfig() {
  await migrateLegacyConfig();

  const stored = await chrome.storage.sync.get({
    [STORAGE_KEYS.INSTANCES]: [],
    [STORAGE_KEYS.ACTIVE_INSTANCE_ID]: null,
  });

  const instances = Array.isArray(stored[STORAGE_KEYS.INSTANCES])
    ? stored[STORAGE_KEYS.INSTANCES]
        .map((instance) => normalizeInstance(instance))
        .filter(Boolean)
    : [];

  let activeInstanceId =
    typeof stored[STORAGE_KEYS.ACTIVE_INSTANCE_ID] === "string"
      ? stored[STORAGE_KEYS.ACTIVE_INSTANCE_ID]
      : null;

  if (instances.length === 0) {
    if (activeInstanceId !== null) {
      await chrome.storage.sync.set({
        [STORAGE_KEYS.ACTIVE_INSTANCE_ID]: null,
      });
    }
    return { instances: [], activeInstanceId: null };
  }

  const activeExists = activeInstanceId
    ? instances.some((instance) => instance.id === activeInstanceId)
    : false;

  if (!activeExists) {
    activeInstanceId = instances[0].id;
    await chrome.storage.sync.set({
      [STORAGE_KEYS.ACTIVE_INSTANCE_ID]: activeInstanceId,
    });
  }

  return { instances, activeInstanceId };
}

export async function getActiveInstance() {
  const config = await getConfig();

  if (!config.activeInstanceId) {
    return null;
  }

  return (
    config.instances.find(
      (instance) => instance.id === config.activeInstanceId,
    ) ?? null
  );
}

export async function addInstance(instance) {
  const name = typeof instance.name === "string" ? instance.name.trim() : "";
  const serverUrl = sanitizeServerUrl(instance.serverUrl);
  const apiToken =
    typeof instance.apiToken === "string" ? instance.apiToken.trim() : "";

  if (!serverUrl || !apiToken) {
    throw new Error("Server URL and API token are required.");
  }

  const config = await getConfig();

  const newInstance = withApiMode(
    {
      id: generateId(),
      name: name || deriveInstanceName(serverUrl),
      serverUrl,
      apiToken,
    },
    instance.apiMode,
  );

  const instances = [...config.instances, newInstance];
  const update = { [STORAGE_KEYS.INSTANCES]: instances };

  if (!config.activeInstanceId) {
    update[STORAGE_KEYS.ACTIVE_INSTANCE_ID] = newInstance.id;
  }

  await chrome.storage.sync.set(update);

  return newInstance;
}

export async function updateInstance(instance) {
  const id = typeof instance.id === "string" ? instance.id.trim() : "";
  if (!id) {
    throw new Error("Instance id is required.");
  }

  const name = typeof instance.name === "string" ? instance.name.trim() : "";
  const serverUrl = sanitizeServerUrl(instance.serverUrl);
  const apiToken =
    typeof instance.apiToken === "string" ? instance.apiToken.trim() : "";

  if (!serverUrl || !apiToken) {
    throw new Error("Server URL and API token are required.");
  }

  const config = await getConfig();
  const index = config.instances.findIndex((item) => item.id === id);

  if (index === -1) {
    throw new Error("Instance not found.");
  }

  // Without the field the saved mode stays; null clears it, so that it is
  // detected again on the next connection.
  const updatedInstance = withApiMode(
    {
      ...config.instances[index],
      name: name || deriveInstanceName(serverUrl),
      serverUrl,
      apiToken,
    },
    "apiMode" in instance ? instance.apiMode : config.instances[index].apiMode,
  );

  const instances = [...config.instances];
  instances[index] = updatedInstance;

  await chrome.storage.sync.set({
    [STORAGE_KEYS.INSTANCES]: instances,
  });

  return updatedInstance;
}

export async function removeInstance(id) {
  const targetId = typeof id === "string" ? id.trim() : "";
  if (!targetId) {
    throw new Error("Instance id is required.");
  }

  const config = await getConfig();
  const instances = config.instances.filter(
    (instance) => instance.id !== targetId,
  );

  const update = { [STORAGE_KEYS.INSTANCES]: instances };

  if (config.activeInstanceId === targetId) {
    update[STORAGE_KEYS.ACTIVE_INSTANCE_ID] = instances[0]?.id ?? null;
  }

  await chrome.storage.sync.set(update);
}

export async function switchActiveInstance(id) {
  const targetId = typeof id === "string" ? id.trim() : "";
  if (!targetId) {
    throw new Error("Instance id is required.");
  }

  const config = await getConfig();
  const exists = config.instances.some((instance) => instance.id === targetId);

  if (!exists) {
    throw new Error("Instance not found.");
  }

  await chrome.storage.sync.set({
    [STORAGE_KEYS.ACTIVE_INSTANCE_ID]: targetId,
  });
}

/**
 * The instance's API mode. An instance saved before the field existed asks the
 * server once and saves the answer. When the server can't tell (unreachable,
 * token without read permission), it uses "current" for now and asks again next
 * time; the user can also pick the mode in the settings.
 */
export async function ensureApiMode(instance) {
  if (instance.apiMode) {
    return instance.apiMode;
  }

  const version = await new CoolifyAPI(
    instance.serverUrl,
    instance.apiToken,
  ).getVersion();
  const atLeast = version
    ? isVersionAtLeast(version, POST_ACTIONS_MIN_VERSION)
    : null;

  if (atLeast === null) {
    return "current";
  }

  const apiMode = atLeast ? "current" : "legacy";

  // Read again: the config may have changed during the request.
  const config = await getConfig();
  if (config.instances.some((item) => item.id === instance.id)) {
    await chrome.storage.sync.set({
      [STORAGE_KEYS.INSTANCES]: config.instances.map((item) =>
        item.id === instance.id ? withApiMode(item, apiMode) : item,
      ),
    });
  }

  return apiMode;
}

/** Calls back when `keys` change in sync storage. Returns the unsubscribe. */
function onSyncChanged(keys, callback) {
  const listener = (changes, area) => {
    if (area === "sync" && keys.some((key) => key in changes)) {
      callback(changes);
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

export function onConfigChanged(callback) {
  return onSyncChanged(
    [STORAGE_KEYS.INSTANCES, STORAGE_KEYS.ACTIVE_INSTANCE_ID],
    () => callback(),
  );
}

export async function getAutoRefreshEnabled() {
  const stored = await chrome.storage.sync.get({
    [STORAGE_KEYS.AUTO_REFRESH_ENABLED]: true,
  });
  return stored[STORAGE_KEYS.AUTO_REFRESH_ENABLED] !== false;
}

export async function setAutoRefreshEnabled(enabled) {
  await chrome.storage.sync.set({
    [STORAGE_KEYS.AUTO_REFRESH_ENABLED]: Boolean(enabled),
  });
}

export function onAutoRefreshChanged(callback) {
  return onSyncChanged([STORAGE_KEYS.AUTO_REFRESH_ENABLED], (changes) =>
    callback(changes[STORAGE_KEYS.AUTO_REFRESH_ENABLED].newValue !== false),
  );
}
