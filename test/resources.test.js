import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeResources } from "../lib/resources.js";

const APP = {
  uuid: "a",
  name: "zeta",
  status: "running:healthy",
  build_pack: "nixpacks",
  type: "application",
  fqdn: "https://a.example.com",
};
const DB = { uuid: "d", name: "alpha", status: "stopped", image: "postgres:16" };
const SVC = { uuid: "s", name: "mid", status: "running:healthy", service_type: "n8n" };

test("merges and sorts the three lists", () => {
  assert.deepEqual(mergeResources([APP], [DB], [SVC]), [
    {
      uuid: "d",
      name: "alpha",
      status: "stopped",
      resourceType: "database",
      subtitle: "postgres:16",
    },
    {
      uuid: "s",
      name: "mid",
      status: "running:healthy",
      resourceType: "service",
      subtitle: "n8n",
    },
    {
      uuid: "a",
      name: "zeta",
      status: "running:healthy",
      resourceType: "application",
      subtitle: "nixpacks",
      fqdn: "https://a.example.com",
    },
  ]);
});

test("a missing list is skipped", () => {
  assert.deepEqual(
    mergeResources(null, [DB], null).map((r) => r.uuid),
    ["d"],
  );
  assert.deepEqual(mergeResources(null, null, null), []);
  assert.deepEqual(mergeResources(undefined, undefined, undefined), []);
});

test("missing name and fqdn do not throw", () => {
  const result = mergeResources(
    [{ uuid: "a", type: "application", fqdn: null }],
    [{ uuid: "d" }],
    [{ uuid: "s" }],
  );

  assert.deepEqual(result.map((r) => r.name).sort(), ["a", "d", "s"]);
  assert.equal(result.find((r) => r.uuid === "a").subtitle, "application");
  assert.equal(result.find((r) => r.uuid === "d").subtitle, "Database");
  assert.equal(result.find((r) => r.uuid === "s").subtitle, "Service");
});
