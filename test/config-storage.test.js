import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { installChromeStub } from "./helpers/chrome-stub.js";
import { startMockCoolify, TEST_TOKEN } from "./mock-coolify/server.js";

const stub = installChromeStub();
const {
  addInstance,
  ensureApiMode,
  getAutoRefreshEnabled,
  getConfig,
  onAutoRefreshChanged,
  onConfigChanged,
  setAutoRefreshEnabled,
  updateInstance,
} = await import("../lib/config-storage.js");

let v41;
let v43;

const INSTANCE = {
  id: "i1",
  name: "Home",
  serverUrl: "http://coolify.lan:8000",
  apiToken: "token-token-token",
};

async function storedInstance(id) {
  const { instances } = await chrome.storage.sync.get("instances");
  return instances.find((instance) => instance.id === id);
}

before(async () => {
  [v41, v43] = await Promise.all([
    startMockCoolify({ version: "4.1.0" }),
    startMockCoolify({ version: "4.3.1" }),
  ]);
});

after(async () => {
  await Promise.all([v41.stop(), v43.stop()]);
});

beforeEach(async () => {
  stub.reset();
  await Promise.all([v41.reset(), v43.reset()]);
});

test("a v1.4.0 instance without apiMode survives getConfig", async () => {
  await chrome.storage.sync.set({
    instances: [INSTANCE],
    activeInstanceId: "i1",
    autoRefreshEnabled: false,
  });

  assert.deepEqual(await getConfig(), {
    instances: [INSTANCE],
    activeInstanceId: "i1",
  });
  assert.equal(await getAutoRefreshEnabled(), false);
});

test("apiMode legacy and current are kept, other values dropped", async () => {
  await chrome.storage.sync.set({
    instances: [
      { ...INSTANCE, id: "a", apiMode: "legacy" },
      { ...INSTANCE, id: "b", apiMode: "current" },
      { ...INSTANCE, id: "c", apiMode: "banana" },
    ],
    activeInstanceId: "a",
  });

  const { instances } = await getConfig();
  assert.equal(instances[0].apiMode, "legacy");
  assert.equal(instances[1].apiMode, "current");
  assert.ok(!("apiMode" in instances[2]));
});

test("old serverUrl and apiToken keys still migrate", async () => {
  await chrome.storage.sync.set({
    serverUrl: "https://coolify.example.com/",
    apiToken: "token-token-token",
  });

  const config = await getConfig();

  assert.equal(config.instances.length, 1);
  assert.equal(config.instances[0].serverUrl, "https://coolify.example.com");
  assert.equal(config.activeInstanceId, config.instances[0].id);
  assert.deepEqual(await chrome.storage.sync.get(["serverUrl", "apiToken"]), {});
});

test("addInstance and updateInstance accept apiMode", async () => {
  const added = await addInstance({ ...INSTANCE, apiMode: "legacy" });
  assert.equal((await storedInstance(added.id)).apiMode, "legacy");

  const updated = await updateInstance({ ...added, apiMode: "current" });
  assert.equal(updated.apiMode, "current");
  assert.equal((await storedInstance(added.id)).apiMode, "current");
});

test("updateInstance keeps apiMode when not given, and clears it when null", async () => {
  const added = await addInstance({ ...INSTANCE, apiMode: "legacy" });

  const { apiMode, ...withoutMode } = added;
  await updateInstance({ ...withoutMode, name: "Renamed" });
  assert.equal((await storedInstance(added.id)).apiMode, "legacy");

  await updateInstance({ ...withoutMode, apiMode: null });
  assert.ok(!("apiMode" in (await storedInstance(added.id))));
});

test("an added instance without apiMode stores none", async () => {
  const added = await addInstance(INSTANCE);
  assert.ok(!("apiMode" in (await storedInstance(added.id))));
});

async function seedOn(mock) {
  const instance = { ...INSTANCE, serverUrl: mock.url, apiToken: TEST_TOKEN };
  await chrome.storage.sync.set({ instances: [instance], activeInstanceId: "i1" });
  return instance;
}

test("ensureApiMode detects legacy and saves it", async () => {
  const instance = await seedOn(v41);
  assert.equal(await ensureApiMode(instance), "legacy");
  assert.equal((await storedInstance("i1")).apiMode, "legacy");
});

test("ensureApiMode detects current and saves it", async () => {
  const instance = await seedOn(v43);
  assert.equal(await ensureApiMode(instance), "current");
  assert.equal((await storedInstance("i1")).apiMode, "current");
});

test("ensureApiMode falls back to current without saving when unreachable", async () => {
  const instance = { ...INSTANCE, serverUrl: "http://127.0.0.1:9" };
  await chrome.storage.sync.set({ instances: [instance], activeInstanceId: "i1" });

  assert.equal(await ensureApiMode(instance), "current");
  assert.ok(!("apiMode" in (await storedInstance("i1"))));
});

test("ensureApiMode falls back to current without saving on a bad token", async () => {
  const instance = { ...(await seedOn(v41)), apiToken: "wrong-token" };

  assert.equal(await ensureApiMode(instance), "current");
  assert.ok(!("apiMode" in (await storedInstance("i1"))));
});

test("ensureApiMode makes no request when apiMode is set", async () => {
  const instance = await seedOn(v43);

  assert.equal(await ensureApiMode({ ...instance, apiMode: "legacy" }), "legacy");
  assert.deepEqual(await v43.requests(), []);
});

test("ensureApiMode only touches its own instance", async () => {
  const first = { ...INSTANCE, serverUrl: v41.url, apiToken: TEST_TOKEN };
  const other = { ...INSTANCE, id: "i2", name: "Other" };
  await chrome.storage.sync.set({ instances: [first, other], activeInstanceId: "i1" });

  await ensureApiMode(first);

  assert.equal((await storedInstance("i1")).apiMode, "legacy");
  assert.deepEqual(await storedInstance("i2"), other);
});

test("ensureApiMode does not bring back an instance removed meanwhile", async () => {
  const instance = { ...INSTANCE, serverUrl: v41.url, apiToken: TEST_TOKEN };
  await chrome.storage.sync.set({ instances: [], activeInstanceId: null });

  assert.equal(await ensureApiMode(instance), "legacy");
  assert.deepEqual((await chrome.storage.sync.get("instances")).instances, []);
});

test("autoRefresh defaults to true", async () => {
  assert.equal(await getAutoRefreshEnabled(), true);

  await setAutoRefreshEnabled(false);
  assert.equal(await getAutoRefreshEnabled(), false);
  assert.deepEqual(await chrome.storage.sync.get("autoRefreshEnabled"), {
    autoRefreshEnabled: false,
  });
});

test("onAutoRefreshChanged reports the value and stops after unsubscribe", async () => {
  const seen = [];
  const unsubscribe = onAutoRefreshChanged((enabled) => seen.push(enabled));

  await setAutoRefreshEnabled(false);
  await setAutoRefreshEnabled(true);
  unsubscribe();
  await setAutoRefreshEnabled(false);

  assert.deepEqual(seen, [false, true]);
});

test("onConfigChanged fires on instances and active instance only", async () => {
  let count = 0;
  const unsubscribe = onConfigChanged(() => count++);

  await chrome.storage.sync.set({ instances: [INSTANCE] });
  await chrome.storage.sync.set({ activeInstanceId: "i1" });
  await setAutoRefreshEnabled(false);
  await chrome.storage.session.set({ instances: [] });
  assert.equal(count, 2);

  unsubscribe();
  await chrome.storage.sync.set({ activeInstanceId: null });
  assert.equal(count, 2);
});
