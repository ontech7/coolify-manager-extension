import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { CoolifyAPI, HttpError, UnsupportedVersionError } from "../lib/coolify-api.js";
import { startMockCoolify, TEST_TOKEN } from "./mock-coolify/server.js";

let v41;
let v42;
let v43;

const legacyApi = () => new CoolifyAPI(v41.url, TEST_TOKEN, "legacy");
const apiOn = (mock, options) =>
  new CoolifyAPI(mock.url, TEST_TOKEN, "current", options);

/** The last request the mock received, without the /api/v1 prefix. */
async function lastRequest(mock) {
  const requests = await mock.requests();
  const { method, path, body } = requests[requests.length - 1];
  return { method, path: path.replace("/api/v1", ""), body };
}

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
  await Promise.all([v41.reset(), v42.reset(), v43.reset()]);
});

test("legacy actions use GET", async () => {
  await legacyApi().stopApplication("a-store");
  assert.deepEqual(await lastRequest(v41), {
    method: "GET",
    path: "/applications/a-store/stop",
    body: null,
  });
});

test("current actions use POST", async () => {
  await apiOn(v43).stopApplication("a-store");
  assert.equal((await lastRequest(v43)).method, "POST");
});

test("the wrong verb is refused by the mock, as by a real server", async () => {
  await assert.rejects(
    new CoolifyAPI(v43.url, TEST_TOKEN, "legacy").stopApplication("a-store"),
    /Method not allowed/,
  );
});

test("apiMode defaults to current", async () => {
  await new CoolifyAPI(v43.url, TEST_TOKEN).stopApplication("a-store");
  assert.equal((await lastRequest(v43)).method, "POST");
});

test("legacy deploy only sends force when set", async () => {
  await legacyApi().deployApplication("a-api");
  assert.equal((await lastRequest(v41)).path, "/deploy?uuid=a-api");

  await legacyApi().deployApplication("a-api", true);
  assert.equal((await lastRequest(v41)).path, "/deploy?uuid=a-api&force=true");
});

test("current deploy sends the body", async () => {
  await apiOn(v43).deployApplication("a-api");
  assert.deepEqual(await lastRequest(v43), {
    method: "POST",
    path: "/deploy",
    body: { uuid: "a-api" },
  });

  await apiOn(v43).deployApplication("a-api", true);
  assert.deepEqual((await lastRequest(v43)).body, { uuid: "a-api", force: true });
});

test("deploy returns the queued deployment", async () => {
  const result = await apiOn(v43).deployApplication("a-api");
  assert.match(result.deployments[0].deployment_uuid, /^dep-new-/);
});

test("startApplication returns the deployment uuid", async () => {
  const { deployment_uuid: started } = await apiOn(v43).startApplication("a-api");
  assert.match(started, /^dep-new-/);
  const { deployment_uuid: restarted } = await apiOn(v43).restartApplication("a-store");
  assert.match(restarted, /^dep-new-/);
});

test("a deployment Coolify skipped returns its message", async () => {
  await v43.control({ skipDeployments: true });
  assert.deepEqual(await apiOn(v43).startApplication("a-api"), {
    message: "Deployment already queued for this commit.",
  });
});

test("a list answered with something else is an unexpected response", async () => {
  await v43.control({ mode: "object" });
  for (const name of ["getApplications", "getDatabases", "getServices", "getServers", "getDeployments"]) {
    await assert.rejects(apiOn(v43)[name](), /Unexpected response from server/, name);
  }
});

test("testConnection fails on JSON that isn't the list", async () => {
  await v43.control({ mode: "object" });
  const result = await apiOn(v43).testConnection();
  assert.equal(result.success, false);
  assert.match(result.error, /Unexpected response/);
});

test("credentials in the URL never reach an error message", async () => {
  const url = v43.url.replace("http://", "http://user:s3cret@");
  await assert.rejects(new CoolifyAPI(url, TEST_TOKEN).getApplications(), (error) => {
    assert.equal(error.message.includes("s3cret"), false, error.message);
    assert.match(error.message, /Unable to connect/);
    return true;
  });
});

test("getVersion strips the v and returns null on 401", async () => {
  const mock = await startMockCoolify({ version: "v4.3.1\n" });
  try {
    assert.equal(await apiOn(mock).getVersion(), "4.3.1");
  } finally {
    await mock.stop();
  }
  assert.equal(await new CoolifyAPI(v43.url, "wrong-token").getVersion(), null);
});

test("testConnection reports success and failure", async () => {
  assert.deepEqual(await apiOn(v43).testConnection(), { success: true });
  assert.deepEqual(await new CoolifyAPI(v43.url, "wrong-token").testConnection(), {
    success: false,
    error: "Unauthenticated.",
  });
});

test("new endpoint on an old server is an UnsupportedVersionError", async () => {
  await assert.rejects(apiOn(v42).getRollbackImages("a-store"), (error) => {
    assert.ok(error instanceof UnsupportedVersionError);
    assert.equal(error.message, "This action requires Coolify 4.3.0 or newer.");
    return true;
  });
  await assert.rejects(legacyApi().getDatabaseLogs("d-pg"), (error) => {
    assert.ok(error instanceof UnsupportedVersionError);
    assert.equal(error.message, "This action requires Coolify 4.2.0 or newer.");
    return true;
  });
});

test("a specific 404 passes through", async () => {
  await assert.rejects(apiOn(v43).getRollbackImages("missing"), (error) => {
    assert.ok(error instanceof HttpError);
    assert.ok(!(error instanceof UnsupportedVersionError));
    assert.equal(error.status, 404);
    assert.equal(error.message, "Application not found.");
    return true;
  });
});

test("html body gives the proxy message", async () => {
  await v43.control({ mode: "html" });
  await assert.rejects(
    apiOn(v43).getApplications(),
    /^Error: Unexpected response from server\. Check the URL — is it behind a login page or proxy\?$/,
  );
});

test("a hanging server times out", async () => {
  await v43.control({ mode: "hang" });
  await assert.rejects(
    apiOn(v43, { requestTimeout: 100 }).getApplications(),
    /^Error: Connection timeout\. Server took too long to respond\.$/,
  );
});

test("a stalled response body times out", async () => {
  await v43.control({ mode: "stall" });
  await assert.rejects(
    apiOn(v43, { bodyTimeout: 100 }).getApplications(),
    /^Error: Connection timeout\. Server took too long to respond\.$/,
  );
});

test("a closed port gives the connection message", async () => {
  await assert.rejects(
    new CoolifyAPI("http://127.0.0.1:9", TEST_TOKEN).getApplications(),
    /^Error: Unable to connect to server\. Please check URL and connection\.$/,
  );
});

test("401 surfaces the server message", async () => {
  await assert.rejects(new CoolifyAPI(v43.url, "wrong").getApplications(), {
    message: "Unauthenticated.",
    status: 401,
  });
});

test("a status without a message falls back to the status", async () => {
  await v43.control({ failPaths: ["/servers"] });
  await assert.rejects(apiOn(v43).getServers(), { message: "Server Error" });
});

test("uuids are URL encoded", async () => {
  await assert.rejects(apiOn(v43).getApplication("a/b"), { status: 404 });
  assert.equal((await lastRequest(v43)).path, "/applications/a%2Fb");
});

// Every method of the app's client: name, arguments, verb and path.
const METHOD_TABLE = [
  ["getApplications", [], "GET", "/applications"],
  ["getApplication", ["a-store"], "GET", "/applications/a-store"],
  ["getApplicationLogs", ["a-store", 50], "GET", "/applications/a-store/logs?lines=50"],
  ["getRollbackImages", ["a-store"], "GET", "/applications/a-store/rollback-images"],
  ["rollbackApplication", ["a-store", "abc"], "POST", "/applications/a-store/rollback"],
  ["startApplication", ["a-api"], "POST", "/applications/a-api/start"],
  ["restartApplication", ["a-store"], "POST", "/applications/a-store/restart"],
  ["getDeployments", [], "GET", "/deployments"],
  ["getDeploymentsByApp", ["a-store", 15, 15], "GET", "/deployments/applications/a-store?skip=15&take=15"],
  ["getDeployment", ["dep-live-admin"], "GET", "/deployments/dep-live-admin"],
  ["cancelDeployment", ["dep-live-admin"], "POST", "/deployments/dep-live-admin/cancel"],
  ["getDatabases", [], "GET", "/databases"],
  ["getDatabase", ["d-pg"], "GET", "/databases/d-pg"],
  ["getDatabaseBackups", ["d-pg"], "GET", "/databases/d-pg/backups"],
  ["runDatabaseBackup", ["d-pg", "b-daily"], "PATCH", "/databases/d-pg/backups/b-daily"],
  ["startDatabase", ["d-maria"], "POST", "/databases/d-maria/start"],
  ["stopDatabase", ["d-pg"], "POST", "/databases/d-pg/stop"],
  ["restartDatabase", ["d-pg"], "POST", "/databases/d-pg/restart"],
  ["getDatabaseLogs", ["d-pg", 50], "GET", "/databases/d-pg/logs?lines=50"],
  ["getServices", [], "GET", "/services"],
  ["getService", ["s-n8n"], "GET", "/services/s-n8n"],
  ["getServiceLogs", ["s-n8n", "n8n", 50], "GET", "/services/s-n8n/logs?sub_service_name=n8n&lines=50"],
  ["startService", ["s-minio"], "POST", "/services/s-minio/start"],
  ["stopService", ["s-n8n"], "POST", "/services/s-n8n/stop"],
  ["restartService", ["s-n8n"], "POST", "/services/s-n8n/restart"],
  ["serviceContainerAction", ["s-n8n", "application", "c-n8n", "restart"], "POST", "/services/s-n8n/applications/c-n8n/restart"],
  ["serviceContainerAction", ["s-n8n", "database", "c-n8n-db", "stop"], "POST", "/services/s-n8n/databases/c-n8n-db/stop"],
  ["pullLatestImagesService", ["s-n8n"], "POST", "/services/s-n8n/restart?latest=true"],
  ["getServers", [], "GET", "/servers"],
  ["getServer", ["srv-prod"], "GET", "/servers/srv-prod"],
  ["getServerResources", ["srv-prod"], "GET", "/servers/srv-prod/resources"],
  ["validateServer", ["srv-prod"], "POST", "/servers/srv-prod/validate"],
  ["restartProxy", ["srv-prod"], "POST", "/servers/srv-prod/proxy/restart"],
  ["runDockerCleanup", ["srv-prod"], "POST", "/servers/srv-prod/docker-cleanup/run"],
];

test("every method hits the path and verb of the app client", async () => {
  for (const [name, args, method, path] of METHOD_TABLE) {
    await apiOn(v43)[name](...args);
    const request = await lastRequest(v43);
    assert.deepEqual([request.method, request.path], [method, path], name);
  }
});

test("rollback and backup send the app's body", async () => {
  await apiOn(v43).rollbackApplication("a-store", "abc");
  assert.deepEqual((await lastRequest(v43)).body, { commit: "abc" });

  await apiOn(v43).runDatabaseBackup("d-pg", "b-daily");
  assert.deepEqual((await lastRequest(v43)).body, { backup_now: true });
});

// Review Focus 5: forms of the instance URL.
test("base url forms", async () => {
  assert.equal((await new CoolifyAPI(v43.url, TEST_TOKEN).getServers()).length, 3);
  assert.equal((await new CoolifyAPI(`${v43.url}/`, TEST_TOKEN).getServers()).length, 3);

  const mock = await startMockCoolify({ version: "4.3.1", basePath: "/coolify" });
  try {
    for (const url of [mock.url, `${mock.url}/`]) {
      const apps = await new CoolifyAPI(url, TEST_TOKEN).getApplications();
      assert.equal(apps.length, 3, url);
    }
    const requests = await mock.requests();
    assert.ok(requests.every((r) => r.path === "/coolify/api/v1/applications"));
  } finally {
    await mock.stop();
  }
});
