import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getDeploymentStatus,
  getResourceStatus,
  isDeploymentActive,
  isResourceRunning,
  summarizeStatuses,
} from "../lib/status.js";

test("resource statuses normalize like the app", () => {
  assert.equal(getResourceStatus("running:healthy"), "running:healthy");
  assert.equal(getResourceStatus("running:unhealthy"), "running:unhealthy");
  assert.equal(getResourceStatus("running"), "running:healthy");
  assert.equal(getResourceStatus("healthy"), "running:healthy");
  assert.equal(getResourceStatus("exited"), "stopped");
  assert.equal(getResourceStatus("exited:unhealthy"), "exited:unhealthy");
  assert.equal(getResourceStatus("stopped"), "stopped");
  assert.equal(getResourceStatus("building"), "building");
  assert.equal(getResourceStatus("RUNNING:HEALTHY"), "running:healthy");
});

test("a missing or unknown resource status is unknown", () => {
  assert.equal(getResourceStatus(undefined), "unknown");
  assert.equal(getResourceStatus(""), "unknown");
  assert.equal(getResourceStatus("weird"), "unknown");
});

test("isResourceRunning looks for running only", () => {
  assert.equal(isResourceRunning("running:unhealthy"), true);
  assert.equal(isResourceRunning("exited"), false);
  assert.equal(isResourceRunning(undefined), false);
});

test("deployment statuses normalize like the app", () => {
  assert.equal(getDeploymentStatus("finished"), "success");
  assert.equal(getDeploymentStatus("completed"), "success");
  assert.equal(getDeploymentStatus("error"), "failed");
  assert.equal(getDeploymentStatus("pending"), "queued");
  assert.equal(getDeploymentStatus("building"), "in_progress");
  assert.equal(getDeploymentStatus("cancelled-by-user"), "cancelled");
  assert.equal(getDeploymentStatus("weird"), "unknown");
  assert.equal(getDeploymentStatus(undefined), "unknown");
});

test("only queued and in progress deployments are active", () => {
  assert.equal(isDeploymentActive("in_progress"), true);
  assert.equal(isDeploymentActive("queued"), true);
  assert.equal(isDeploymentActive("finished"), false);
  assert.equal(isDeploymentActive(undefined), false);
});

test("summarizeStatuses counts per bucket and ignores unknown", () => {
  assert.deepEqual(
    summarizeStatuses([
      { status: "running:healthy" },
      { status: "exited:unhealthy" },
      { status: "running:unhealthy" },
      { status: "stopped" },
      {},
    ]),
    { running: 1, unhealthy: 2, stopped: 1 },
  );
});
