import assert from "node:assert/strict";
import { test } from "node:test";
import { isVersionAtLeast, parseVersion } from "../lib/version.js";

test("the minimum itself counts", () => {
  assert.equal(isVersionAtLeast("4.2.0", "4.2.0"), true);
});

test("an older patch is below the minimum, with or without the v", () => {
  assert.equal(isVersionAtLeast("v4.1.9", "4.2.0"), false);
});

test("a newer minor is above the minimum", () => {
  assert.equal(isVersionAtLeast("4.10.0", "4.2.0"), true);
});

test("a pre-release of the minimum is below it", () => {
  assert.equal(isVersionAtLeast("4.2.0-beta.1", "4.2.0"), false);
});

test("an unparseable version gives null", () => {
  assert.equal(isVersionAtLeast("latest", "4.2.0"), null);
});

test("a missing patch counts as zero", () => {
  assert.deepEqual(parseVersion("4.2"), {
    major: 4,
    minor: 2,
    patch: 0,
    prerelease: undefined,
  });
});
