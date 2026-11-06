import {
  formatBytes,
  formatDateTime,
  formatRelativeTime,
  maskUrlPassword,
} from "../../lib/format.js";
import { getDeploymentStatus } from "../../lib/status.js";
import {
  detailTable,
  errorState,
  iconButton,
  loadingState,
  refreshErrorBanner,
  statusBadge,
} from "../components.js";
import { delegate, html, setHtml } from "../dom.js";
import { icon } from "../icons.js";
import { resourceBadge } from "./resources.js";
import {
  createScrollScreen,
  isNotFound,
  settleResourcePending,
  watchResourcePending,
} from "./shared.js";

function databaseDetails(database) {
  const internal = database.internal_db_url;
  const external = database.external_db_url;

  return html`${detailTable([
    { label: "UUID", value: database.uuid, mono: true, copy: true },
    { label: "Engine", value: database.database_type?.replace(/^standalone-/, "") },
    { label: "Image", value: database.image, mono: true },
    { label: "Description", value: database.description },
    {
      label: "Internal URL",
      value: internal,
      displayValue: internal ? maskUrlPassword(internal) : undefined,
      copy: true,
    },
    {
      label: "Public URL",
      value: external,
      displayValue: external ? maskUrlPassword(external) : undefined,
      copy: true,
    },
    {
      label: "Public Port",
      value:
        database.is_public && database.public_port
          ? String(database.public_port)
          : undefined,
    },
    {
      label: "Created",
      value: database.created_at ? formatDateTime(database.created_at) : undefined,
    },
    {
      label: "Updated",
      value: database.updated_at ? formatDateTime(database.updated_at) : undefined,
    },
  ])}${
    !internal &&
    html`<p class="hint detail-hint">Connection URLs need an API token with the read:sensitive permission.</p>`
  }`;
}

/** A scheduled backup: its frequency, last run and a "back up now" button. */
function backupRow(backup, runningBackup) {
  const lastRun = backup.executions?.[0];
  return html`<div class="sr backup-row">
    <div class="sr-info">
      <div class="sr-name mono backup-frequency">${backup.frequency}${backup.save_s3 ? " · S3" : ""}${backup.enabled ? "" : " · Disabled"}</div>
      <div class="row-status backup-run">${
        lastRun
          ? html`${statusBadge(getDeploymentStatus(lastRun.status))}<span class="hint">${formatRelativeTime(lastRun.created_at)}${lastRun.size ? ` · ${formatBytes(lastRun.size)}` : ""}</span>`
          : html`<span class="hint">Never run</span>`
      }</div>
    </div>
    ${iconButton({
      action: "backup-now",
      icon: "backup",
      label: "Back up now",
      variant: "deploy",
      loading: runningBackup === backup.uuid,
      disabled: runningBackup !== null,
      data: { backup: backup.uuid },
      size: 16,
    })}
  </div>`;
}

/**
 * A database. `section` is overview or backups for the dashboard's sub-tabs;
 * without it, both under the status and the Logs button.
 */
export function createDatabaseScreen(ctx, route, { section, onHeaderChange } = {}) {
  const { uuid } = route;
  const { el, body } = createScrollScreen();
  const showOverview = section !== "backups";
  const showBackups = section !== "overview" && !ctx.legacy;

  let database = null;
  let backups = [];
  let backupsError = null;
  let pending = null;
  let isLoading = true;
  let error = null;
  let runningBackup = null;
  let lastRequest = 0;
  let stopWatching = null;

  const databaseName = () => database?.name ?? route.name ?? uuid;

  function backupsSection() {
    return html`<span class="sec-t" data-slot="backups-title">Backups${backups.length ? ` (${backups.length})` : ""}</span>${
      backupsError
        ? html`<p class="hint">${backupsError}</p>`
        : backups.length > 0
          ? html`<div class="sub">${backups.map((backup) => backupRow(backup, runningBackup))}</div>`
          : html`<p class="hint">No scheduled backups. Set one up in Coolify.</p>`
    }`;
  }

  function render() {
    if (isLoading) {
      setHtml(body, loadingState("Loading database..."));
      return;
    }
    if (!database) {
      setHtml(body, errorState(error || "Database not found"));
      return;
    }

    const resource = { uuid, name: databaseName(), status: database.status, ...(pending && { pending }) };

    setHtml(
      body,
      html`${error && refreshErrorBanner(error)}${
        !section &&
        html`<div class="row-status">${resourceBadge(resource)}</div>${
          !ctx.legacy &&
          html`<div class="acts"><button class="btn sec" data-action="logs">${icon("logs", 15)}Logs</button></div>`
        }`
      }${showOverview && databaseDetails(database)}${showBackups && backupsSection()}`,
    );
  }

  async function load() {
    const request = ++lastRequest;
    const fetchStartedAt = Date.now();
    const [db, list] = await Promise.allSettled([
      ctx.api.getDatabase(uuid),
      showBackups ? ctx.api.getDatabaseBackups(uuid) : Promise.resolve([]),
    ]);
    if (request !== lastRequest) return;

    if (db.status === "fulfilled") {
      database = db.value;
      error = null;
      if (!section) {
        settleResourcePending(ctx, { uuid, status: db.value.status }, fetchStartedAt);
      }
    } else {
      if (!database && isNotFound(db.reason)) {
        ctx.notFound(route);
        return;
      }
      error = db.reason.message;
    }

    if (list.status === "fulfilled") {
      backups = list.value ?? [];
      backupsError = null;
    } else {
      backups = [];
      backupsError = list.reason.message;
    }

    isLoading = false;
    render();
    onHeaderChange?.();
  }

  async function runBackup(backupUuid) {
    runningBackup = backupUuid;
    render();
    let failure = null;
    try {
      await ctx.actions.run("runDatabaseBackup", [uuid, backupUuid], {
        label: `Back up ${databaseName()}`,
      });
    } catch (err) {
      failure = err.message;
    }
    runningBackup = null;
    render();

    if (failure) await ctx.dialogs.alert("Error", failure);
    else await ctx.dialogs.alert("Backup started", "Refresh in a moment to see how it went.");
  }

  delegate(el, {
    logs: () =>
      ctx.open({ screen: "logs", uuid, type: "database", name: databaseName() }),
    "open-deployment": ({ uuid: deploymentUuid, appUuid, name }) =>
      ctx.open({ screen: "deployment", uuid: deploymentUuid, appUuid, name }),
    async "backup-now"({ backup }) {
      const confirmed = await ctx.dialogs.confirm({
        title: "Back Up Now",
        message: `Start a backup of "${databaseName()}" now?`,
        buttons: [
          { label: "Cancel", kind: "plain" },
          { label: "Back Up", kind: "pri", value: true },
        ],
      });
      if (confirmed) runBackup(backup);
    },
    retry() {
      if (!database) {
        isLoading = true;
        render();
      }
      load();
    },
  });

  render();

  return {
    el,
    title: () => database?.name ?? route.name ?? "Database",
    refresh: load,
    activate() {
      stopWatching = watchResourcePending(
        ctx,
        uuid,
        (next) => {
          pending = next;
          render();
        },
        section ? null : load,
      );
      return load();
    },
    deactivate() {
      stopWatching?.();
      stopWatching = null;
    },
    destroy() {
      stopWatching?.();
    },
  };
}
