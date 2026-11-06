import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { AUTO_REFRESH_INTERVAL } from "../lib/constants.js";
import { setPendingEntry } from "../lib/pending.js";
import { createListStore } from "../ui/list-store.js";
import { createResourcesStore } from "../ui/resources-store.js";
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
