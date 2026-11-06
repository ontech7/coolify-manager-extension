import {
  getAutoRefreshEnabled,
  onAutoRefreshChanged,
  setAutoRefreshEnabled,
} from "../lib/config-storage.js";
import {
  dashboardViewFor,
  hashToRoute,
  routeToHash,
} from "../lib/routes.js";
import { emptyState, errorState, iconButton } from "../ui/components.js";
import { delegate, html, setHtml } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import {
  performResourceAction,
  resourceActionState,
  resourceSiteUrl,
} from "../ui/resource-actions.js";
import { createResourcesStore } from "../ui/resources-store.js";
import { createScreen } from "../ui/screens/registry.js";
import { filterResources, resourceBadge } from "../ui/screens/resources.js";
import { createSurface } from "../ui/surface.js";

const SECTIONS = [
  { key: "resources", icon: "box", label: "Resources" },
  { key: "deployments", icon: "rocket", label: "Deployments" },
  { key: "servers", icon: "server", label: "Servers" },
];

const SUB_LABELS = {
  overview: "Overview",
  logs: "Logs",
  history: "History",
  rollback: "Rollback",
  backups: "Backups",
  containers: "Containers",
};

const root = document.getElementById("app");

let ctx = null;
let store = null;

let view = dashboardViewFor({ screen: "resources" });
let resourceType = null;
let selectedName = null;
// The selection must be checked against the list, once the list is known.
let needsSelection = true;
// Resources that answered 404: never selected again, so they can't loop.
const gone = new Set();

let autoRefresh = true;
// The action running on each resource: it goes on when another row is selected.
const busy = new Map();
let isRefreshing = false;
const counts = {};

const listScreens = new Map();
let shownList = null;
let detail = null; // {key, screen}

const slot = (name) => root.querySelector(`[data-slot="${name}"]`);

function typeOfRoute(route) {
  if (["application", "database", "service"].includes(route.screen)) {
    return route.screen;
  }
  if (route.screen === "history" || route.screen === "rollback") return "application";
  if (route.screen === "logs") return route.type ?? "application";
  return null;
}

function subTabsFor(type) {
  const modern = (...tabs) => (ctx.legacy ? [] : tabs);
  switch (type) {
    case "application":
      return ["overview", "logs", "history", ...modern("rollback")];
    case "database":
      return ["overview", ...modern("logs", "backups")];
    case "service":
      return ["overview", "containers", ...modern("logs")];
    default:
      return [];
  }
}

/** The route of what is showing, for the address bar. */
function currentRoute() {
  const { nav, selection, sub, container, filter, query, appUuid } = view;
  const common = { filter: filter === "all" ? undefined : filter, query };

  if (!selection) return { screen: nav, ...common };

  const { kind, uuid } = selection;
  const name = selectedName ?? undefined;
  if (kind === "deployment") {
    return { screen: "deployment", uuid, appUuid: appUuid ?? undefined, name, ...common };
  }
  if (kind === "server") return { screen: "server", uuid, name, ...common };

  if (sub === "history" || sub === "rollback") {
    return { screen: sub, uuid, name, ...common };
  }
  if (sub === "logs") {
    return { screen: "logs", uuid, type: resourceType, name, container, ...common };
  }
  return {
    screen: resourceType,
    uuid,
    name,
    sub: sub === "overview" ? undefined : sub,
    ...common,
  };
}

function syncHash() {
  history.replaceState(null, "", routeToHash(currentRoute()));
}

function findResource(uuid) {
  return store.get().resources.find((resource) => resource.uuid === uuid);
}

/** The row to light up. A deployment lights its application only if known. */
function selectedRow() {
  const { nav, selection, appUuid } = view;
  if (!selection) return null;
  if (nav === "resources" && selection.kind === "deployment") return appUuid;
  return selection.uuid;
}

function renderRail() {
  const instance = ctx.instance;
  setHtml(
    slot("rail"),
    html`<div class="d-brand"><img src="/assets/icon-48.png" alt="" width="20" height="20" />Coolify Manager</div>
      ${SECTIONS.map(
        ({ key, icon: name, label }) =>
          html`<button class="d-nav${view.nav === key ? " on" : ""}" data-action="nav" data-value="${key}"${view.nav === key ? html` aria-current="true"` : ""}>${icon(name, 15)}<span class="d-nav-label">${label}</span>${counts[key] !== undefined && html`<em>${counts[key]}</em>`}</button>`,
      )}
      <span class="d-spacer"></span>
      <button class="d-nav d-toggle${autoRefresh ? " active" : ""}" data-action="auto-refresh" aria-pressed="${String(autoRefresh)}" title="Refresh every 5s while visible">${icon("clock", 15)}<span class="d-nav-label">Auto-refresh</span></button>
      <button class="d-nav" data-action="open-instance" title="${instance.serverUrl}">${icon("ext", 15)}Open ${instance.name}</button>
      <button class="d-nav" data-action="settings">${icon("gear", 15)}<span class="d-nav-label">Settings</span></button>
      <div class="d-inst"><b>${instance.name}</b>${hostOf(instance.serverUrl)}</div>`,
  );
}

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function resourceButton(action, iconName, label, state) {
  return html`<button class="btn sec" data-action="${action}"${state.disabled || state.loading ? html` disabled` : ""}>${icon(state.loading ? "loader" : iconName, 14)}${label}</button>`;
}

function resourceHead() {
  const { uuid } = view.selection;
  const resource = findResource(uuid);
  const name = resource?.name ?? selectedName ?? uuid;
  const target = resource ?? { uuid, name, resourceType };
  const actions = resourceActionState(target, {
    legacy: ctx.legacy,
    busy: busy.get(uuid) ?? null,
  });
  const isStop = actions.startStop.kind === "stop";

  return html`<h2>${name}</h2>${resource && resourceBadge(resource)}
    <div class="grp">
      ${actions.deploy.show && resourceButton("deploy", "rocket", "Deploy", actions.deploy)}
      ${actions.pull.show && resourceButton("pull", "cloud", "Pull latest", actions.pull)}
      ${resourceButton("restart", "restart", "Restart", actions.restart)}
      ${resourceButton("start-stop", isStop ? "stop" : "play", isStop ? "Stop" : "Start", actions.startStop)}
      ${actions.site.show && iconButton({ action: "site", icon: "ext", label: "Open website", disabled: actions.site.disabled })}
      ${detail?.screen.headerActions?.()}
      ${refreshButton()}
    </div>`;
}

function refreshButton() {
  return iconButton({
    action: "refresh",
    icon: "refresh",
    label: "Refresh",
    loading: isRefreshing,
    size: 15,
  });
}

function renderHead() {
  const head = slot("head");
  const { selection } = view;
  head.hidden = !selection;
  if (!selection) {
    setHtml(head, "");
    return;
  }

  setHtml(
    head,
    selection.kind === "resource"
      ? resourceHead()
      : html`<h2>${detail?.screen.title() ?? selectedName ?? ""}</h2>
          <div class="grp">${detail?.screen.headerActions?.()}${refreshButton()}</div>`,
  );
}

function renderSubTabs() {
  const tabs = slot("subs");
  const isResource = view.selection?.kind === "resource";
  tabs.hidden = !isResource;
  setHtml(
    tabs,
    html`${
      isResource &&
      subTabsFor(resourceType).map(
        (key) =>
          html`<button class="d-sub${view.sub === key ? " on" : ""}" role="tab" aria-selected="${String(view.sub === key)}" data-action="sub" data-value="${key}">${SUB_LABELS[key]}</button>`,
      )
    }`,
  );
}

function createDetailScreen() {
  const { kind, uuid } = view.selection;
  const name = selectedName ?? undefined;
  const opts = {
    onHeaderChange: renderHead,
    onRouteChange(route) {
      view = { ...view, container: route.container };
      detail.key = detailKey();
      syncHash();
    },
  };

  if (kind === "deployment") {
    return createScreen(ctx, { screen: "deployment", uuid, appUuid: view.appUuid, name }, opts);
  }
  if (kind === "server") {
    return createScreen(ctx, { screen: "server", uuid, name }, opts);
  }

  switch (view.sub) {
    case "logs":
      return createScreen(
        ctx,
        { screen: "logs", uuid, type: resourceType, name, container: view.container ?? undefined },
        opts,
      );
    case "history":
    case "rollback":
      return createScreen(ctx, { screen: view.sub, uuid, name }, opts);
    case "backups":
    case "containers":
      return createScreen(ctx, { screen: resourceType, uuid, name }, { ...opts, section: view.sub });
    default:
      return createScreen(ctx, { screen: resourceType, uuid, name }, { ...opts, section: "overview" });
  }
}

function detailKey() {
  const { selection, sub, container } = view;
  return selection
    ? JSON.stringify([selection.kind, selection.uuid, sub, container])
    : null;
}

function renderDetail() {
  const key = detailKey();
  if (detail?.key === key) return;

  if (detail) {
    detail.screen.deactivate?.();
    detail.screen.destroy();
    detail.screen.el.remove();
    detail = null;
  }

  const content = slot("content");
  if (!view.selection) {
    setHtml(content, html`<div class="d-pane-empty">Select an item from the list.</div>`);
    return;
  }
  setHtml(content, "");

  const screen = createDetailScreen();
  detail = { key, screen };
  content.append(screen.el);
  screen.activate?.();
}

function renderPane() {
  // A sub-tab this resource or server version doesn't have falls back.
  if (view.selection?.kind === "resource") {
    const tabs = subTabsFor(resourceType);
    if (!tabs.includes(view.sub)) view = { ...view, sub: "overview" };
  }
  renderDetail();
  renderSubTabs();
  renderHead();
}

function listScreen(key) {
  if (!listScreens.has(key)) {
    const screen = createScreen(
      ctx,
      {
        screen: key,
        filter: view.filter,
        query: view.query,
      },
      {
        variant: "rows",
        store,
        selectedUuid: selectedRow(),
        onSelect: selectRow,
        onViewChange({ filter, query }) {
          view = { ...view, filter, query };
          syncHash();
        },
        onItems(items) {
          counts[key] = items.length;
          renderRail();
          if (view.nav === key) selectFromList(items);
        },
      },
    );
    screen.el.hidden = true;
    slot("list").append(screen.el);
    listScreens.set(key, screen);
  }
  return listScreens.get(key);
}

function showList() {
  const next = listScreen(view.nav);
  if (shownList !== next) {
    if (shownList) {
      shownList.deactivate?.();
      shownList.el.hidden = true;
    }
    next.el.hidden = false;
    shownList = next;
    next.activate?.();
  }
  next.setSelected?.(selectedRow());
  next.setView?.({ filter: view.filter, query: view.query });
}

/** Deployments and Servers: the first row, when nothing is selected there. */
function selectFromList(items) {
  if (view.nav === "resources" || !needsSelection) return;
  needsSelection = false;

  const first = items.find((item) => !gone.has(item.deployment_uuid ?? item.uuid));
  if (!first) {
    setSelection(null);
    return;
  }
  selectRow(first);
}

/** Resources: keep the selection if the filter does, or take the first row. */
function selectFromResources() {
  if (view.nav !== "resources" || !needsSelection) return;
  const { resources, isLoading } = store.get();
  if (isLoading) return;
  needsSelection = false;

  const visible = filterResources(resources, view.filter, view.query).filter(
    (resource) => !gone.has(resource.uuid),
  );
  const current = view.selection?.kind === "resource" ? view.selection.uuid : null;
  if (current && visible.some((resource) => resource.uuid === current)) {
    resourceType = findResource(current).resourceType;
    renderPane();
    return;
  }

  if (visible[0]) selectRow(visible[0]);
  else setSelection(null);
}

function setSelection(selection, { name = null, type = null, sub = "overview" } = {}) {
  view = { ...view, selection, sub, container: null, appUuid: null };
  selectedName = name;
  resourceType = type;
  shownList?.setSelected?.(selectedRow());
  renderPane();
  syncHash();
}

/** A click on a row, of any of the three lists. */
function selectRow(item) {
  if (view.nav === "deployments") {
    setSelection(
      { kind: "deployment", uuid: item.deployment_uuid },
      { name: item.application_name },
    );
  } else if (view.nav === "servers") {
    setSelection({ kind: "server", uuid: item.uuid }, { name: item.name });
  } else {
    setSelection(
      { kind: "resource", uuid: item.uuid },
      { name: item.name, type: item.resourceType },
    );
  }
}

function applyRoute(route) {
  const next = dashboardViewFor(route);
  const carried = next.nav === "resources" && !next.selection ? view.selection : next.selection;

  view = { ...next, selection: carried };
  if (next.selection) {
    selectedName = route.name ?? null;
    resourceType = typeOfRoute(route);
    needsSelection = false;
    // Known from the list when the route doesn't say, e.g. a hand-written hash.
    if (next.selection.kind === "resource" && !resourceType) {
      resourceType = findResource(next.selection.uuid)?.resourceType ?? "application";
    }
  } else {
    needsSelection = true;
  }

  renderRail();
  showList();
  selectFromResources();
  renderPane();
  syncHash();
}

function setBusyFor(uuid) {
  return (action) => {
    if (action) busy.set(uuid, action);
    else busy.delete(uuid);
    renderHead();
  };
}

function performOnSelected(action) {
  const resource = findResource(view.selection?.uuid);
  if (!resource) return;
  performResourceAction(ctx, action, resource, {
    setBusy: setBusyFor(resource.uuid),
    afterAction: () => store.refresh(),
  });
}

function handleNotFound(route) {
  gone.add(route.uuid);
  if (view.selection?.uuid !== route.uuid) return;

  ctx.dialogs.toast("This resource no longer exists.");
  needsSelection = true;
  setSelection(null);
  if (view.nav === "resources") selectFromResources();
  else shownList?.refresh?.();
}

function bindEvents() {
  delegate(slot("rail"), {
    nav({ value }) {
      applyRoute({ screen: value, filter: view.filter, query: view.query });
    },
    "auto-refresh"() {
      setAutoRefreshEnabled(!autoRefresh);
    },
    "open-instance"() {
      ctx.openExternal(ctx.instance.serverUrl);
    },
    settings() {
      chrome.runtime.openOptionsPage();
    },
  });

  delegate(slot("subs"), {
    sub({ value }) {
      view = { ...view, sub: value, container: value === "logs" ? view.container : null };
      renderPane();
      syncHash();
    },
  });

  const headHandlers = {
    deploy: () => performOnSelected("deploy"),
    pull: () => performOnSelected("pull"),
    restart: () => performOnSelected("restart"),
    "start-stop": () => performOnSelected("startStop"),
    site() {
      const resource = findResource(view.selection?.uuid);
      if (resource) ctx.openExternal(resourceSiteUrl(resource));
    },
    "open-deployment": ({ uuid, appUuid, name }) =>
      ctx.open({ screen: "deployment", uuid, appUuid, name }),
    async refresh() {
      if (isRefreshing || !detail) return;
      isRefreshing = true;
      renderHead();
      try {
        await Promise.all([
          detail.screen.refresh({ manual: true }),
          view.nav === "resources" ? store.refresh() : null,
        ]);
      } finally {
        isRefreshing = false;
        renderHead();
      }
    },
  };

  slot("head").addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button || button.disabled) return;
    const { action } = button.dataset;
    const handler = detail?.screen.headerHandlers?.[action] ?? headHandlers[action];
    handler?.(button.dataset, button, event);
  });

  window.addEventListener("hashchange", () => {
    applyRoute(hashToRoute(location.hash));
  });
}

/** The counts of the sections out of sight load once, when the tab opens. */
function loadCounts() {
  const load = (key, request) => {
    if (view.nav === key) return;
    request.then((items) => {
      counts[key] = items.length;
      renderRail();
    }, () => {});
  };
  if (view.nav !== "resources") store.refresh();
  load("deployments", ctx.api.getDeployments());
  load("servers", ctx.api.getServers());
}

function renderNotConfigured() {
  setHtml(
    root,
    html`<div class="d-page-state">${emptyState({
      icon: "gear",
      title: "Not Configured",
      message:
        "Please configure your Coolify server connection in Settings to get started.",
      actionLabel: "Go to Settings",
      action: "go-to-settings",
    })}</div>`,
  );
  delegate(root, {
    "go-to-settings": () => chrome.runtime.openOptionsPage(),
  });
}

async function start() {
  ctx = await createSurface({
    kind: "dashboard",
    root,
    open: (route) => applyRoute({ filter: view.filter, query: view.query, ...route }),
    back() {
      setSelection(view.selection, {
        name: selectedName,
        type: resourceType,
      });
    },
    notFound: handleNotFound,
  });

  if (!ctx.instance) {
    renderNotConfigured();
    return;
  }

  // Dialogs live in the root, next to the columns: keep them when building these.
  root.insertAdjacentHTML(
    "afterbegin",
    String(html`<nav class="d-rail" aria-label="Dashboard" data-slot="rail"></nav>
      <section class="d-list" data-slot="list"></section>
      <section class="d-pane">
        <div class="d-pane-head" data-slot="head"></div>
        <div class="d-subtabs" role="tablist" data-slot="subs"></div>
        <div class="d-content" data-slot="content"></div>
      </section>`),
  );

  store = createResourcesStore(ctx);
  store.subscribe(() => {
    counts.resources = store.get().resources.length;
    renderRail();
    selectFromResources();
    renderHead();
  });

  autoRefresh = await getAutoRefreshEnabled();
  onAutoRefreshChanged((enabled) => {
    autoRefresh = enabled;
    renderRail();
  });

  bindEvents();
  applyRoute(hashToRoute(location.hash));
  loadCounts();
}

start().catch((error) => {
  setHtml(root, html`<div class="d-page-state">${errorState(error.message)}</div>`);
});
