import { safeExternalUrl, splitFqdn } from "../lib/format.js";
import { html, raw } from "./dom.js";
import { icon } from "./icons.js";

// Labels and colors of the app's components/ui/status-badge.tsx.
const STATUS = {
  "running:healthy": { label: "Running", tone: "ok" },
  "running:unhealthy": { label: "Running: Unhealthy", tone: "warn" },
  "exited:unhealthy": { label: "Exited: Unhealthy", tone: "err" },
  stopped: { label: "Stopped", tone: "err" },
  building: { label: "Building", tone: "warn", pulse: true },
  deploying: { label: "Deploying", tone: "warn", pulse: true },
  starting: { label: "Starting", tone: "warn", pulse: true },
  stopping: { label: "Stopping", tone: "err", pulse: true },
  unknown: { label: "Unknown", tone: "mute" },
  success: { label: "Success", tone: "ok" },
  failed: { label: "Failed", tone: "err" },
  in_progress: { label: "In Progress", tone: "warn", pulse: true },
  queued: { label: "Queued", tone: "pri" },
  cancelled: { label: "Cancelled", tone: "mute" },
};

const TYPE_CHIPS = { application: "APP", database: "DB", service: "SVC" };

/** `{containerUuid: "c"}` → ` data-container-uuid="c"`. Values are escaped. */
function dataAttributes(data = {}) {
  return Object.entries(data)
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([key, value]) => {
      const name = key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
      return html` data-${raw(name)}="${value}"`;
    });
}

function plainBadge(label, tone, pulse) {
  return html`<span class="badge ${tone}"><i class="dot${pulse ? " pulse" : ""}"></i>${label}</span>`;
}

/** `status` is a normalized type, from getResourceStatus or getDeploymentStatus. */
export function statusBadge(status, { action, data } = {}) {
  const { label, tone, pulse } = STATUS[status] ?? STATUS.unknown;
  if (!action) return plainBadge(label, tone, pulse);

  return html`<button class="badge ${tone}" data-action="${action}"${dataAttributes(data)}><i class="dot${pulse ? " pulse" : ""}"></i>${label}${icon("ext", 10)}</button>`;
}

export function iconButton({
  action,
  icon: name,
  label,
  variant,
  disabled = false,
  loading = false,
  data,
  size = 14,
}) {
  const classes = ["ib", variant, loading && "spin"].filter(Boolean).join(" ");
  return html`<button class="${classes}" data-action="${action}"${dataAttributes(data)} aria-label="${label}" title="${label}"${disabled || loading ? raw(" disabled") : ""}>${icon(loading ? "loader" : name, size)}</button>`;
}

export function typeChip(type) {
  return html`<span class="tchip ${type}">${TYPE_CHIPS[type] ?? ""}</span>`;
}

/** Rows without a value are left out. `displayValue` is what shows; `copy` copies `value`. */
export function detailTable(rows) {
  const visible = rows.filter(
    (row) => row.html || (row.value !== null && row.value !== undefined && row.value !== ""),
  );

  return html`<div class="dt">${visible.map(
    (row) => html`<div class="dr"><div class="dl">${row.label}</div><div class="dv">${
      row.html ??
      html`<span class="${row.mono ? "mono" : ""}">${row.displayValue ?? String(row.value)}</span>`
    }</div>${
      row.copy
        ? html`<button class="ib sm" data-action="copy" data-value="${row.value}" aria-label="Copy ${row.label}" title="Copy">${icon("copy", 12)}</button>`
        : ""
    }</div>`,
  )}</div>`;
}

export function filterChips(items, active, action) {
  return html`<div class="chips">${items.map(
    ({ value, label }) =>
      html`<button class="chip${value === active ? " on" : ""}" data-action="${action}" data-value="${value}" aria-pressed="${String(value === active)}">${label}</button>`,
  )}</div>`;
}

/** A failed refresh while older data is still listed. */
export function refreshErrorBanner(message) {
  return html`<div class="banner" role="alert"><span>Couldn't refresh: ${message}</span><button data-action="retry" aria-label="Retry refresh">Retry</button></div>`;
}

export function emptyState({ icon: name, title, message, actionLabel, action }) {
  return html`<div class="empty">${icon(name, 32)}<h3>${title}</h3><p>${message}</p>${
    actionLabel && action
      ? html`<button class="btn sec" style="flex:none" data-action="${action}">${actionLabel}</button>`
      : ""
  }</div>`;
}

export function errorState(message) {
  return emptyState({
    icon: "warning",
    title: "Something went wrong",
    message,
    actionLabel: "Try Again",
    action: "retry",
  });
}

export function skeletonList(count = 5) {
  return html`<div class="list">${Array.from({ length: count }, () => html`<div class="sk"></div>`)}</div>`;
}

export function loadingState() {
  return html`<div class="empty"><span class="ib spin" style="background:none">${icon("loader", 22)}</span><p>Loading...</p></div>`;
}

export function healthPills(server) {
  const reachable = Boolean(server.settings?.is_reachable);
  const usable = Boolean(server.settings?.is_usable);
  return html`<div class="pills">${plainBadge(reachable ? "Reachable" : "Unreachable", reachable ? "ok" : "err")}${plainBadge(usable ? "Usable" : "Not usable", usable ? "ok" : "err")}</div>`;
}

/** The URLs of a `fqdn` as links. A value that isn't http or https isn't a link. */
export function linkList(fqdn) {
  return html`${splitFqdn(fqdn).map((url) => {
    const href = safeExternalUrl(url);
    return href
      ? html`<a class="lnk" href="${href}" target="_blank" rel="noopener noreferrer">${url}</a>`
      : "";
  })}`;
}
