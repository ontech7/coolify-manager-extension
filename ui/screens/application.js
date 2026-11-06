import { HISTORY_PAGE_SIZE } from "../../lib/constants.js";
import { UnsupportedVersionError } from "../../lib/coolify-api.js";
import {
  formatDateTime,
  formatDockerDate,
  formatImageTag,
  formatRelativeTime,
  splitFqdn,
  truncateCommit,
} from "../../lib/format.js";
import { getDeploymentStatus } from "../../lib/status.js";
import {
  detailTable,
  emptyState,
  errorState,
  linkList,
  loadingState,
  statusBadge,
} from "../components.js";
import { delegate, html, setHtml } from "../dom.js";
import { icon } from "../icons.js";
import { resourceBadge } from "./resources.js";
import { createScrollScreen, isNotFound, watchResourcePending } from "./shared.js";

function applicationDetails(application) {
  const urls = splitFqdn(application.fqdn);
  return detailTable([
    { label: "UUID", value: application.uuid, mono: true, copy: true },
    { label: "Type", value: application.type },
    { label: "Build Pack", value: application.build_pack },
    {
      label: "URL",
      html: urls.length > 0 ? linkList(application.fqdn) : html`<span>n/a</span>`,
    },
    {
      label: "Repository",
      value: application.git_repository || "n/a",
      copy: Boolean(application.git_repository),
    },
    { label: "Branch", value: application.git_branch || "n/a", mono: true },
    { label: "Created", value: formatDateTime(application.created_at) },
    { label: "Updated", value: formatDateTime(application.updated_at) },
  ]);
}

/**
 * An application. Loaded on open and with the manual refresh. With
 * `section: 'overview'` only the details, for the dashboard's own header.
 */
export function createApplicationScreen(ctx, route, { section, onHeaderChange } = {}) {
  const { uuid } = route;
  const { el, body } = createScrollScreen();

  let application = null;
  let pending = null;
  let isLoading = true;
  let error = null;
  let lastRequest = 0;
  let stopWatching = null;

  function render() {
    if (isLoading) {
      setHtml(body, loadingState("Loading application..."));
      return;
    }
    if (!application) {
      setHtml(body, errorState(error || "Application not found"));
      return;
    }

    const name = application.name ?? uuid;
    const resource = {
      uuid,
      name,
      status: application.status,
      ...(pending && { pending }),
    };
    const data = html`data-uuid="${uuid}" data-name="${name}"`;

    setHtml(
      body,
      html`${
        section !== "overview" &&
        html`<div class="row-status">${resourceBadge(resource)}</div>
          <div class="acts">
            <button class="btn sec" data-action="history" ${data}>${icon("history", 15)}History</button>
            <button class="btn sec" data-action="logs" ${data}>${icon("logs", 15)}Logs</button>
            ${
              !ctx.legacy &&
              html`<button class="btn sec" data-action="rollback" ${data}>${icon("rollback", 15)}Rollback</button>`
            }
          </div>`
      }${error && html`<div class="banner" role="status"><span>${error}</span></div>`}${applicationDetails(application)}`,
    );
  }

  async function load({ manual = false } = {}) {
    const request = ++lastRequest;
    try {
      const next = await ctx.api.getApplication(uuid);
      if (request !== lastRequest) return;
      application = next;
      error = null;
    } catch (err) {
      if (request !== lastRequest) return;
      if (!application && isNotFound(err)) {
        ctx.notFound(route);
        return;
      }
      error = err.message;
      if (manual && application) ctx.dialogs.alert("Error", err.message);
    }
    isLoading = false;
    render();
    onHeaderChange?.();
  }

  delegate(el, {
    history: ({ name }) => ctx.open({ screen: "history", uuid, name }),
    logs: ({ name }) => ctx.open({ screen: "logs", uuid, type: "application", name }),
    rollback: ({ name }) => ctx.open({ screen: "rollback", uuid, name }),
    "open-deployment": ({ uuid: deploymentUuid, appUuid, name }) =>
      ctx.open({ screen: "deployment", uuid: deploymentUuid, appUuid, name }),
    retry() {
      isLoading = true;
      render();
      load();
    },
  });

  render();

  return {
    el,
    title: () => application?.name ?? route.name ?? "Application",
    refresh: ({ manual = false } = {}) => load({ manual }),
    activate() {
      stopWatching = watchResourcePending(ctx, uuid, (next) => {
        pending = next;
        render();
      });
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

function historyRow(deployment, appUuid, name) {
  return html`<button class="sr" data-action="open-deployment" data-uuid="${deployment.deployment_uuid}" data-app-uuid="${appUuid}" data-name="${name}">
    <div class="sr-info">
      <div class="sr-name">${formatRelativeTime(deployment.created_at)} ${
        deployment.commit &&
        html`<span class="commit">${truncateCommit(deployment.commit)}</span>`
      }</div>
      ${deployment.commit_message && html`<div class="sr-meta">${deployment.commit_message}</div>`}
    </div>
    ${statusBadge(getDeploymentStatus(deployment.status))}
  </button>`;
}

/** Past deployments of an application, a page at a time. */
export function createHistoryScreen(ctx, route, opts = {}) {
  const { uuid } = route;
  const { el, body } = createScrollScreen();

  let deployments = [];
  let hasMore = false;
  let isLoading = true;
  let isLoadingMore = false;
  let error = null;
  let hasLoaded = false;
  let lastRequest = 0;

  const appName = () => route.name ?? deployments[0]?.application_name ?? "";

  function render() {
    if (isLoading) {
      setHtml(body, loadingState("Loading deployments..."));
    } else if (!hasLoaded) {
      setHtml(body, errorState(error));
    } else if (deployments.length === 0) {
      setHtml(
        body,
        emptyState({
          icon: "history",
          title: "No Deployment History",
          message:
            "This application hasn't been deployed yet. Past deployments will appear here once you deploy it.",
        }),
      );
    } else {
      const name = appName();
      setHtml(
        body,
        html`${error && html`<div class="banner" role="status"><span>${error}</span></div>`}<div class="sub">${deployments.map(
          (deployment) => historyRow(deployment, uuid, name),
        )}</div>${
          hasMore &&
          html`<button class="btn sec load-more" data-action="load-more"${isLoadingMore ? html` disabled` : ""}>${isLoadingMore ? icon("loader", 15) : ""}Load more</button>`
        }`,
      );
    }
  }

  async function fetchPage(skip) {
    const request = ++lastRequest;
    try {
      const result = await ctx.api.getDeploymentsByApp(uuid, skip, HISTORY_PAGE_SIZE);
      if (request !== lastRequest) return;
      const batch = result.deployments ?? [];
      hasMore = skip + batch.length < (result.count ?? 0);
      deployments = skip === 0 ? batch : [...deployments, ...batch];
      hasLoaded = true;
      error = null;
      opts.onHeaderChange?.();
    } catch (err) {
      if (request !== lastRequest) return;
      if (!hasLoaded && isNotFound(err)) {
        ctx.notFound(route);
        return;
      }
      error = err.message;
    }
    isLoading = false;
    isLoadingMore = false;
    render();
  }

  delegate(el, {
    "open-deployment": ({ uuid: deploymentUuid, appUuid, name }) =>
      ctx.open({ screen: "deployment", uuid: deploymentUuid, appUuid, name }),
    "load-more"() {
      isLoadingMore = true;
      render();
      fetchPage(deployments.length);
    },
    retry() {
      isLoading = true;
      render();
      fetchPage(0);
    },
  });

  render();
  fetchPage(0);

  return {
    el,
    title: () => {
      const name = appName();
      return name ? `${name} · History` : "Deployment History";
    },
    refresh: () => fetchPage(0),
    destroy() {},
  };
}

function rollbackRow(image, rollingBack) {
  const isBusy = rollingBack !== null;
  return html`<button class="sr" data-action="pick-image" data-tag="${image.tag}"${image.is_current || isBusy ? html` disabled` : ""}>
    <div class="sr-info">
      <div class="sr-name mono image-tag">${formatImageTag(image.tag)}</div>
      <div class="sr-meta">${formatDockerDate(image.created_at)}</div>
    </div>
    ${
      image.is_current
        ? html`<span class="badge ok">Current</span>`
        : rollingBack === image.tag
          ? html`<span class="spin image-action">${icon("loader", 16)}</span>`
          : html`<span class="image-action">${icon("rollback", 16)}</span>`
    }
  </button>`;
}

/** Redeploys an image Coolify still has for the application (Coolify >= 4.3.0). */
export function createRollbackScreen(ctx, route) {
  const { uuid, name } = route;
  const { el, body } = createScrollScreen();

  let images = [];
  let isLoading = true;
  let error = null;
  let isUnsupported = false;
  let rollingBack = null;

  function render() {
    if (isLoading) {
      setHtml(body, loadingState("Loading images..."));
    } else if (error && isUnsupported) {
      setHtml(
        body,
        emptyState({ icon: "history", title: "Rollback Unavailable", message: error }),
      );
    } else if (error) {
      setHtml(body, errorState(error));
    } else if (images.length === 0) {
      setHtml(
        body,
        emptyState({
          icon: "history",
          title: "No Previous Images",
          message:
            "Coolify has no older images of this application on the server. Images appear here after a few deployments.",
        }),
      );
    } else {
      setHtml(
        body,
        html`<p class="hint rollback-hint">Pick an image to redeploy. The current one is marked.</p>
          <div class="sub">${images.map((image) => rollbackRow(image, rollingBack))}</div>`,
      );
    }
  }

  async function load() {
    try {
      const result = await ctx.api.getRollbackImages(uuid);
      images = result.images ?? [];
      error = null;
      isUnsupported = false;
    } catch (err) {
      if (isNotFound(err)) {
        ctx.notFound(route);
        return;
      }
      error = err.message;
      isUnsupported = err instanceof UnsupportedVersionError;
    }
    isLoading = false;
    render();
  }

  async function rollback(tag) {
    rollingBack = tag;
    render();
    try {
      const result = await ctx.actions.run("rollbackApplication", [uuid, tag], {
        label: `Roll back ${name ?? uuid}`,
      });
      if (result?.deployment_uuid) {
        ctx.open(
          { screen: "deployment", uuid: result.deployment_uuid, appUuid: uuid, name },
          { replace: true },
        );
        return;
      }
      await ctx.dialogs.alert("Rollback queued", result?.message ?? "");
      ctx.back();
    } catch (err) {
      rollingBack = null;
      render();
      await ctx.dialogs.alert("Error", err.message);
    }
  }

  delegate(el, {
    async "pick-image"({ tag }) {
      const confirmed = await ctx.dialogs.confirm({
        title: "Roll Back",
        message: `Redeploy ${name ? `"${name}" ` : ""}with image ${formatImageTag(tag)}?`,
        buttons: [
          { label: "Cancel", kind: "plain" },
          { label: "Roll Back", kind: "dng", value: true },
        ],
      });
      if (confirmed) rollback(tag);
    },
    retry() {
      isLoading = true;
      render();
      load();
    },
  });

  render();
  load();

  return {
    el,
    title: () => (name ? `${name} · Rollback` : "Rollback"),
    refresh() {
      if (rollingBack) return Promise.resolve();
      return load();
    },
    destroy() {},
  };
}
