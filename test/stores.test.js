import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { AUTO_REFRESH_INTERVAL } from "../lib/constants.js";
import { readPending, setPendingEntry } from "../lib/pending.js";
import { createListStore } from "../ui/list-store.js";
import { createResourcesStore } from "../ui/resources-store.js";
import { settleResourcePending, watchResourcePending } from "../ui/screens/shared.js";
import { installChromeStub } from "./helpers/chrome-stub.js";

const stub = installChromeStub();
globalThis.document = Object.assign(new EventTarget(), { hidden: false });

const INSTANCE_ID = "i1";

/** Lets pending promises settle. setImmediate isn't mocked. */
const flush = () => new Promise((resolve) => setImmediate(resolve));

async function advance(ms) {
  mock.timers.tick(ms);
  await flush();
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const fakeCtx = (api) => ({
  instance: { id: INSTANCE_ID },
  api: {
    getApplications: async () => [],
    getDatabases: async () => [],
    getServices: async () => [],
    getDeployments: async () => [],
    ...api,
  },
});

beforeEach(() => {
  stub.reset();
  mock.timers.reset();
  mock.timers.enable({ apis: ["setTimeout"] });
});

afterEach(() => mock.timers.reset());

test("a list slower than the interval isn't asked for twice at first", async () => {
  const answer = deferred();
  let calls = 0;
  const store = createListStore(() => {
    calls++;
    return answer.promise;
  });

  const started = store.start();
  await flush();
  await advance(AUTO_REFRESH_INTERVAL * 2);
  assert.equal(calls, 1);

  answer.resolve(["a"]);
  await started;
  assert.deepEqual(store.get().items, ["a"]);

  await advance(AUTO_REFRESH_INTERVAL);
  assert.equal(calls, 2, "polling starts after the first answer");
  store.stop();
});

test("resources slower than the interval aren't asked for twice at first", async () => {
  const answer = deferred();
  let calls = 0;
  const store = createResourcesStore(
    fakeCtx({
      getApplications() {
        calls++;
        return answer.promise;
      },
    }),
  );

  const started = store.start();
  await flush();
  await advance(AUTO_REFRESH_INTERVAL * 2);
  assert.equal(calls, 1);

  answer.resolve([]);
  await started;
  assert.equal(store.get().isLoading, false);

  await advance(AUTO_REFRESH_INTERVAL);
  assert.equal(calls, 2, "polling starts after the first answer");
  store.stop();
});

test("polling still starts when showing the first answer fails", async () => {
  let calls = 0;
  const store = createListStore(async () => {
    calls++;
    return [];
  });
  const unsubscribe = store.subscribe(() => {
    throw new Error("render failed");
  });

  await assert.rejects(store.start(), /render failed/);
  unsubscribe();

  await advance(AUTO_REFRESH_INTERVAL);
  assert.equal(calls, 2);
  store.stop();
});

test("stopping during the first load doesn't start polling", async () => {
  const answer = deferred();
  let calls = 0;
  const store = createListStore(() => {
    calls++;
    return answer.promise;
  });

  const started = store.start();
  await flush();
  store.stop();
  answer.resolve([]);
  await started;

  await advance(AUTO_REFRESH_INTERVAL * 2);
  assert.equal(calls, 1);
});

const RESOURCE = { name: "res", status: "running:healthy" };

test("a list that fails keeps its items, under a banner", async () => {
  let fails = false;
  const store = createResourcesStore(
    fakeCtx({
      async getApplications() {
        if (fails) throw new Error("Server Error");
        return [{ ...RESOURCE, uuid: "a1" }];
      },
      getDatabases: async () => [{ ...RESOURCE, uuid: "d1" }],
    }),
  );

  await store.start();
  assert.equal(store.get().error, null);

  fails = true;
  await store.refresh();
  assert.deepEqual(store.get().resources.map((r) => r.uuid).sort(), ["a1", "d1"]);
  assert.equal(store.get().error, "Server Error");

  fails = false;
  await store.refresh();
  assert.equal(store.get().error, null);
  store.stop();
});

test("a list that fails on the first load leaves the others, under a banner", async () => {
  const store = createResourcesStore(
    fakeCtx({
      getApplications: async () => {
        throw new Error("Server Error");
      },
      getDatabases: async () => [{ ...RESOURCE, uuid: "d1" }],
    }),
  );

  await store.start();

  assert.deepEqual(store.get().resources.map((r) => r.uuid), ["d1"]);
  assert.equal(store.get().error, "Server Error");
  store.stop();
});

test("items kept from an older answer don't settle a pending entry", async () => {
  let fails = false;
  const store = createResourcesStore(
    fakeCtx({
      async getApplications() {
        if (fails) throw new Error("Server Error");
        return [{ ...RESOURCE, uuid: "a1", status: "exited" }];
      },
    }),
  );
  await store.start();

  fails = true;
  await setPendingEntry(INSTANCE_ID, "a1", { kind: "stopping", since: Date.now() - 1000 });
  await store.refresh();

  assert.equal(store.get().resources[0].pending?.kind, "stopping");
  store.stop();
});

test("a detail screen drops the pending entry its data answers", async () => {
  await setPendingEntry(INSTANCE_ID, "d1", { kind: "stopping", since: Date.now() - 1000 });

  await settleResourcePending(fakeCtx(), { uuid: "d1", status: "running:healthy" }, Date.now());
  assert.equal((await readPending(INSTANCE_ID)).d1?.kind, "stopping");

  await settleResourcePending(fakeCtx(), { uuid: "d1", status: "exited" }, Date.now());
  assert.equal((await readPending(INSTANCE_ID)).d1, undefined);
});

test("a detail screen drops a pending entry that has expired", async () => {
  await setPendingEntry(INSTANCE_ID, "d1", { kind: "stopping", since: Date.now() - 3600000 });

  await settleResourcePending(fakeCtx(), { uuid: "d1", status: "running:healthy" }, Date.now());

  assert.equal((await readPending(INSTANCE_ID)).d1, undefined);
});

test("a detail screen asks for deployments only for a deploying entry", async () => {
  let asked = 0;
  const ctx = fakeCtx({
    async getDeployments() {
      asked++;
      return [];
    },
  });

  await setPendingEntry(INSTANCE_ID, "a1", { kind: "stopping", since: Date.now() - 1000 });
  await settleResourcePending(ctx, { uuid: "a1", status: "running:healthy" }, Date.now());
  assert.equal(asked, 0);

  await setPendingEntry(INSTANCE_ID, "a1", {
    kind: "deploying",
    deploymentUuid: "dep-1",
    since: Date.now() - 1000,
  });
  await settleResourcePending(ctx, { uuid: "a1", status: "running:healthy" }, Date.now());
  assert.equal(asked, 1);
  assert.equal((await readPending(INSTANCE_ID)).a1, undefined, "that deployment is over");
});

test("a detail screen looks again while the entry is pending", async () => {
  await setPendingEntry(INSTANCE_ID, "d1", { kind: "stopping", since: Date.now() - 1000 });
  let reloads = 0;
  const seen = [];
  const stop = watchResourcePending(fakeCtx(), "d1", (entry) => seen.push(entry?.kind ?? null), async () => {
    reloads++;
    if (reloads === 2) {
      await settleResourcePending(fakeCtx(), { uuid: "d1", status: "exited" }, Date.now());
    }
  });
  await flush();
  assert.equal(seen.at(-1), "stopping");

  await advance(AUTO_REFRESH_INTERVAL);
  assert.equal(reloads, 1);
  await advance(AUTO_REFRESH_INTERVAL);
  assert.equal(reloads, 2);
  assert.equal(seen.at(-1), null);

  await advance(AUTO_REFRESH_INTERVAL * 2);
  assert.equal(reloads, 2, "nothing is pending any more");
  stop();
});

test("with Auto-refresh off a detail screen doesn't look again", async () => {
  await chrome.storage.sync.set({ autoRefreshEnabled: false });
  await setPendingEntry(INSTANCE_ID, "d1", { kind: "stopping", since: Date.now() - 1000 });
  let reloads = 0;
  const stop = watchResourcePending(fakeCtx(), "d1", () => {}, async () => {
    reloads++;
  });
  await flush();

  await advance(AUTO_REFRESH_INTERVAL * 2);

  assert.equal(reloads, 0);
  stop();
});

test("a detail screen stops looking when it goes away", async () => {
  await setPendingEntry(INSTANCE_ID, "d1", { kind: "stopping", since: Date.now() - 1000 });
  let reloads = 0;
  const stop = watchResourcePending(fakeCtx(), "d1", () => {}, async () => {
    reloads++;
  });
  await flush();

  stop();
  await advance(AUTO_REFRESH_INTERVAL * 2);

  assert.equal(reloads, 0);
});

test("a dashboard section without reload doesn't poll", async () => {
  await setPendingEntry(INSTANCE_ID, "d1", { kind: "stopping", since: Date.now() - 1000 });
  const seen = [];
  const stop = watchResourcePending(fakeCtx(), "d1", (entry) => seen.push(entry?.kind ?? null));
  await flush();
  await advance(AUTO_REFRESH_INTERVAL * 2);
  assert.equal(seen.at(-1), "stopping");
  stop();
});

test("deployments that aren't a list still repaint, and keep the pending entry", async () => {
  await setPendingEntry(INSTANCE_ID, "a1", {
    kind: "deploying",
    deploymentUuid: "dep-1",
    since: Date.now() - 1000,
  });
  const store = createResourcesStore(
    fakeCtx({
      getApplications: async () => [
        { uuid: "a1", name: "app", status: "running:healthy" },
      ],
      getDeployments: async () => ({ message: "a proxy's JSON" }),
    }),
  );
  let paints = 0;
  store.subscribe(() => paints++);

  await store.start();
  const paintsBeforeRefresh = paints;
  await store.refresh();

  assert.equal(paints, paintsBeforeRefresh + 1);
  assert.equal(store.get().resources[0].pending?.kind, "deploying");
  store.stop();
});
