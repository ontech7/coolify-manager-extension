import { SERVER_ACTIONS_MIN_VERSION } from "../../lib/constants.js";
import { cleanResourceType } from "../../lib/format.js";
import { getResourceStatus } from "../../lib/status.js";
import {
  detailTable,
  errorState,
  healthPills,
  iconButton,
  loadingState,
  refreshErrorBanner,
  statusBadge,
} from "../components.js";
import { delegate, html, setHtml } from "../dom.js";
import { icon } from "../icons.js";
import { createScrollScreen, isNotFound } from "./shared.js";

const REQUIRES = `Requires Coolify ${SERVER_ACTIONS_MIN_VERSION} or newer.`;

const QUICK_ACTIONS = {
  proxy: {
    method: "restartProxy",
    label: "Restart proxy",
    confirm: {
      title: "Restart Proxy",
      message: `Every site on this server will be briefly unreachable while the proxy restarts.\n\n${REQUIRES}`,
      buttons: [
        { label: "Cancel", kind: "plain" },
        { label: "Restart", kind: "dng", value: true },
      ],
    },
  },
  cleanup: {
    method: "runDockerCleanup",
    label: "Docker cleanup",
    confirm: {
      title: "Docker Cleanup",
      message: `Remove unused images, build cache and stopped containers to free disk space?\n\n${REQUIRES}`,
      buttons: [
        { label: "Cancel", kind: "plain" },
        { label: "Clean Up", kind: "dng", value: true },
      ],
    },
  },
};

function resourceRow(resource) {
  return html`<div class="sr server-resource">
    <div class="sr-info">
      <div class="sr-name">${resource.name}</div>
      <div class="sr-meta">${cleanResourceType(resource.type)}</div>
    </div>
    ${statusBadge(getResourceStatus(resource.status))}
  </div>`;
}

/** A server: health, details, quick actions and what runs on it. */
export function createServerScreen(ctx, route, opts = {}) {
  const { uuid } = route;
  const { el, body } = createScrollScreen();

  let server = null;
  let resources = [];
  let isLoading = true;
  let isValidating = false;
  let runningAction = null;
  let error = null;
  let lastRequest = 0;

  function actionButton(key, action, iconName, label) {
    return html`<button class="btn sec" data-action="${action}"${runningAction !== null ? html` disabled` : ""}>${icon(runningAction === key ? "loader" : iconName, 15)}${label}</button>`;
  }

  function render() {
    if (isLoading) {
      setHtml(body, loadingState("Loading server..."));
      return;
    }
    if (!server) {
      setHtml(body, errorState(error || "Server not found"));
      return;
    }

    setHtml(
      body,
      html`${error && refreshErrorBanner(error)}
        <div class="server-health">${healthPills(server)}</div>
        ${
          !ctx.legacy &&
          html`<div class="acts">${actionButton("proxy", "restart-proxy", "restart", "Restart Proxy")}${actionButton("cleanup", "docker-cleanup", "trash", "Docker Cleanup")}</div>`
        }
        ${detailTable([
          { label: "UUID", value: server.uuid, mono: true, copy: true },
          { label: "Description", value: server.description },
          { label: "IP", value: server.ip, mono: true, copy: true },
          { label: "Port", value: server.port ? String(server.port) : undefined },
          { label: "User", value: server.user },
        ])}
        <span class="sec-t" data-slot="resources-title">Running Resources${resources.length ? ` (${resources.length})` : ""}</span>
        ${
          resources.length > 0
            ? html`<div class="sub">${resources.map(resourceRow)}</div>`
            : html`<p class="hint">No resources running on this server.</p>`
        }`,
    );
  }

  async function load() {
    const request = ++lastRequest;
    const [srv, res] = await Promise.allSettled([
      ctx.api.getServer(uuid),
      ctx.api.getServerResources(uuid),
    ]);
    if (request !== lastRequest) return;

    if (srv.status === "fulfilled") {
      server = srv.value;
      error = null;
    } else {
      if (!server && isNotFound(srv.reason)) {
        ctx.notFound(route);
        return;
      }
      error = srv.reason.message;
    }
    if (res.status === "fulfilled") resources = res.value ?? [];

    isLoading = false;
    render();
    opts.onHeaderChange?.();
  }

  async function runQuickAction(key) {
    const { method, label, confirm } = QUICK_ACTIONS[key];
    const confirmed = await ctx.dialogs.confirm(confirm);
    if (!confirmed) return;

    runningAction = key;
    render();
    let title = "Done";
    let message;
    try {
      const result = await ctx.actions.run(method, [uuid], {
        label: `${label} on ${server?.name ?? uuid}`,
      });
      message = result?.message ?? "";
    } catch (err) {
      title = "Error";
      message = err.message;
    }
    runningAction = null;
    render();

    await ctx.dialogs.alert(title, message);
  }

  delegate(el, {
    "restart-proxy": () => runQuickAction("proxy"),
    "docker-cleanup": () => runQuickAction("cleanup"),
    retry() {
      if (!server) {
        isLoading = true;
        render();
      }
      load();
    },
  });

  render();
  load();

  return {
    el,
    title: () => server?.name ?? route.name ?? "Server",
    headerActions: () =>
      iconButton({
        action: "validate",
        icon: "wifi",
        label: "Validate server",
        loading: isValidating,
        size: 15,
      }),
    headerHandlers: {
      async validate() {
        isValidating = true;
        opts.onHeaderChange?.();

        let failure = null;
        try {
          await ctx.actions.run("validateServer", [uuid], {
            label: `Validate ${server?.name ?? uuid}`,
          });
          await load();
        } catch (err) {
          failure = err.message;
        }
        isValidating = false;
        opts.onHeaderChange?.();

        if (failure) await ctx.dialogs.alert("Error", failure);
      },
    },
    refresh: load,
    destroy() {},
  };
}
