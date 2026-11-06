/**
 * The parts of the `chrome` API the extension uses, in memory, so that code
 * running in pages and the service worker can be tested with node:test.
 */

function createEvent() {
  const listeners = new Set();
  return {
    addListener: (listener) => listeners.add(listener),
    removeListener: (listener) => listeners.delete(listener),
    hasListener: (listener) => listeners.has(listener),
    fire: (...args) => {
      for (const listener of [...listeners]) listener(...args);
    },
    clear: () => listeners.clear(),
  };
}

const clone = (value) =>
  value === undefined ? undefined : JSON.parse(JSON.stringify(value));

function createStorageArea(name, globalOnChanged) {
  let data = {};
  const onChanged = createEvent();

  const notify = (changes) => {
    if (Object.keys(changes).length === 0) return;
    onChanged.fire(changes);
    globalOnChanged.fire(changes, name);
  };

  return {
    onChanged,
    async get(keys) {
      if (keys === null || keys === undefined) return clone(data);
      if (typeof keys === "string") keys = [keys];
      const result = {};
      if (Array.isArray(keys)) {
        for (const key of keys) {
          if (key in data) result[key] = clone(data[key]);
        }
        return result;
      }
      for (const [key, fallback] of Object.entries(keys)) {
        result[key] = key in data ? clone(data[key]) : fallback;
      }
      return result;
    },
    async set(items) {
      const changes = {};
      for (const [key, value] of Object.entries(items)) {
        changes[key] = { oldValue: clone(data[key]), newValue: clone(value) };
        data[key] = clone(value);
      }
      notify(changes);
    },
    async remove(keys) {
      const changes = {};
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        if (key in data) {
          changes[key] = { oldValue: data[key] };
          delete data[key];
        }
      }
      notify(changes);
    },
    async clear() {
      await this.remove(Object.keys(data));
    },
    reset() {
      data = {};
      onChanged.clear();
    },
  };
}

/** Installs `globalThis.chrome`. `reset()` empties it between tests. */
export function installChromeStub() {
  const storageChanged = createEvent();
  const areas = {
    sync: createStorageArea("sync", storageChanged),
    session: createStorageArea("session", storageChanged),
    local: createStorageArea("local", storageChanged),
  };
  const onMessage = createEvent();

  const stub = {
    calls: [],
    contexts: [],
    reset() {
      for (const area of Object.values(areas)) area.reset();
      storageChanged.clear();
      onMessage.clear();
      stub.calls.length = 0;
      stub.contexts = [];
    },
  };

  globalThis.chrome = {
    storage: { ...areas, onChanged: storageChanged },
    runtime: {
      id: "stub-extension-id",
      onMessage,
      getURL: (path) => `chrome-extension://stub-extension-id/${path}`,
      getManifest: () => ({ version: "0.0.0" }),
      getContexts: async () => stub.contexts,
      /** Answers like Chrome: the first listener that responds wins. */
      sendMessage: (message) =>
        new Promise((resolve) => {
          let answered = false;
          const respond = (value) => {
            if (!answered) {
              answered = true;
              resolve(value);
            }
          };
          onMessage.fire(message, {}, respond);
          setTimeout(() => respond(undefined), 0);
        }),
    },
    tabs: {
      create: async (options) => {
        stub.calls.push(["tabs.create", options]);
        return { id: 1, windowId: 1, ...options };
      },
      update: async (tabId, options) => {
        stub.calls.push(["tabs.update", tabId, options]);
        return { id: tabId, ...options };
      },
    },
    windows: {
      update: async (windowId, options) => {
        stub.calls.push(["windows.update", windowId, options]);
        return { id: windowId, ...options };
      },
    },
  };

  return stub;
}
