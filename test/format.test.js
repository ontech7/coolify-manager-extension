import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cleanResourceType,
  escapeHtml,
  formatBytes,
  formatDateTime,
  formatDockerDate,
  formatImageTag,
  formatRelativeTime,
  maskUrlPassword,
  safeExternalUrl,
  splitFqdn,
  tailDeploymentLogs,
  truncateCommit,
} from "../lib/format.js";

test("maskUrlPassword hides only the password", () => {
  assert.equal(
    maskUrlPassword("postgres://u:s3cret@h:5432/db"),
    "postgres://u:•••@h:5432/db",
  );
});

test("maskUrlPassword handles an unencoded @ in the password", () => {
  assert.equal(maskUrlPassword("postgres://u:p@ss@h/db"), "postgres://u:•••@h/db");
});

test("maskUrlPassword leaves a url without credentials alone", () => {
  assert.equal(maskUrlPassword("redis://h:6379"), "redis://h:6379");
});

test("formatBytes uses one decimal above bytes", () => {
  assert.equal(formatBytes(1536), "1.5 KB");
  assert.equal(formatBytes(512), "512 B");
});

test("formatImageTag shortens commit shas only", () => {
  assert.equal(formatImageTag("a".repeat(40)), "aaaaaaa");
  assert.equal(formatImageTag("v1.2"), "v1.2");
});

test("truncateCommit handles a missing commit", () => {
  assert.equal(truncateCommit("abcdef1234"), "abcdef1");
  assert.equal(truncateCommit(null), "");
});

test("splitFqdn trims and drops empty entries", () => {
  assert.deepEqual(splitFqdn("https://a.com, https://b.com,"), [
    "https://a.com",
    "https://b.com",
  ]);
  assert.deepEqual(splitFqdn(null), []);
});

test("cleanResourceType keeps the short class name", () => {
  assert.equal(cleanResourceType("App\\Models\\StandalonePostgresql"), "Postgresql");
  assert.equal(cleanResourceType("App\\Models\\Application"), "Application");
  assert.equal(cleanResourceType(undefined), "Resource");
});

test("formatRelativeTime uses the compact style", () => {
  const now = Date.parse("2026-11-06T12:00:00Z");
  assert.equal(formatRelativeTime("2026-11-06T11:59:40Z", now), "Just now");
  assert.equal(formatRelativeTime("2026-11-06T11:55:00Z", now), "5m ago");
  assert.equal(formatRelativeTime("2026-11-06T10:00:00Z", now), "2h ago");
  assert.equal(formatRelativeTime("2026-11-03T12:00:00Z", now), "3d ago");
});

test("formatRelativeTime and formatDateTime survive bad input", () => {
  assert.equal(formatRelativeTime("garbage"), "Unknown");
  assert.equal(formatRelativeTime(undefined), "Unknown");
  assert.equal(formatDateTime("garbage"), "Unknown");
});

test("formatDockerDate parses the docker format", () => {
  assert.equal(
    formatDockerDate(
      "2026-11-06 10:00:00 +0000 UTC",
      Date.parse("2026-11-06T12:00:00Z"),
    ),
    "2h ago",
  );
});

test("formatDockerDate keeps anything else as it is", () => {
  assert.equal(formatDockerDate("garbage"), "garbage");
  assert.equal(formatDockerDate(null), "");
});

// Review Focus 1: hostile values from the API.
test("safeExternalUrl refuses anything but http and https", () => {
  assert.equal(safeExternalUrl("javascript:alert(1)"), null);
  assert.equal(safeExternalUrl("data:text/html,x"), null);
  assert.equal(safeExternalUrl(""), null);
  assert.equal(safeExternalUrl(null), null);
});

test("safeExternalUrl adds https to a bare host and keeps http", () => {
  assert.equal(safeExternalUrl("shop.example.com"), "https://shop.example.com");
  assert.equal(safeExternalUrl("http://10.0.0.2:3000"), "http://10.0.0.2:3000");
  assert.equal(safeExternalUrl(" https://a.com/x "), "https://a.com/x");
});

test("safeExternalUrl does not mistake host:port for a scheme", () => {
  assert.equal(safeExternalUrl("localhost:3000"), "https://localhost:3000");
  assert.equal(
    safeExternalUrl("shop.example.com:8080/x"),
    "https://shop.example.com:8080/x",
  );
});

test("escapeHtml escapes markup and quotes", () => {
  assert.equal(
    escapeHtml('<img onerror="x">'),
    "&lt;img onerror=&quot;x&quot;&gt;",
  );
  assert.equal(escapeHtml("a'b&c"), "a&#39;b&amp;c");
  assert.equal(escapeHtml(null), "");
  assert.equal(escapeHtml(0), "0");
});

// Review Focus 3: odd logs.
test("tailDeploymentLogs handles an empty log", () => {
  assert.deepEqual(tailDeploymentLogs(null, 500), { text: "", isTruncated: false });
});

test("tailDeploymentLogs shows malformed or non-array JSON as it is", () => {
  assert.equal(tailDeploymentLogs("{not json", 500).text, "{not json");
  assert.equal(tailDeploymentLogs('{"a":1}', 500).text, '{"a":1}');
});

test("tailDeploymentLogs skips hidden and empty entries", () => {
  const entries = JSON.stringify([
    { output: "a" },
    { output: "b", hidden: true },
    { output: null },
    null,
    { output: "c\nd" },
  ]);
  assert.equal(tailDeploymentLogs(entries, 500).text, "a\nc\nd");
});

test("tailDeploymentLogs keeps the last lines and says so", () => {
  const many = JSON.stringify(
    Array.from({ length: 600 }, (_, i) => ({ output: `l${i}` })),
  );
  const { text, isTruncated } = tailDeploymentLogs(many, 500);
  assert.equal(isTruncated, true);
  const lines = text.split("\n");
  assert.equal(lines.length, 500);
  assert.equal(lines[499], "l599");
});

test("tailDeploymentLogs caps an entry spanning many lines", () => {
  const one = JSON.stringify([{ output: Array(600).fill("x").join("\n") }]);
  const { text, isTruncated } = tailDeploymentLogs(one, 500);
  assert.equal(text.split("\n").length, 500);
  assert.equal(isTruncated, true);
});

test("tailDeploymentLogs with Infinity keeps everything", () => {
  const many = JSON.stringify(
    Array.from({ length: 600 }, (_, i) => ({ output: `l${i}` })),
  );
  const { text, isTruncated } = tailDeploymentLogs(many, Infinity);
  assert.equal(isTruncated, false);
  assert.equal(text.split("\n").length, 600);
});

test("tailDeploymentLogs stays fast on a very large log", () => {
  const huge = JSON.stringify(
    Array.from({ length: 200000 }, (_, i) => ({ output: `line ${i}` })),
  );
  const startedAt = Date.now();
  const { text, isTruncated } = tailDeploymentLogs(huge, 500);
  assert.equal(isTruncated, true);
  assert.equal(text.split("\n").length, 500);
  assert.ok(Date.now() - startedAt < 1000);
});
