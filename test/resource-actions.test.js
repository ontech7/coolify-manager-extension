import assert from "node:assert/strict";
import { test } from "node:test";
import { resourceActionState } from "../ui/resource-actions.js";

const app = (fields = {}) => ({
  uuid: "a",
  name: "app",
  resourceType: "application",
  status: "running:healthy",
  fqdn: "https://a.example.com",
  ...fields,
});
const db = (fields = {}) => ({
  uuid: "d",
  name: "db",
  resourceType: "database",
  status: "running:healthy",
  ...fields,
});
const svc = (fields = {}) => ({
  uuid: "s",
  name: "svc",
  resourceType: "service",
  status: "running:healthy",
  ...fields,
});

const state = (resource, options = {}) =>
  resourceActionState(resource, { legacy: false, busy: null, ...options });

const deploying = { kind: "deploying", deploymentUuid: "x", since: 1 };
const starting = { kind: "starting", since: 1 };
const stopping = { kind: "stopping", since: 1 };

test("deploy only for applications, pull only for services", () => {
  assert.equal(state(app()).deploy.show, true);
  assert.equal(state(db()).deploy.show, false);
  assert.equal(state(svc()).deploy.show, false);

  assert.equal(state(svc()).pull.show, true);
  assert.equal(state(app()).pull.show, false);
  assert.equal(state(db()).pull.show, false);

  assert.equal(state(app()).deploy.disabled, false);
  assert.equal(state(app({ pending: deploying })).deploy.disabled, true);
  assert.equal(state(svc({ pending: starting })).pull.disabled, true);
});

test("restart is disabled when not running or pending", () => {
  assert.equal(state(app()).restart.disabled, false);
  assert.equal(state(app({ status: "exited:unhealthy" })).restart.disabled, true);
  assert.equal(state(app({ pending: deploying })).restart.disabled, true);
});

test("stop stays available while deploying", () => {
  const { startStop } = state(app({ pending: deploying }));
  assert.equal(startStop.kind, "stop");
  assert.equal(startStop.disabled, false);
});

test("start and stop are disabled while stopping", () => {
  assert.equal(state(app({ pending: stopping })).startStop.disabled, true);
  assert.equal(
    state(app({ pending: stopping, status: "stopped" })).startStop.disabled,
    true,
  );
});

test("start is disabled while pending and not running", () => {
  const { startStop } = state(db({ status: "stopped", pending: starting }));
  assert.equal(startStop.kind, "start");
  assert.equal(startStop.disabled, true);
});

test("start is available on a stopped resource", () => {
  const { startStop } = state(db({ status: "stopped" }));
  assert.equal(startStop.kind, "start");
  assert.equal(startStop.disabled, false);
});

test("logs hidden for databases and services in legacy mode", () => {
  assert.equal(state(app(), { legacy: true }).logs.show, true);
  assert.equal(state(db(), { legacy: true }).logs.show, false);
  assert.equal(state(svc(), { legacy: true }).logs.show, false);
  assert.equal(state(db()).logs.show, true);
  assert.equal(state(svc()).logs.show, true);
});

test("site needs an application with a fqdn", () => {
  assert.equal(state(app()).site.show, true);
  assert.equal(state(app({ fqdn: null })).site.show, false);
  assert.equal(state(app({ fqdn: "" })).site.show, false);
  assert.equal(state(db({ fqdn: "https://x.example.com" })).site.show, false);
});

test("site is hidden when the first url isn't http or https", () => {
  assert.equal(state(app({ fqdn: "javascript:alert(1)" })).site.show, false);
});

test("busy disables every action and spins the running one", () => {
  const actions = state(app(), { busy: "deploy" });
  for (const name of ["deploy", "restart", "startStop", "logs", "site"]) {
    assert.equal(actions[name].disabled, true, name);
  }
  assert.equal(actions.deploy.loading, true);
  assert.equal(actions.restart.loading, false);
  assert.equal(actions.startStop.loading, false);

  assert.equal(state(svc(), { busy: "pull" }).pull.loading, true);
  assert.equal(state(app(), { busy: "restart" }).restart.loading, true);
  assert.equal(state(app(), { busy: "stop" }).startStop.loading, true);
  assert.equal(state(app(), { busy: "start" }).startStop.loading, true);
});

test("a resource without a status counts as not running", () => {
  const actions = state(db({ status: undefined }));
  assert.equal(actions.restart.disabled, true);
  assert.equal(actions.startStop.kind, "start");
});
