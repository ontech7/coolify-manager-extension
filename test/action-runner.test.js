import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import {
  ACTION_NAMES,
  clearActionError,
  consumeActionErrors,
  handleRunAction,
  runAction,
} from "../lib/action-runner.js";
import { createActionsClient } from "../lib/actions-client.js";
import { UnsupportedVersionError } from "../lib/coolify-api.js";
import { readPending } from "../lib/pending.js";
import { installChromeStub } from "./helpers/chrome-stub.js";
import { startMockCoolify, TEST_TOKEN } from "./mock-coolify/server.js";

const stub = installChromeStub();

let v41;
let v42;
let v43;

before(async () => {
  [v41, v42, v43] = await Promise.all([
    startMockCoolify({ version: "4.1.0" }),
    startMockCoolify({ version: "4.2.0" }),
    startMockCoolify({ version: "4.3.1" }),
  ]);
});

after(async () => {
  await Promise.all([v41.stop(), v42.stop(), v43.stop()]);
});

beforeEach(async () => {
  stub.reset();
  await Promise.all([v41.reset(), v42.reset(), v43.reset()]);
});

async function seed(mock, extra = {}) {
  await chrome.storage.sync.set({
    instances: [
      {
        id: "i1",
        name: "One",
        serverUrl: mock.url,
        apiToken: TEST_TOKEN,
        apiMode: "current",
        ...extra,
      },
      { id: "i2", name: "Two", serverUrl: mock.url, apiToken: TEST_TOKEN },
    ],
    activeInstanceId: "i1",
  });
}

/** Answers every method with `value`, and records the calls. */
function fakeApi(value) {
  const calls = [];
  return {
    calls,
    api: new Proxy(
      {},
      {
        get: (_, name) => async (...args) => {
          calls.push([name, ...args]);
          if (value instanceof Error) throw value;
          return value;
        },
      },
    ),
  };
}

// The pending table of the plan.
const PENDING_CASES = [
  ["startApplication", ["a"], { deployment_uuid: "dep-1" }, { kind: "deploying", deploymentUuid: "dep-1" }],
  ["restartApplication", ["a"], { deployment_uuid: "dep-1" }, { kind: "deploying", deploymentUuid: "dep-1" }],
  [
    "deployApplication",
    ["a"],
    { deployments: [{ deployment_uuid: "dep-1" }] },
    { kind: "deploying", deploymentUuid: "dep-1" },
  ],
  [
    "rollbackApplication",
    ["a", "abc"],
    { deployment_uuid: "dep-1" },
    { kind: "deploying", deploymentUuid: "dep-1" },
  ],
  ["startDatabase", ["a"], undefined, { kind: "starting" }],
  ["startService", ["a"], undefined, { kind: "starting" }],
  ["stopApplication", ["a"], undefined, { kind: "stopping" }],
  ["stopDatabase", ["a"], undefined, { kind: "stopping" }],
  ["stopService", ["a"], undefined, { kind: "stopping" }],
];

const NO_PENDING = [
  "restartDatabase",
  "restartService",
  "pullLatestImagesService",
  "cancelDeployment",
  "runDatabaseBackup",
  "serviceContainerAction",
  "validateServer",
  "restartProxy",
  "runDockerCleanup",
];

test("every action of the table is allowed, and nothing else", () => {
  assert.deepEqual(
    [...ACTION_NAMES].sort(),
    [...PENDING_CASES.map(([name]) => name), ...NO_PENDING].sort(),
  );
});

test("deploy returns a deploying entry", async () => {
  for (const [name, args, value, entry] of PENDING_CASES) {
    const before = Date.now();
    const result = await runAction(fakeApi(value).api, name, args);

    assert.equal(result.ok, true, name);
    assert.equal(result.pending.uuid, args[0], name);
    const { since, ...fields } = result.pending.entry;
    assert.deepEqual(fields, entry, name);
    assert.ok(since >= before, name);
  }
});

test("start without a uuid returns no entry", async () => {
  for (const name of ["startApplication", "restartApplication"]) {
    const result = await runAction(fakeApi(undefined).api, name, ["a"]);
    assert.deepEqual(result, { ok: true, data: undefined, pending: null }, name);
  }
  const deploy = await runAction(fakeApi({}).api, "deployApplication", ["a"]);
  assert.equal(deploy.pending, null);
  const rollback = await runAction(fakeApi(null).api, "rollbackApplication", ["a", "b"]);
  assert.equal(rollback.pending, null);
});

test("stopDatabase returns a stopping entry", async () => {
  const result = await runAction(fakeApi(undefined).api, "stopDatabase", ["d"]);
  assert.equal(result.pending.entry.kind, "stopping");
  assert.equal(result.pending.uuid, "d");
});

test("the other actions return no entry", async () => {
  for (const name of NO_PENDING) {
    const result = await runAction(fakeApi({ message: "ok" }).api, name, ["a"]);
    assert.equal(result.ok, true, name);
    assert.equal(result.pending, null, name);
  }
});

test("an unknown action is refused", async () => {
  for (const name of ["getApplications", "constructor", "request", "__proto__"]) {
    const { api, calls } = fakeApi("x");
    const result = await runAction(api, name, ["a"]);
    assert.equal(result.ok, false, name);
    assert.equal(result.unsupported, false, name);
    assert.deepEqual(calls, [], name);
  }
});

test("a failed action reports its message", async () => {
  const result = await runAction(fakeApi(new Error("Server Error")).api, "stopDatabase", ["d"]);
  assert.deepEqual(result, {
    ok: false,
    message: "Server Error",
    unsupported: false,
  });
});

test("UnsupportedVersionError sets unsupported", async () => {
  const error = new UnsupportedVersionError("4.3.0");
  const result = await runAction(fakeApi(error).api, "restartProxy", ["s"]);
  assert.deepEqual(result, {
    ok: false,
    message: "This action requires Coolify 4.3.0 or newer.",
    unsupported: true,
  });
});

test("handleRunAction writes pending for that instance only", async () => {
  await seed(v43);

  const result = await handleRunAction({
    instanceId: "i1",
    action: "stopDatabase",
    args: ["d-pg"],
    label: "Stop postgres-main",
  });

  assert.equal(result.ok, true);
  assert.equal(result.errorId, undefined);
  assert.equal((await readPending("i1"))["d-pg"].kind, "stopping");
  assert.deepEqual(await readPending("i2"), {});
});

test("handleRunAction stores the error until cleared", async () => {
  await seed(v43);
  await v43.control({ failPaths: ["/databases"] });

  const result = await handleRunAction({
    instanceId: "i1",
    action: "stopDatabase",
    args: ["d-pg"],
    label: "Stop postgres-main",
  });

  assert.equal(result.ok, false);
  assert.equal(result.message, "Server Error");
  assert.ok(result.errorId);
  assert.deepEqual(await readPending("i1"), {});

  await clearActionError("i1", "someone-else");
  assert.equal((await chrome.storage.session.get(null))["actionErrors:i1"].length, 1);

  await clearActionError("i1", result.errorId);
  assert.deepEqual(await consumeActionErrors("i1"), []);
});

test("consumeActionErrors returns the errors once", async () => {
  await seed(v43);
  await v43.control({ failPaths: ["/databases"] });

  const result = await handleRunAction({
    instanceId: "i1",
    action: "stopDatabase",
    args: ["d-pg"],
    label: "Stop postgres-main",
  });

  assert.deepEqual(await consumeActionErrors("i2"), []);
  assert.deepEqual(await consumeActionErrors("i1"), [
    { id: result.errorId, label: "Stop postgres-main", message: "Server Error" },
  ]);
  assert.deepEqual(await consumeActionErrors("i1"), []);
});

test("handleRunAction uses the method of the instance's apiMode", async () => {
  await seed(v41, { apiMode: "legacy" });

  await handleRunAction({ instanceId: "i1", action: "stopDatabase", args: ["d-pg"] });

  const [request] = await v41.requests();
  assert.equal(request.method, "GET");
});

test("handleRunAction detects the mode of an instance without one", async () => {
  await seed(v41, { apiMode: undefined });

  const result = await handleRunAction({
    instanceId: "i1",
    action: "stopDatabase",
    args: ["d-pg"],
  });

  assert.equal(result.ok, true);
  const requests = await v41.requests();
  assert.deepEqual(
    requests.map((r) => r.method),
    ["GET", "GET"],
  );
  const { instances } = await chrome.storage.sync.get("instances");
  assert.equal(instances[0].apiMode, "legacy");
});

test("handleRunAction reports an instance removed meanwhile", async () => {
  await seed(v43);

  const result = await handleRunAction({
    instanceId: "gone",
    action: "stopDatabase",
    args: ["d-pg"],
  });

  assert.equal(result.ok, false);
  assert.equal(result.message, "This instance no longer exists.");
  assert.deepEqual(await v43.requests(), []);
});

test("args that aren't a list are refused without a request", async () => {
  await seed(v43);

  const result = await handleRunAction({
    instanceId: "i1",
    action: "stopDatabase",
    args: "d-pg",
  });

  assert.equal(result.ok, false);
  assert.deepEqual(await v43.requests(), []);
});

function connectServiceWorker() {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    handleRunAction(message).then(sendResponse);
    return true;
  });
}

test("the client returns the data of the action", async () => {
  await seed(v43);
  connectServiceWorker();

  const data = await createActionsClient("i1").run("deployApplication", ["a-api"]);

  assert.match(data.deployments[0].deployment_uuid, /^dep-new-/);
  assert.equal(
    (await readPending("i1"))["a-api"].deploymentUuid,
    data.deployments[0].deployment_uuid,
  );
});

test("the client throws the message and clears the error it delivered", async () => {
  await seed(v43);
  await v43.control({ failPaths: ["/databases"] });
  connectServiceWorker();

  await assert.rejects(
    createActionsClient("i1").run("stopDatabase", ["d-pg"], { label: "Stop" }),
    (error) => {
      assert.ok(!(error instanceof UnsupportedVersionError));
      assert.equal(error.message, "Server Error");
      return true;
    },
  );
  assert.deepEqual(await consumeActionErrors("i1"), []);
});

test("the client throws UnsupportedVersionError when unsupported", async () => {
  await seed(v42);
  connectServiceWorker();

  await assert.rejects(
    createActionsClient("i1").run("restartProxy", ["srv-prod"]),
    (error) => {
      assert.ok(error instanceof UnsupportedVersionError);
      assert.equal(error.message, "This action requires Coolify 4.3.0 or newer.");
      return true;
    },
  );
});

const stopRequests = async (mock) =>
  (await mock.requests())
    .filter((request) => request.path === "/api/v1/databases/d-pg/stop")
    .map((request) => request.method);

const STOP = { instanceId: "i1", action: "stopDatabase", args: ["d-pg"], label: "Stop" };

test("a saved legacy mode recovers when the server has been upgraded", async () => {
  await seed(v43, { apiMode: "legacy" });

  const result = await handleRunAction(STOP);

  assert.equal(result.ok, true);
  assert.deepEqual(await stopRequests(v43), ["GET", "POST"]);
  const { instances } = await chrome.storage.sync.get("instances");
  assert.equal(instances[0].apiMode, "current");
});

test("a saved current mode recovers on an older server", async () => {
  await seed(v41, { apiMode: "current" });

  const result = await handleRunAction(STOP);

  assert.equal(result.ok, true);
  assert.deepEqual(await stopRequests(v41), ["POST", "GET"]);
});

test("a 405 with the right mode stays an error", async () => {
  await seed(v43);
  await v43.control({
    failPaths: ["/databases/d-pg/stop"],
    failStatus: 405,
    failMessage: "No.",
  });

  const result = await handleRunAction(STOP);

  assert.equal(result.ok, false);
  assert.equal(result.message, "No.");
  assert.deepEqual(await stopRequests(v43), ["POST"]);
});

test("a storage failure still gets an answer", async () => {
  const { get } = chrome.storage.sync;
  chrome.storage.sync.get = async () => {
    throw new Error("Storage is down");
  };
  try {
    const result = await handleRunAction(STOP);
    assert.equal(result.ok, false);
    assert.equal(result.message, "Storage is down");
  } finally {
    chrome.storage.sync.get = get;
  }
});

test("a deployment Coolify skipped leaves no pending entry", async () => {
  await seed(v43);
  await v43.control({ skipDeployments: true });

  const result = await handleRunAction({
    instanceId: "i1",
    action: "startApplication",
    args: ["a-api"],
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.message, "Deployment already queued for this commit.");
  assert.deepEqual(await readPending("i1"), {});
});

test("the client says so when the message itself fails", async () => {
  const { sendMessage } = chrome.runtime;
  chrome.runtime.sendMessage = async () => {
    throw new Error("A listener indicated an asynchronous response");
  };
  try {
    await assert.rejects(
      createActionsClient("i1").run("stopDatabase", ["d-pg"]),
      /did not answer/i,
    );
  } finally {
    chrome.runtime.sendMessage = sendMessage;
  }
});

test("the client turns a missing answer into an error", async () => {
  // No listener at all: the service worker didn't answer.
  await assert.rejects(
    createActionsClient("i1").run("stopDatabase", ["d-pg"]),
    /did not answer/i,
  );
});
