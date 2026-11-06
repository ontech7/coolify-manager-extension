import { formatDateTime } from "../../lib/format.js";
import { getResourceStatus, isResourceRunning } from "../../lib/status.js";
import {
  detailTable,
  errorState,
  iconButton,
  linkList,
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

const containerName = (container) => container.human_name || container.name;

function serviceDetails(service) {
  return detailTable([
    { label: "UUID", value: service.uuid, mono: true, copy: true },
    { label: "Type", value: service.service_type },
    { label: "Description", value: service.description },
    {
      label: "Created",
      value: service.created_at ? formatDateTime(service.created_at) : undefined,
    },
    {
      label: "Updated",
      value: service.updated_at ? formatDateTime(service.updated_at) : undefined,
    },
  ]);
}

/**
 * A service. `section` is overview or containers for the dashboard's sub-tabs;
 * without it, both under the status and the Logs button.
 */
export function createServiceScreen(ctx, route, { section, onHeaderChange } = {}) {
  const { uuid } = route;
  const { el, body } = createScrollScreen();

  let service = null;
  let pending = null;
  let isLoading = true;
  let error = null;
  let lastRequest = 0;
  let stopWatching = null;
  // By container uuid. Coolify only queues start and stop: keep showing
  // "Starting" or "Stopping" until the reported status moves on, so the button
  // isn't pressed twice.
  const loadingActions = new Map();
  const containerPending = new Map();

  const serviceName = () => service?.name ?? route.name ?? uuid;
  const allContainers = () => [
    ...(service?.applications ?? []).map((item) => ({ ...item, kind: "application" })),
    ...(service?.databases ?? []).map((item) => ({ ...item, kind: "database" })),
  ];
  const findContainer = (containerUuid) =>
    allContainers().find((item) => item.uuid === containerUuid);

  function pendingKindOf(container) {
    const entry = containerPending.get(container.uuid);
    return entry && entry.fromStatus === container.status ? entry.kind : null;
  }

  function containerRow(container) {
    const name = containerName(container);
    const isRunning = isResourceRunning(container.status);
    const loadingAction = loadingActions.get(container.uuid) ?? null;
    const pendingKind = pendingKindOf(container);
    const data = { container: container.uuid };

    return html`<div class="ct">
      <div class="c-top">
        <div class="c-info">
          <div class="sr-name">${name}</div>
          ${container.image && html`<div class="sr-meta mono">${container.image}</div>`}
        </div>
        ${statusBadge(pendingKind ?? getResourceStatus(container.status))}
      </div>
      ${linkList(container.fqdn)}
      ${
        !ctx.legacy &&
        html`<div class="c-acts">
          <div class="grp">
            ${iconButton({ action: "container-restart", icon: "restart", label: `Restart ${name}`, variant: "restart", data, loading: loadingAction === "restart", disabled: loadingAction !== null || !isRunning || Boolean(pendingKind) })}
            ${iconButton({ action: "container-start-stop", icon: isRunning ? "stop" : "play", label: `${isRunning ? "Stop" : "Start"} ${name}`, variant: isRunning ? "stop" : "start", data, loading: loadingAction === "start" || loadingAction === "stop", disabled: loadingAction !== null || Boolean(pendingKind) })}
          </div>
          ${iconButton({ action: "container-logs", icon: "logs", label: `View ${name} logs`, data })}
        </div>`
      }
    </div>`;
  }

  function containersSection(containers) {
    return html`<span class="sec-t" data-slot="containers-title">Containers${containers.length ? ` (${containers.length})` : ""}</span>${
      containers.length > 0
        ? html`<div class="sub">${containers.map(containerRow)}</div>`
        : html`<p class="hint">This service has no containers.</p>`
    }`;
  }

  function render() {
    if (isLoading) {
      setHtml(body, loadingState("Loading service..."));
      return;
    }
    if (!service) {
      setHtml(body, errorState(error || "Service not found"));
      return;
    }

    const containers = allContainers();
    const resource = { uuid, name: serviceName(), status: service.status, ...(pending && { pending }) };

    setHtml(
      body,
      html`${error && refreshErrorBanner(error)}${
        !section &&
        html`<div class="row-status">${resourceBadge(resource)}</div>${
          !ctx.legacy &&
          containers.length > 0 &&
          html`<div class="acts"><button class="btn sec" data-action="logs">${icon("logs", 15)}Logs</button></div>`
        }`
      }${section !== "containers" && serviceDetails(service)}${section !== "overview" && containersSection(containers)}`,
    );
  }

  async function load() {
    const request = ++lastRequest;
    const fetchStartedAt = Date.now();
    try {
      const next = await ctx.api.getService(uuid);
      if (request !== lastRequest) return;
      service = next;
      error = null;
      if (!section) settleResourcePending(ctx, { uuid, status: next.status }, fetchStartedAt);
    } catch (err) {
      if (request !== lastRequest) return;
      if (!service && isNotFound(err)) {
        ctx.notFound(route);
        return;
      }
      error = err.message;
    }
    isLoading = false;
    render();
    onHeaderChange?.();
  }

  async function runContainerAction(container, action) {
    const name = containerName(container);
    loadingActions.set(container.uuid, action);
    if (action !== "restart") {
      containerPending.set(container.uuid, {
        kind: action === "start" ? "starting" : "stopping",
        fromStatus: container.status,
      });
    }
    render();

    let failure = null;
    try {
      const verb = action[0].toUpperCase() + action.slice(1);
      await ctx.actions.run(
        "serviceContainerAction",
        [uuid, container.kind, container.uuid, action],
        { label: `${verb} ${name}` },
      );
      await load();
    } catch (err) {
      containerPending.delete(container.uuid);
      failure = err.message;
    }
    loadingActions.delete(container.uuid);
    render();

    if (failure) await ctx.dialogs.alert("Error", failure);
  }

  delegate(el, {
    logs: () => ctx.open({ screen: "logs", uuid, type: "service", name: serviceName() }),
    "open-deployment": ({ uuid: deploymentUuid, appUuid, name }) =>
      ctx.open({ screen: "deployment", uuid: deploymentUuid, appUuid, name }),
    "container-logs": ({ container }) =>
      ctx.open({ screen: "logs", uuid, type: "service", name: serviceName(), container }),
    async "container-restart"({ container: containerUuid }) {
      const container = findContainer(containerUuid);
      if (!container) return;
      const confirmed = await ctx.dialogs.confirm({
        title: "Restart",
        message: `Are you sure you want to restart "${containerName(container)}"?`,
        buttons: [
          { label: "Cancel", kind: "plain" },
          { label: "Restart", kind: "pri", value: true },
        ],
      });
      if (confirmed) runContainerAction(container, "restart");
    },
    async "container-start-stop"({ container: containerUuid }) {
      const container = findContainer(containerUuid);
      if (!container) return;
      if (!isResourceRunning(container.status)) {
        runContainerAction(container, "start");
        return;
      }
      const confirmed = await ctx.dialogs.confirm({
        title: "Stop",
        message: `Are you sure you want to stop "${containerName(container)}"?`,
        buttons: [
          { label: "Cancel", kind: "plain" },
          { label: "Stop", kind: "dng", value: true },
        ],
      });
      if (confirmed) runContainerAction(container, "stop");
    },
    retry() {
      if (!service) {
        isLoading = true;
        render();
      }
      load();
    },
  });

  render();

  return {
    el,
    title: () => service?.name ?? route.name ?? "Service",
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
