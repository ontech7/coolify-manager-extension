import assert from "node:assert/strict";
import { test } from "node:test";
import { dashboardViewFor, hashToRoute, routeToHash } from "../lib/routes.js";

const ROUTES = [
  { screen: "resources" },
  { screen: "resources", filter: "database", query: "pg" },
  { screen: "deployments" },
  { screen: "servers" },
  { screen: "application", uuid: "a" },
  { screen: "database", uuid: "d" },
  { screen: "service", uuid: "s" },
  { screen: "server", uuid: "srv" },
  { screen: "history", uuid: "a", name: "storefront web" },
  { screen: "rollback", uuid: "a", name: "storefront-web" },
  { screen: "logs", uuid: "s", type: "service", name: "n8n", container: "c/1" },
  { screen: "deployment", uuid: "x", appUuid: "a" },
  { screen: "deployment", uuid: "x" },
  { screen: "database", uuid: "d", sub: "backups" },
  { screen: "service", uuid: "s", sub: "containers", filter: "service", query: "n8n" },
];

test("every screen survives the round trip", () => {
  for (const route of ROUTES) {
    assert.deepEqual(hashToRoute(routeToHash(route)), route);
  }
});

test("a hash starts with # and is URL safe", () => {
  const hash = routeToHash({ screen: "logs", uuid: "a b&c=d#e" });
  assert.ok(hash.startsWith("#"));
  assert.equal(hash.includes(" "), false);
  assert.equal(hashToRoute(hash).uuid, "a b&c=d#e");
});

test("empty fields are left out", () => {
  const route = hashToRoute(
    routeToHash({ screen: "resources", filter: undefined, query: "", uuid: null }),
  );
  assert.deepEqual(route, { screen: "resources" });
});

test("an invalid hash is the resources screen", () => {
  for (const hash of ["", "#", "#garbage", "#screen=nope", "#uuid=a", null, undefined]) {
    assert.deepEqual(hashToRoute(hash), { screen: "resources" }, String(hash));
  }
});

test("a detail screen without its uuid is the resources screen", () => {
  for (const screen of ["application", "database", "service", "server", "history", "rollback", "logs", "deployment"]) {
    assert.deepEqual(hashToRoute(`#screen=${screen}`), { screen: "resources" }, screen);
  }
});

test("unknown fields of a hash are ignored", () => {
  assert.deepEqual(hashToRoute("#screen=database&uuid=d&__proto__=x&evil=1"), {
    screen: "database",
    uuid: "d",
  });
});

test("dashboardViewFor follows the table of the spec", () => {
  assert.deepEqual(
    dashboardViewFor({ screen: "resources", filter: "database", query: "pg" }),
    {
      nav: "resources",
      selection: null,
      sub: "overview",
      container: null,
      filter: "database",
      query: "pg",
      appUuid: null,
    },
  );
  assert.equal(dashboardViewFor({ screen: "resources" }).filter, "all");
  assert.equal(dashboardViewFor({ screen: "resources" }).query, "");
  assert.equal(dashboardViewFor({ screen: "deployments" }).nav, "deployments");
  assert.equal(dashboardViewFor({ screen: "deployments" }).selection, null);
  assert.equal(dashboardViewFor({ screen: "servers" }).nav, "servers");
  assert.equal(dashboardViewFor({ screen: "servers" }).selection, null);

  for (const screen of ["application", "database", "service"]) {
    const view = dashboardViewFor({ screen, uuid: "d" });
    assert.equal(view.nav, "resources");
    assert.deepEqual(view.selection, { kind: "resource", uuid: "d" });
    assert.equal(view.sub, "overview");
  }

  const server = dashboardViewFor({ screen: "server", uuid: "srv" });
  assert.equal(server.nav, "servers");
  assert.deepEqual(server.selection, { kind: "server", uuid: "srv" });

  assert.equal(dashboardViewFor({ screen: "history", uuid: "a" }).sub, "history");
  assert.equal(dashboardViewFor({ screen: "rollback", uuid: "a" }).sub, "rollback");

  const logs = dashboardViewFor({ screen: "logs", uuid: "s", type: "service", container: "c" });
  assert.equal(logs.nav, "resources");
  assert.equal(logs.sub, "logs");
  assert.equal(logs.container, "c");
  assert.deepEqual(logs.selection, { kind: "resource", uuid: "s" });

  const fromApp = dashboardViewFor({ screen: "deployment", uuid: "x", appUuid: "a" });
  assert.deepEqual(fromApp.selection, { kind: "deployment", uuid: "x" });
  assert.equal(fromApp.nav, "resources");
  assert.equal(fromApp.appUuid, "a");

  const alone = dashboardViewFor({ screen: "deployment", uuid: "x" });
  assert.equal(alone.nav, "deployments");
  assert.equal(alone.appUuid, null);
});

test("a sub-tab of the dashboard wins over the screen's own", () => {
  assert.equal(dashboardViewFor({ screen: "database", uuid: "d", sub: "backups" }).sub, "backups");
  assert.equal(dashboardViewFor({ screen: "service", uuid: "s", sub: "containers" }).sub, "containers");
});
