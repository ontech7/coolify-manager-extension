import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { openDashboard } from "../lib/open-dashboard.js";
import { hashToRoute } from "../lib/routes.js";
import { installChromeStub } from "./helpers/chrome-stub.js";

const stub = installChromeStub();

const BASE = "chrome-extension://stub-extension-id/dashboard/dashboard.html";
const ROUTE = { screen: "database", uuid: "d-pg" };

beforeEach(() => stub.reset());

function hashOf(url) {
  assert.ok(url.startsWith(`${BASE}#`), url);
  return hashToRoute(url.slice(BASE.length));
}

test("opens a new tab with the hash when none exists", async () => {
  await openDashboard(ROUTE);

  assert.equal(stub.calls.length, 1);
  const [name, options] = stub.calls[0];
  assert.equal(name, "tabs.create");
  assert.deepEqual(hashOf(options.url), ROUTE);
});

test("reuses the open tab and focuses its window", async () => {
  stub.contexts = [
    { contextType: "TAB", documentUrl: `${BASE}#screen=servers`, tabId: 7, windowId: 3 },
  ];

  await openDashboard(ROUTE);

  assert.equal(stub.calls.length, 2);
  const [updateName, tabId, options] = stub.calls[0];
  assert.equal(updateName, "tabs.update");
  assert.equal(tabId, 7);
  assert.equal(options.active, true);
  assert.deepEqual(hashOf(options.url), ROUTE);
  assert.deepEqual(stub.calls[1], ["windows.update", 3, { focused: true }]);
});

test("ignores other extension tabs", async () => {
  stub.contexts = [
    {
      contextType: "TAB",
      documentUrl: "chrome-extension://stub-extension-id/options/options.html",
      tabId: 1,
      windowId: 1,
    },
    {
      contextType: "TAB",
      documentUrl: "chrome-extension://stub-extension-id/popup/popup.html",
      tabId: 2,
      windowId: 1,
    },
  ];

  await openDashboard(ROUTE);

  assert.equal(stub.calls[0][0], "tabs.create");
});
