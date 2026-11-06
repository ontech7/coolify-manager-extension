import { AUTO_REFRESH_INTERVAL, LOG_LINES } from "../../lib/constants.js";
import { createPoller } from "../../lib/poll.js";
import { errorState, filterChips, loadingState } from "../components.js";
import { createLogFollower, delegate, html, setHtml } from "../dom.js";
import { icon } from "../icons.js";
import { isNotFound } from "./shared.js";

const NO_LOGS = "No logs available";
const NO_CONTAINERS = "This service has no containers.";

/**
 * Logs of an application, a database or one container of a service. They load
 * on open and refresh by themselves only with Live on.
 */
export function createLogsScreen(ctx, route, opts = {}) {
  const { uuid, name } = route;
  const type = route.type ?? "application";

  let containers = [];
  let container = null;
  let hasLogs = false;
  let isLoading = true;
  let error = null;
  let live = false;
  // Only the latest request may update the screen: switching container while a
  // request is in flight must not show the previous container's logs.
  let lastRequest = 0;

  const el = document.createElement("div");
  el.className = "screen";
  setHtml(
    el,
    html`<div class="x-fixed logs-chips" data-slot="chips" hidden></div>
      <div class="x-scroll" data-slot="state"></div>
      <div class="x-raw" data-slot="view" hidden>
        <div data-slot="banner" class="logs-banner"></div>
        <div class="logwrap">
          <div class="logbox" data-slot="log-scroll"><pre class="logs" data-slot="log-text"></pre></div>
          <button class="ib tolatest" data-action="to-latest" aria-label="Scroll to latest" title="Scroll to latest">${icon("down", 15)}</button>
        </div>
      </div>`,
  );

  const slot = (key) => el.querySelector(`[data-slot="${key}"]`);
  const logText = slot("log-text");
  const follower = createLogFollower(slot("log-scroll"));

  function render() {
    const chips = slot("chips");
    chips.hidden = containers.length < 2;
    setHtml(
      chips,
      containers.length > 1
        ? filterChips(
            containers.map((item) => ({
              value: item.uuid,
              label: item.human_name || item.name,
            })),
            container?.uuid,
            "container",
          )
        : "",
    );

    const showState = isLoading || (error && !hasLogs);
    slot("state").hidden = !showState;
    slot("view").hidden = showState;

    if (isLoading) {
      setHtml(slot("state"), loadingState("Loading logs..."));
    } else if (error && !hasLogs) {
      setHtml(
        slot("state"),
        error === NO_CONTAINERS
          ? html`<div class="empty"><p>${error}</p></div>`
          : errorState(error),
      );
    } else {
      setHtml(
        slot("banner"),
        error ? html`<div class="banner" role="status"><span>${error}</span></div>` : "",
      );
    }
  }

  function showLogs(text) {
    const wasHidden = !hasLogs;
    hasLogs = true;
    if (logText.textContent !== text) {
      logText.textContent = text;
    }
    render();
    if (wasHidden) follower.toLatest();
    else follower.onContentChanged();
  }

  function requestLogs() {
    if (type === "database") return ctx.api.getDatabaseLogs(uuid, LOG_LINES);
    if (type === "service") {
      return ctx.api.getServiceLogs(uuid, container.name, LOG_LINES);
    }
    return ctx.api.getApplicationLogs(uuid, LOG_LINES);
  }

  async function fetchLogs() {
    if (type === "service" && !container) return;

    const request = ++lastRequest;
    try {
      const result = await requestLogs();
      if (request !== lastRequest) return;
      isLoading = false;
      error = null;
      showLogs(result.logs || NO_LOGS);
    } catch (err) {
      if (request !== lastRequest) return;
      if (!hasLogs && isNotFound(err)) {
        ctx.notFound(route);
        return;
      }
      isLoading = false;
      error = err.message;
      render();
    }
  }

  // A service is a group of containers: load them first, logs are per container.
  async function loadContainers() {
    try {
      const service = await ctx.api.getService(uuid);
      containers = [...(service.applications ?? []), ...(service.databases ?? [])];
      container =
        containers.find((item) => item.uuid === route.container) ??
        containers[0] ??
        null;
      if (!container) {
        isLoading = false;
        error = NO_CONTAINERS;
      }
    } catch (err) {
      if (isNotFound(err)) {
        ctx.notFound(route);
        return;
      }
      isLoading = false;
      error = err.message;
    }
    render();
  }

  async function load() {
    if (type === "service" && !container) await loadContainers();
    await fetchLogs();
  }

  const poller = createPoller({
    refresh: fetchLogs,
    interval: AUTO_REFRESH_INTERVAL,
    isEnabled: () => live,
  });

  delegate(el, {
    container({ value }) {
      if (value === container?.uuid) return;
      container = containers.find((item) => item.uuid === value) ?? container;
      route.container = container.uuid;
      opts.onRouteChange?.(route);
      isLoading = true;
      hasLogs = false;
      error = null;
      logText.textContent = "";
      render();
      fetchLogs();
    },
    "to-latest": () => follower.toLatest(),
    retry() {
      isLoading = true;
      error = null;
      render();
      load();
    },
  });

  function liveButton() {
    return html`<button class="livebtn${live ? " on" : ""}" data-action="live" aria-pressed="${String(live)}" title="Refresh these logs automatically">${icon("live", 13)}Live</button>`;
  }

  render();

  return {
    el,
    title: () => (name ? `${name} · Logs` : "Logs"),
    headerActions: liveButton,
    headerHandlers: {
      live() {
        live = !live;
        opts.onHeaderChange?.();
        if (live) {
          follower.toLatest();
          fetchLogs();
        }
      },
    },
    refresh: load,
    activate() {
      poller.start();
      load();
    },
    deactivate: () => poller.stop(),
    destroy: () => poller.stop(),
  };
}
