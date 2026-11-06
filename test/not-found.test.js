import assert from "node:assert/strict";
import { test } from "node:test";
import { HttpError } from "../lib/coolify-api.js";
import { isNotFound } from "../ui/screens/shared.js";

test("the 404 of a resource means it is gone", () => {
  for (const message of [
    "Application not found.",
    "Database not found.",
    "Service not found.",
    "Server not found.",
    "Deployment not found.",
  ]) {
    assert.equal(isNotFound(new HttpError(message, 404)), true, message);
  }
});

test("any other 404 is an ordinary error", () => {
  for (const message of [
    "Not found.",
    "Sub-service not found.",
    "Container not found.",
    "Backup not found.",
    "Page not found",
    "",
  ]) {
    assert.equal(isNotFound(new HttpError(message, 404)), false, message);
  }
});

test("the message alone isn't enough", () => {
  assert.equal(isNotFound(new HttpError("Application not found.", 500)), false);
  assert.equal(isNotFound(new Error("Application not found.")), false);
});
