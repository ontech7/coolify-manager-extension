import {
  LIVE_DEPLOYMENT_REFRESH_INTERVAL,
  LOG_LINES,
} from "../../lib/constants.js";
import { formatDateTime, tailDeploymentLogs } from "../../lib/format.js";
import { createPoller } from "../../lib/poll.js";
import { getDeploymentStatus, isDeploymentActive } from "../../lib/status.js";
import {
  detailTable,
  errorState,
  iconButton,
  loadingState,
  statusBadge,
} from "../components.js";
import { createLogFollower, delegate, html, setHtml } from "../dom.js";
import { icon } from "../icons.js";
import { isNotFound } from "./shared.js";

/** The dialog of the app, then the action. Failures show in a dialog. */
export async function confirmCancelDeployment(ctx, uuid, { setBusy, afterAction }) {
  const confirmed = await ctx.dialogs.confirm({
    title: "Cancel Deployment",
    message: "Are you sure you want to cancel this deployment?",
    buttons: [
      { label: "No", kind: "plain" },
      { label: "Yes, Cancel", kind: "dng", value: true },
    ],
  });
  if (!confirmed) return;

  setBusy?.(true);
  let failure = null;
  try {
    await ctx.actions.run("cancelDeployment", [uuid], {
      label: "Cancel deployment",
    });
    await afterAction?.();
  } catch (error) {
    failure = error.message;
  }
  setBusy?.(false);

  if (failure) await ctx.dialogs.alert("Error", failure);
}

function deploymentDetails(deployment) {
  const yesNo = (value) => (value ? "Yes" : "No");
  return detailTable([
    { label: "UUID", value: deployment.deployment_uuid, mono: true, copy: true },
    { label: "Application", value: deployment.application_name },
    { label: "Server", value: deployment.server_name },
    {
      label: "Commit",
      value: deployment.commit || "n/a",
      mono: true,
      copy: Boolean(deployment.commit),
    },
    { label: "Message", value: deployment.commit_message || "n/a" },
    { label: "Git Type", value: deployment.git_type || "n/a" },
    { label: "Webhook", value: yesNo(deployment.is_webhook) },
    { label: "API Triggered", value: yesNo(deployment.is_api) },
    { label: "Force Rebuild", value: yesNo(deployment.force_rebuild) },
    { label: "Restart Only", value: yesNo(deployment.restart_only) },
    { label: "Created", value: formatDateTime(deployment.created_at) },
    { label: "Updated", value: formatDateTime(deployment.updated_at) },
  ]);
}

/** A deployment: live every 3 s while it runs, with the logs first. */
export function createDeploymentScreen(ctx, route, opts = {}) {
  const { uuid } = route;

  let deployment = null;
  let isLoading = true;
  let isCancelling = false;
  let error = null;
  let showFullLog = false;
  let lastRequest = 0;

  const el = document.createElement("div");
  el.className = "screen";
  setHtml(
    el,
    html`<div class="x-scroll" data-slot="state"></div>
      <div class="dep" data-slot="view" hidden>
        <div data-slot="banner"></div>
        <div class="dep-top" data-slot="top"></div>
        <details class="dep-meta"><summary>Deployment details</summary><div data-slot="details"></div></details>
        <div class="logs-h" data-slot="logs-head"></div>
        <div class="logwrap" data-slot="logs">
          <div class="logbox" data-slot="log-scroll"><pre class="logs" data-slot="log-text"></pre></div>
          <button class="ib tolatest" data-action="to-latest" aria-label="Scroll to latest" title="Scroll to latest">${icon("down", 15)}</button>
        </div>
      </div>`,
  );

  const slot = (name) => el.querySelector(`[data-slot="${name}"]`);
  const logText = slot("log-text");
  const follower = createLogFollower(slot("log-scroll"));

  const isActive = () => isDeploymentActive(deployment?.status);

  function render() {
    if (!deployment) {
      slot("view").hidden = true;
      slot("state").hidden = false;
      setHtml(
        slot("state"),
        isLoading
          ? loadingState("Loading deployment...")
          : errorState(error || "Deployment not found"),
      );
      return;
    }

    slot("state").hidden = true;
    slot("view").hidden = false;
    const active = isActive();
    const logs = tailDeploymentLogs(
      deployment.logs,
      showFullLog && !active ? Infinity : LOG_LINES,
    );

    // A failed poll keeps the last state on screen: say it's stale.
    setHtml(
      slot("banner"),
      error ? html`<div class="banner" role="status"><span>${error}</span></div>` : "",
    );
    setHtml(
      slot("top"),
      html`${statusBadge(getDeploymentStatus(deployment.status))}${
        active &&
        html`<span class="hint">Live · updates every ${LIVE_DEPLOYMENT_REFRESH_INTERVAL / 1000}s</span>`
      }`,
    );
    setHtml(slot("details"), deploymentDetails(deployment));

    slot("logs-head").hidden = !logs.text;
    slot("logs").hidden = !logs.text;
    setHtml(
      slot("logs-head"),
      html`<span class="sec-t">Build Logs</span>${
        logs.isTruncated && html`<span class="hint">Last ${LOG_LINES} lines</span>`
      }${
        logs.isTruncated &&
        !active &&
        html`<button class="lnkbtn" data-action="show-full-log">Show full log</button>`
      }`,
    );

    if (logText.textContent !== logs.text) {
      logText.textContent = logs.text;
      follower.onContentChanged();
    }
  }

  async function load({ manual = false } = {}) {
    const request = ++lastRequest;
    try {
      const next = await ctx.api.getDeployment(uuid);
      if (request !== lastRequest) return;
      const wasShown = deployment !== null;
      deployment = next;
      error = null;
      isLoading = false;
      render();
      opts.onHeaderChange?.();
      if (!wasShown) follower.toLatest();
    } catch (err) {
      if (request !== lastRequest) return;
      if (!deployment && isNotFound(err)) {
        ctx.notFound(route);
        return;
      }
      error = err.message;
      isLoading = false;
      render();
      // The screen keeps the last state: say why a refresh changed nothing.
      if (manual && deployment) await ctx.dialogs.alert("Error", err.message);
    }
  }

  const poller = createPoller({
    refresh: () => load(),
    interval: LIVE_DEPLOYMENT_REFRESH_INTERVAL,
    isEnabled: isActive,
  });

  delegate(el, {
    retry() {
      isLoading = true;
      render();
      load();
    },
    "to-latest": () => follower.toLatest(),
    "show-full-log"() {
      showFullLog = true;
      render();
    },
  });

  render();

  return {
    el,
    title: () => deployment?.application_name || route.name || "Deployment",
    headerActions: () =>
      isActive()
        ? iconButton({
            action: "cancel-deployment",
            icon: "x",
            label: "Cancel deployment",
            variant: "stop",
            loading: isCancelling,
            size: 15,
          })
        : "",
    headerHandlers: {
      "cancel-deployment": () =>
        confirmCancelDeployment(ctx, uuid, {
          setBusy(isBusy) {
            isCancelling = isBusy;
            opts.onHeaderChange?.();
          },
          afterAction: () => load(),
        }),
    },
    refresh: ({ manual = false } = {}) => load({ manual }),
    activate() {
      load();
      poller.start();
    },
    deactivate: () => poller.stop(),
    destroy: () => poller.stop(),
  };
}
