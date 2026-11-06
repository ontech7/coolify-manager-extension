import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { loadNavState, saveNavState } from "../lib/nav-state.js";
import { installChromeStub } from "./helpers/chrome-stub.js";

const stub = installChromeStub();

beforeEach(() => stub.reset());

const STATE = {
  tab: "servers",
  stack: [{ screen: "server", uuid: "srv-prod" }],
  filter: "database",
  query: "pg",
};

test("saves and loads for the same instance", async () => {
  await saveNavState("i1", STATE);
  assert.deepEqual(await loadNavState("i1"), STATE);
});

test("state of another instance loads as null", async () => {
  await saveNavState("i1", STATE);
  assert.equal(await loadNavState("i2"), null);
});

test("nothing saved loads as null", async () => {
  assert.equal(await loadNavState("i1"), null);
});

test("it is stored under popupNav, in session storage", async () => {
  await saveNavState("i1", STATE);
  const { popupNav } = await chrome.storage.session.get("popupNav");
  assert.equal(popupNav.instanceId, "i1");
  assert.deepEqual(await chrome.storage.sync.get(null), {});
});
