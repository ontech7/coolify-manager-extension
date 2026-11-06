import assert from "node:assert/strict";
import { test } from "node:test";
import {
  detailTable,
  emptyState,
  errorState,
  filterChips,
  healthPills,
  iconButton,
  linkList,
  refreshErrorBanner,
  skeletonList,
  statusBadge,
  typeChip,
} from "../ui/components.js";
import { icon } from "../ui/icons.js";

const str = (value) => String(value);

test("an icon button has a label and is disabled while loading", () => {
  const idle = str(
    iconButton({
      action: "stop",
      icon: "stop",
      label: "Stop",
      variant: "stop",
      data: { uuid: "a", containerUuid: "c" },
    }),
  );
  assert.match(idle, /aria-label="Stop"/);
  assert.match(idle, /title="Stop"/);
  assert.match(idle, /data-action="stop"/);
  assert.match(idle, /data-uuid="a"/);
  assert.match(idle, /data-container-uuid="c"/);
  assert.match(idle, /class="ib stop"/);
  assert.doesNotMatch(idle, /disabled/);

  const loading = str(
    iconButton({ action: "stop", icon: "stop", label: "Stop", loading: true }),
  );
  assert.match(loading, /disabled/);
  assert.match(loading, /spin/);
  assert.equal(loading.includes(str(icon("stop"))), false);
  assert.equal(loading.includes(str(icon("loader"))), true);

  assert.match(
    str(iconButton({ action: "x", icon: "x", label: "X", disabled: true })),
    /disabled/,
  );
});

test("an icon button escapes its label and data", () => {
  const button = str(
    iconButton({
      action: "x",
      icon: "x",
      label: '"><script>',
      data: { uuid: '"><img>' },
    }),
  );
  assert.equal(button.includes("<script>"), false);
  assert.equal(button.includes("<img>"), false);
});

test("statusBadge uses the app labels", () => {
  const expected = {
    "running:healthy": ["Running", "ok", false],
    "running:unhealthy": ["Running: Unhealthy", "warn", false],
    "exited:unhealthy": ["Exited: Unhealthy", "err", false],
    stopped: ["Stopped", "err", false],
    building: ["Building", "warn", true],
    deploying: ["Deploying", "warn", true],
    starting: ["Starting", "warn", true],
    stopping: ["Stopping", "err", true],
    unknown: ["Unknown", "mute", false],
    success: ["Success", "ok", false],
    failed: ["Failed", "err", false],
    in_progress: ["In Progress", "warn", true],
    queued: ["Queued", "pri", false],
    cancelled: ["Cancelled", "mute", false],
  };

  for (const [status, [label, tone, pulse]] of Object.entries(expected)) {
    const badge = str(statusBadge(status));
    assert.ok(badge.includes(`>${label}<`), status);
    assert.ok(badge.includes(`badge ${tone}`), status);
    assert.equal(badge.includes("pulse"), pulse, status);
  }
});

test("statusBadge falls back to Unknown", () => {
  assert.ok(str(statusBadge("whatever")).includes(">Unknown<"));
});

test("statusBadge with an action is a button", () => {
  const badge = str(
    statusBadge("deploying", { action: "open-deployment", data: { uuid: "d" } }),
  );
  assert.match(badge, /^<button/);
  assert.match(badge, /data-action="open-deployment"/);
  assert.match(badge, /data-uuid="d"/);
  assert.match(str(statusBadge("deploying")), /^<span/);
});

test("typeChip names the three types", () => {
  assert.match(str(typeChip("application")), /tchip application.*APP/s);
  assert.match(str(typeChip("database")), /tchip database.*DB/s);
  assert.match(str(typeChip("service")), /tchip service.*SVC/s);
});

test("detailTable skips rows without a value and masks displayValue", () => {
  const url = "postgres://app:secret@h/app";
  const table = str(
    detailTable([
      { label: "Empty", value: null },
      { label: "Blank", value: "" },
      { label: "UUID", value: "abc", mono: true, copy: true },
      {
        label: "Internal URL",
        value: url,
        displayValue: "postgres://app:•••@h/app",
        copy: true,
      },
    ]),
  );

  assert.equal(table.includes("Empty"), false);
  assert.equal(table.includes("Blank"), false);
  assert.ok(table.includes('class="mono"'));
  assert.ok(table.includes(">postgres://app:•••@h/app<"));
  assert.equal(table.includes(">postgres://app:secret"), false);
  assert.ok(table.includes(`data-value="${url}"`));
  assert.ok(table.includes('aria-label="Copy Internal URL"'));
});

test("detailTable shows html rows and zero values", () => {
  const table = str(
    detailTable([
      { label: "Links", html: linkList("a.example.com") },
      { label: "Port", value: 0 },
    ]),
  );
  assert.ok(table.includes("a.example.com"));
  assert.ok(table.includes("Port"));
});

test("detailTable escapes its values", () => {
  assert.equal(
    str(detailTable([{ label: "Name", value: "<img onerror=x>" }])).includes("<img"),
    false,
  );
});

test("filterChips marks the active one", () => {
  const chips = str(
    filterChips(
      [
        { value: "all", label: "All 9" },
        { value: "database", label: "DBs 3" },
      ],
      "database",
      "filter",
    ),
  );
  assert.match(chips, /class="chip" data-action="filter" data-value="all"/);
  assert.match(chips, /class="chip on" data-action="filter" data-value="database"/);
  assert.match(chips, /data-value="all" aria-pressed="false"/);
  assert.match(chips, /data-value="database" aria-pressed="true"/);
});

test("refreshErrorBanner has the app's text", () => {
  const banner = str(refreshErrorBanner("Server Error"));
  assert.ok(banner.includes("Couldn't refresh: Server Error"));
  assert.ok(banner.includes('data-action="retry"'));
  assert.ok(banner.includes(">Retry<"));
});

test("errorState and emptyState escape their text", () => {
  const error = str(errorState("<b>"));
  assert.equal(error.includes("<b>"), false);
  assert.ok(error.includes("Something went wrong"));
  assert.ok(error.includes(">Try Again<"));
  const empty = str(
    emptyState({
      icon: "search",
      title: "No Matches",
      message: "<i>",
      actionLabel: "Clear Filters",
      action: "clear",
    }),
  );
  assert.ok(empty.includes("No Matches"));
  assert.equal(empty.includes("<i>"), false);
  assert.ok(empty.includes('data-action="clear"'));
  assert.equal(
    str(emptyState({ icon: "search", title: "T", message: "M" })).includes("<button"),
    false,
  );
});

test("skeletonList draws the requested rows", () => {
  assert.equal(str(skeletonList()).match(/class="sk"/g).length, 5);
  assert.equal(str(skeletonList(2)).match(/class="sk"/g).length, 2);
});

test("healthPills reads the server settings", () => {
  const good = str(healthPills({ settings: { is_reachable: true, is_usable: true } }));
  assert.ok(good.includes(">Reachable<"));
  assert.ok(good.includes(">Usable<"));
  const bad = str(healthPills({ settings: { is_reachable: false, is_usable: false } }));
  assert.ok(bad.includes(">Unreachable<"));
  assert.ok(bad.includes(">Not usable<"));
  // Review Focus 2: a server without settings.
  assert.ok(str(healthPills({})).includes(">Unreachable<"));
});

test("linkList drops unsafe urls", () => {
  const links = str(
    linkList("https://a.example.com, javascript:alert(1),b.example.com"),
  );
  assert.equal(links.includes("javascript"), false);
  assert.ok(links.includes('href="https://a.example.com"'));
  assert.ok(links.includes('href="https://b.example.com"'));
  assert.ok(links.includes('rel="noopener noreferrer"'));
  assert.equal(str(linkList(null)), "");
});

test("an unknown icon is empty rather than broken", () => {
  assert.equal(str(icon("nope")), "");
  assert.match(str(icon("rocket", 20)), /width="20"/);
  assert.match(str(icon("rocket")), /width="14"/);
});
