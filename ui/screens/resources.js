import { getResourceStatus, summarizeStatuses } from "../../lib/status.js";
import {
  emptyState,
  errorState,
  filterChips,
  iconButton,
  refreshErrorBanner,
  skeletonList,
  statusBadge,
  typeChip,
} from "../components.js";
import { delegate, html, renderKeyed, setHtml } from "../dom.js";
import {
  performResourceAction,
  resourceActionState,
  resourceSiteUrl,
} from "../resource-actions.js";
import { createResourcesStore } from "../resources-store.js";

const FILTERS = [
  { key: "all", label: "All", searchLabel: "resources" },
  { key: "application", label: "Apps", searchLabel: "applications" },
  { key: "database", label: "DBs", searchLabel: "databases" },
  { key: "service", label: "Services", searchLabel: "services" },
];

const STAGGER = 28;
const ENTRANCE = 240;

function statusSummary(resources) {
  const summary = summarizeStatuses(resources);
  const items = [
    ["running", "var(--success)"],
    ["unhealthy", "var(--warning)"],
    ["stopped", "var(--error)"],
  ].filter(([key]) => summary[key] > 0);

  return html`<div class="sum">${items.map(
    ([key, color]) =>
      html`<span style="color:${color}"><i class="sdot"></i><b>${summary[key]}</b> ${key}</span>`,
  )}</div>`;
}

export function filterResources(resources, filter, query) {
  const q = query.trim().toLowerCase();
  return resources.filter(
    (r) =>
      (filter === "all" || r.resourceType === filter) &&
      (!q ||
        r.name.toLowerCase().includes(q) ||
        (r.subtitle?.toLowerCase().includes(q) ?? false)),
  );
}

export function resourceBadge(resource) {
  const { pending } = resource;
  if (pending?.kind === "deploying") {
    return statusBadge("deploying", {
      action: "open-deployment",
      data: {
        uuid: pending.deploymentUuid,
        appUuid: resource.uuid,
        name: resource.name,
      },
    });
  }
  return statusBadge(pending?.kind ?? getResourceStatus(resource.status));
}

function resourceCard(resource, state) {
  const { uuid, resourceType, name } = resource;
  const data = { uuid };
  const { deploy, pull, restart, startStop, logs, site } = state;
  const isStop = startStop.kind === "stop";

  return html`<article class="card" data-action="open-resource" data-uuid="${uuid}" data-type="${resourceType}" data-name="${name}">
    <div class="c-top">
      <div class="c-info">
        <button class="c-name" data-action="open-resource" data-uuid="${uuid}" data-type="${resourceType}" title="${name}">${name}</button>
        <div class="c-sub">${typeChip(resourceType)}<span>${resource.subtitle ?? ""}</span></div>
      </div>
      ${resourceBadge(resource)}
    </div>
    <div class="c-acts">
      <div class="grp">
        ${deploy.show && iconButton({ action: "deploy", icon: "rocket", label: "Deploy", variant: "deploy", data, ...deploy })}
        ${pull.show && iconButton({ action: "pull", icon: "cloud", label: "Pull latest images", variant: "deploy", data, ...pull })}
        ${iconButton({ action: "restart", icon: "restart", label: "Restart", variant: "restart", data, ...restart })}
        ${iconButton({ action: "start-stop", icon: isStop ? "stop" : "play", label: isStop ? "Stop" : "Start", variant: isStop ? "stop" : "start", data, disabled: startStop.disabled, loading: startStop.loading })}
      </div>
      <div class="grp">
        ${logs.show && iconButton({ action: "logs", icon: "logs", label: "View logs", data, ...logs })}
        ${site.show && iconButton({ action: "site", icon: "ext", label: "Open website", data, ...site })}
      </div>
    </div>
  </article>`;
}

/** The screen of a resource's detail. */
export function resourceRoute({ uuid, resourceType, name }) {
  return { screen: resourceType, uuid, name };
}

export function createResourcesScreen(ctx, route, opts = {}) {
  const store = opts.store ?? createResourcesStore(ctx);
  const ownsStore = !opts.store;

  let filter = route.filter ?? "all";
  let query = route.query ?? "";
  let searching = query !== "";
  let hasEntered = false;
  const busy = new Map();

  const el = document.createElement("div");
  el.className = "screen";
  setHtml(
    el,
    html`<div class="x-fixed" data-slot="fixed">
        <div data-slot="summary"></div>
        <div class="toolbar" data-slot="toolbar"></div>
        <div data-slot="banner"></div>
      </div>
      <div class="x-scroll">
        <div data-slot="state"></div>
        <div class="list" data-slot="list"></div>
      </div>`,
  );

  const slot = (name) => el.querySelector(`[data-slot="${name}"]`);
  const fixed = slot("fixed");
  const list = slot("list");

  const findResource = (uuid) =>
    store.get().resources.find((resource) => resource.uuid === uuid);

  function renderCard(resource) {
    return resourceCard(
      resource,
      resourceActionState(resource, {
        legacy: ctx.legacy,
        busy: busy.get(resource.uuid) ?? null,
      }),
    );
  }

  function toolbar(resources) {
    if (searching) {
      const { searchLabel } = FILTERS.find((f) => f.key === filter);
      return html`<input class="inp" id="resource-search" type="search" placeholder="Search ${searchLabel}…" aria-label="Search ${searchLabel}" autocomplete="off" />${iconButton(
        { action: "search-close", icon: "x", label: "Close search" },
      )}`;
    }

    const items = FILTERS.map(({ key, label }) => {
      const count =
        key === "all"
          ? resources.length
          : resources.filter((r) => r.resourceType === key).length;
      return { value: key, label: `${label} ${count}` };
    });
    return html`${filterChips(items, filter, "filter")}${iconButton({
      action: "search-open",
      icon: "search",
      label: "Search",
    })}`;
  }

  function playEntrance() {
    hasEntered = true;
    [...list.children].forEach((card, index) => {
      card.style.setProperty("--i", index);
    });
    list.classList.add("enter");
    setTimeout(
      () => list.classList.remove("enter"),
      ENTRANCE + STAGGER * list.children.length,
    );
  }

  function render() {
    const { resources, isLoading, error } = store.get();

    if (isLoading || (error && resources.length === 0)) {
      fixed.hidden = true;
      setHtml(slot("state"), isLoading ? skeletonList() : errorState(error));
      renderKeyed(list, [], () => "", () => "");
      return;
    }

    fixed.hidden = false;
    setHtml(slot("summary"), statusSummary(resources));
    setHtml(slot("toolbar"), toolbar(resources));
    // A saved search comes back with its text.
    const field = slot("toolbar").querySelector("input");
    if (field && field.value !== query) field.value = query;
    setHtml(slot("banner"), error ? refreshErrorBanner(error) : "");

    const visible = filterResources(resources, filter, query);

    if (visible.length > 0) {
      setHtml(slot("state"), "");
    } else if (resources.length > 0) {
      setHtml(
        slot("state"),
        emptyState({
          icon: "search",
          title: "No Matches",
          message: "Nothing matches the current filter or search.",
          actionLabel: "Clear Filters",
          action: "clear-filters",
        }),
      );
    } else {
      setHtml(
        slot("state"),
        emptyState({
          icon: "box",
          title: "No Resources",
          message:
            "No applications, databases or services found on your Coolify server.",
          actionLabel: "Refresh",
          action: "retry",
        }),
      );
    }

    renderKeyed(list, visible, (resource) => resource.uuid, renderCard);
    if (!hasEntered && visible.length > 0) playEntrance();
  }

  function viewChanged() {
    opts.onViewChange?.({ filter, query });
  }

  function setBusyFor(uuid) {
    return (action) => {
      if (action) busy.set(uuid, action);
      else busy.delete(uuid);
      render();
    };
  }

  function perform(action, uuid) {
    const resource = findResource(uuid);
    if (!resource) return;
    performResourceAction(ctx, action, resource, {
      setBusy: setBusyFor(uuid),
      afterAction: () => store.refresh(),
    });
  }

  const openResource = ({ uuid }) => {
    const resource = findResource(uuid);
    if (resource) ctx.open(resourceRoute(resource));
  };

  delegate(el, {
    "open-resource": openResource,
    "open-deployment": ({ uuid, appUuid, name }) =>
      ctx.open({ screen: "deployment", uuid, appUuid, name }),
    deploy: ({ uuid }) => perform("deploy", uuid),
    pull: ({ uuid }) => perform("pull", uuid),
    restart: ({ uuid }) => perform("restart", uuid),
    "start-stop": ({ uuid }) => perform("startStop", uuid),
    logs: ({ uuid }) => {
      const resource = findResource(uuid);
      if (resource) {
        ctx.open({
          screen: "logs",
          uuid,
          type: resource.resourceType,
          name: resource.name,
        });
      }
    },
    site: ({ uuid }) => {
      const resource = findResource(uuid);
      if (resource) ctx.openExternal(resourceSiteUrl(resource));
    },
    filter: ({ value }) => {
      filter = value;
      viewChanged();
      render();
    },
    "search-open": () => {
      searching = true;
      render();
      slot("toolbar").querySelector("input").focus();
    },
    "search-close": () => {
      searching = false;
      query = "";
      viewChanged();
      render();
    },
    "clear-filters": () => {
      searching = false;
      query = "";
      filter = "all";
      viewChanged();
      render();
    },
    retry: () => store.refresh({ manual: true }),
  });

  el.addEventListener("input", (event) => {
    if (event.target.id !== "resource-search") return;
    query = event.target.value;
    viewChanged();
    render();
  });

  const unsubscribe = store.subscribe(render);
  render();

  return {
    el,
    title: () => "Resources",
    refresh: ({ manual = false } = {}) => store.refresh({ manual }),
    activate: () => store.start(),
    deactivate: () => store.stop(),
    destroy() {
      unsubscribe();
      if (ownsStore) store.stop();
    },
  };
}
