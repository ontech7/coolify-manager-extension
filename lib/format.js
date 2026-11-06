const HTML_ESCAPES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

export function splitFqdn(fqdn) {
  return String(fqdn ?? "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);
}

/**
 * A URL safe to open: http or https, or a bare host that gets https. Null for
 * anything else: these values come from the API and may be `javascript:`.
 */
export function safeExternalUrl(raw) {
  const value = String(raw ?? "").trim();
  if (!value) return null;

  // "localhost:3000" also looks like a scheme: a number after the colon is a port.
  const hasScheme =
    /^[a-z][a-z0-9+.-]*:/i.test(value) && !/^[^/:]+:\d+(\/|$)/.test(value);
  const url = hasScheme ? value : `https://${value}`;

  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

export function truncateCommit(commit) {
  return commit ? commit.substring(0, 7) : "";
}

/** Docker image tags are often full commit SHAs: shorten those like commits. */
export function formatImageTag(tag) {
  return /^[0-9a-f]{40}$/i.test(tag) ? truncateCommit(tag) : tag;
}

/** Human-readable size, e.g. 1536 → "1.5 KB". */
export function formatBytes(bytes) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${unit === 0 ? value : value.toFixed(1)} ${units[unit]}`;
}

/**
 * Hides the password of a connection URL: "postgres://u:secret@h" → "postgres://u:•••@h".
 * Whatever isn't clearly a username is hidden: Coolify also builds
 * "redis://secret@h", for Redis older than 6, where the only part is the password.
 */
export function maskUrlPassword(url) {
  // The last "@": an unencoded password may contain one.
  const at = url.lastIndexOf("@");
  if (at === -1) return url;

  const scheme = url.match(/^[^/:@]+:\/\//)?.[0] ?? "";
  const credentials = url.slice(scheme.length, at);
  const username = credentials.slice(0, credentials.indexOf(":") + 1);
  return `${scheme}${username}•••${url.slice(at)}`;
}

function lastLines(text, count) {
  const lines = text.split("\n");
  return lines.length > count ? lines.slice(-count).join("\n") : text;
}

/**
 * Coolify stores deployment logs as a JSON-encoded array of entries
 * ({ output, hidden, ... }). Falls back to the raw string if it isn't one.
 * Keeps the last `maxLines` lines.
 */
export function tailDeploymentLogs(raw, maxLines) {
  if (!raw) return { text: "", isTruncated: false };

  let text = raw;
  let isTruncated = false;

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const entries = parsed.filter(
        (entry) => entry && !entry.hidden && entry.output != null,
      );
      // Tail before joining, so the whole log is never built as one string.
      isTruncated = entries.length > maxLines;
      text = entries
        .slice(-maxLines)
        .map((entry) => String(entry.output))
        .join("\n");
    }
  } catch {
    // Not JSON: show as it is.
  }

  // An entry can span several lines: cap the joined text too.
  const full = text.trim();
  const tail = lastLines(full, maxLines);
  return { text: tail, isTruncated: isTruncated || tail.length < full.length };
}

const MINUTE = 60000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatRelativeTime(dateString, now = Date.now()) {
  const time = new Date(dateString).getTime();
  if (Number.isNaN(time)) return "Unknown";

  const diff = now - time;
  if (diff < MINUTE) return "Just now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d ago`;
  return new Date(time).toLocaleDateString();
}

export function formatDateTime(dateString) {
  const date = new Date(dateString);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
}

/**
 * Docker prints dates as "2025-01-15 10:30:00 +0000 UTC". Returns relative
 * time, or the raw value when it isn't in that format.
 */
export function formatDockerDate(raw, now = Date.now()) {
  if (!raw) return "";
  const match = raw.match(
    /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2})(\d{2})/,
  );
  if (!match) return raw;
  return formatRelativeTime(
    `${match[1]}T${match[2]}${match[3]}:${match[4]}`,
    now,
  );
}

/** "App\\Models\\StandalonePostgresql" → "Postgresql". */
export function cleanResourceType(type) {
  const last = String(type ?? "")
    .split("\\")
    .pop();
  return last.replace(/^Standalone/, "") || "Resource";
}
