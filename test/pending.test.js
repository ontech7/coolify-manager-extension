import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { PENDING_ACTION_TIMEOUT, PENDING_DEPLOY_TIMEOUT } from "../lib/constants.js";
import {
  onPendingChanged,
  prunePending,
  readPending,
  setPendingEntry,
  updatePending,
} from "../lib/pending.js";
import { installChromeStub } from "./helpers/chrome-stub.js";

const stub = installChromeStub();

beforeEach(() => stub.reset());

const SINCE = 1000;
const FETCH = 2000;
const NOW = 3000;

const deploying = { kind: "deploying", deploymentUuid: "d1", since: SINCE };

test("a deploying entry stays while its deployment is active", () => {
  const pending = { a: deploying };
  const active = [{ deployment_uuid: "d1" }];
  assert.equal(prunePending(pending, [], active, FETCH, NOW), pending);
});

test("a deploying entry drops when the deployment left the active list", () => {
  const active = [{ deployment_uuid: "other" }];
  assert.deepEqual(prunePending({ a: deploying }, [], active, FETCH, NOW), {});
});

test("a deploying entry is kept when the active list is unknown", () => {
  const pending = { a: deploying };
  assert.equal(prunePending(pending, [], null, FETCH, NOW), pending);
});

test("a deploying entry drops after PENDING_DEPLOY_TIMEOUT", () => {
  const now = SINCE + PENDING_DEPLOY_TIMEOUT + 1;
  assert.deepEqual(prunePending({ a: deploying }, [], null, FETCH, now), {});
});

test("a deploying entry is kept until PENDING_DEPLOY_TIMEOUT", () => {
  const pending = { a: deploying };
  const now = SINCE + PENDING_DEPLOY_TIMEOUT;
  assert.equal(prunePending(pending, [], null, FETCH, now), pending);
});

test("starting drops when the resource runs, stopping when it no longer does", () => {
  const starting = { a: { kind: "starting", since: SINCE } };
  const stopping = { a: { kind: "stopping", since: SINCE } };
  const running = [{ uuid: "a", status: "running:healthy" }];
  const stopped = [{ uuid: "a", status: "exited:unhealthy" }];

  assert.deepEqual(prunePending(starting, running, null, FETCH, NOW), {});
  assert.equal(prunePending(starting, stopped, null, FETCH, NOW), starting);
  assert.deepEqual(prunePending(stopping, stopped, null, FETCH, NOW), {});
  assert.equal(prunePending(stopping, running, null, FETCH, NOW), stopping);
});

test("starting is kept when the resource is missing from a failed list", () => {
  const pending = { a: { kind: "starting", since: SINCE } };
  assert.equal(prunePending(pending, [], null, FETCH, NOW), pending);
});

test("an action entry drops after PENDING_ACTION_TIMEOUT", () => {
  const pending = { a: { kind: "stopping", since: SINCE } };
  const running = [{ uuid: "a", status: "running:healthy" }];
  const now = SINCE + PENDING_ACTION_TIMEOUT + 1;
  assert.deepEqual(prunePending(pending, running, null, FETCH, now), {});
});

test("entries newer than the fetch are kept", () => {
  const pending = {
    a: { kind: "starting", since: FETCH + 1 },
    b: { ...deploying, since: FETCH + 1 },
  };
  const running = [{ uuid: "a", status: "running:healthy" }];
  assert.equal(prunePending(pending, running, [], FETCH, NOW), pending);
});

test("returns the same object when nothing changed", () => {
  const pending = {};
  assert.equal(prunePending(pending, [], [], FETCH, NOW), pending);
});

test("only the finished entries are dropped", () => {
  const pending = {
    a: { kind: "starting", since: SINCE },
    b: { kind: "stopping", since: SINCE },
  };
  const resources = [
    { uuid: "a", status: "running:healthy" },
    { uuid: "b", status: "running:healthy" },
  ];
  assert.deepEqual(prunePending(pending, resources, null, FETCH, NOW), {
    b: pending.b,
  });
});

test("pending is stored per instance", async () => {
  const entry = { kind: "stopping", since: 1 };
  await setPendingEntry("i1", "a", entry);

  assert.deepEqual(await readPending("i1"), { a: entry });
  assert.deepEqual(await readPending("i2"), {});
  assert.deepEqual(await chrome.storage.session.get("pending:i1"), {
    "pending:i1": { a: entry },
  });
});

test("concurrent writes don't lose entries", async () => {
  const entry = { kind: "stopping", since: 1 };
  await Promise.all(
    ["a", "b", "c", "d"].map((uuid) => setPendingEntry("i1", uuid, entry)),
  );
  assert.deepEqual(Object.keys(await readPending("i1")).sort(), ["a", "b", "c", "d"]);
});

test("updatePending doesn't write when the update returns the same object", async () => {
  await setPendingEntry("i1", "a", { kind: "stopping", since: 1 });

  let notified = 0;
  onPendingChanged("i1", () => notified++);
  await updatePending("i1", (current) => current);

  assert.equal(notified, 0);
});

test("onPendingChanged reports that instance only, until unsubscribed", async () => {
  const seen = [];
  const unsubscribe = onPendingChanged("i1", (next) => seen.push(next));
  const entry = { kind: "stopping", since: 1 };

  await setPendingEntry("i2", "x", entry);
  await setPendingEntry("i1", "a", entry);
  unsubscribe();
  await setPendingEntry("i1", "b", entry);

  assert.deepEqual(seen, [{ a: entry }]);
});
