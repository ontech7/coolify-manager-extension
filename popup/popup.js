import { errorState, emptyState, iconButton, skeletonList } from "../ui/components.js";
import {
  getAutoRefreshEnabled,
  onAutoRefreshChanged,
  setAutoRefreshEnabled,
} from "../lib/config-storage.js";
import { loadNavState, saveNavState } from "../lib/nav-state.js";
import { delegate, html, setHtml } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { createScreen } from "../ui/screens/registry.js";
import { createSurface } from "../ui/surface.js";

const TABS = [
  { key: "resources", icon: "box", label: "Resources" },
  { key: "deployments", icon: "rocket", label: "Deployments" },
  { key: "servers", icon: "server", label: "Servers" },
];

const root = document.getElementById("app");

setHtml(
  root,
  html`<header class="x-head" data-slot="head"></header>
    <div class="x-tabs" role="tablist" data-slot="tabs"></div>
    <div class="x-content" data-slot="content"><div class="x-scroll">${skeletonList()}</div></div>
    <footer class="x-foot" data-slot="foot"></footer>`,
);

const slot = (name) => root.querySelector(`[data-slot="${name}"]`);
const content = slot("content");

let ctx = null;
let tab = "resources";
let filter = "all";
let query = "";
let autoRefresh = true;
let isRefreshing = false;

// Screens stay alive under the one showing, with their scroll and their state.
const roots = new Map();
const stack = []; // [{route, screen}], the screen is built when first shown
let shown = null;

const openSettings = () => chrome.runtime.openOptionsPage();

function saveNav() {
  if (!ctx?.instance) return;
  saveNavState(ctx.instance.id, {
    tab,
    stack: stack.map((entry) => entry.route),
    filter,
    query,
  });
}

function mount(screen) {
  screen.el.hidden = true;
  content.append(screen.el);
  return screen;
}

function rootScreen(key) {
  if (!roots.has(key)) {
    roots.set(
      key,
      mount(
        createScreen(ctx, { screen: key, filter, query }, {
          onHeaderChange: renderHeader,
          onViewChange(view) {
            filter = view.filter;
            query = view.query;
            saveNav();
          },
        }),
      ),
    );
  }
  return roots.get(key);
}

function currentScreen() {
  const top = stack.at(-1);
  if (!top) return rootScreen(tab);
  top.screen ??= mount(
    createScreen(ctx, top.route, {
      onHeaderChange: renderHeader,
      onRouteChange: saveNav,
    }),
  );
  return top.screen;
}

function renderHeader() {
  const refresh = iconButton({
    action: "refresh",
    icon: "refresh",
    label: "Refresh",
    loading: isRefreshing,
    size: 15,
  });

  if (stack.length === 0) {
    setHtml(
      slot("head"),
      html`<img src="/assets/icon-48.png" alt="" width="22" height="22" /><h2 class="x-title">Coolify Manager</h2>
        <div class="grp">${ctx?.instance && refresh}</div>`,
    );
    return;
  }

  const title = shown?.title() ?? "";
  setHtml(
    slot("head"),
    html`${iconButton({ action: "back", icon: "back", label: "Back", size: 16 })}
      <h2 class="x-title" title="${title}">${title}</h2>
      <div class="grp">${shown?.headerActions?.()}${refresh}</div>`,
  );
}

function renderTabs() {
  const tabs = slot("tabs");
  tabs.hidden = stack.length > 0 || !ctx?.instance;
  const index = TABS.findIndex(({ key }) => key === tab);
  setHtml(
    tabs,
    html`<span class="pill"></span>${TABS.map(
      ({ key, icon: name, label }) =>
        html`<button class="x-tab" role="tab" aria-selected="${String(key === tab)}" data-action="tab" data-value="${key}">${icon(name, 14)}${label}</button>`,
    )}`,
  );
  // Set after the markup, so the pill slides instead of jumping.
  tabs.querySelector(".pill").style.setProperty("--i", index);
}

function renderFooter() {
  const foot = slot("foot");
  foot.hidden = stack.length > 0;

  const instance = ctx?.instance;
  setHtml(
    foot,
    html`${
      instance &&
      html`<button class="link${autoRefresh ? " on" : ""}" data-action="auto-refresh" aria-pressed="${String(autoRefresh)}" title="Refresh every 5s while visible">${icon("clock", 13)}Auto-refresh</button>
        <button class="link" data-action="open-instance" title="${instance.serverUrl}">Open ${instance.name}</button>`
    }<button class="link" data-action="settings">${icon("gear", 13)}Settings</button>`,
  );
}

function renderChrome() {
  renderHeader();
  renderTabs();
  renderFooter();
}

/** Shows the screen on top. `motion` is the class of the push or pop animation. */
function show(motion) {
  const next = currentScreen();
  if (shown !== next) {
    if (shown) {
      shown.deactivate?.();
      shown.el.hidden = true;
    }
    next.el.hidden = false;
    if (motion) {
      next.el.classList.remove("push", "pop");
      next.el.classList.add(motion);
    }
    shown = next;
    next.activate?.();
  }
  renderChrome();
  saveNav();
}

function removeTop() {
  const top = stack.pop();
  if (!top?.screen) return;
  if (shown === top.screen) shown = null;
  top.screen.deactivate?.();
  top.screen.destroy();
  top.screen.el.remove();
}

/** `replace` takes the place of the screen on top, as when a rollback starts. */
function push(route, { replace = false } = {}) {
  if (replace) removeTop();
  stack.push({ route, screen: null });
  show("push");
}

function pop() {
  if (stack.length === 0) return;
  removeTop();
  show("pop");
}

/** A saved or open screen whose resource is gone: back to what still exists. */
function handleNotFound(route) {
  const index = stack.findIndex(
    (entry) => entry.route.screen === route.screen && entry.route.uuid === route.uuid,
  );
  if (index === -1) return;

  while (stack.length > index) pop();
  ctx.dialogs.toast("This resource no longer exists.");
}

// Buttons a screen adds to the header belong to that screen.
slot("head").addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button || button.disabled) return;
  shown?.headerHandlers?.[button.dataset.action]?.(button.dataset, button, event);
});

delegate(root, {
  back: pop,
  async refresh() {
    if (isRefreshing || !shown) return;
    isRefreshing = true;
    renderHeader();
    try {
      await shown.refresh({ manual: true });
    } finally {
      isRefreshing = false;
      renderHeader();
    }
  },
  tab({ value }) {
    tab = value;
    show();
  },
  "auto-refresh"() {
    setAutoRefreshEnabled(!autoRefresh);
  },
  "open-instance"() {
    ctx.openExternal(ctx.instance.serverUrl);
  },
  settings: openSettings,
  "go-to-settings": openSettings,
});

function renderNotConfigured() {
  setHtml(
    content,
    html`<div class="x-scroll">${emptyState({
      icon: "gear",
      title: "Not Configured",
      message:
        "Please configure your Coolify server connection in Settings to get started.",
      actionLabel: "Go to Settings",
      action: "go-to-settings",
    })}</div>`,
  );
  renderChrome();
}

async function start() {
  ctx = await createSurface({
    kind: "popup",
    root,
    open: push,
    back: pop,
    notFound: handleNotFound,
  });

  if (!ctx.instance) {
    renderNotConfigured();
    return;
  }

  const saved = await loadNavState(ctx.instance.id);
  if (saved) {
    tab = TABS.some(({ key }) => key === saved.tab) ? saved.tab : tab;
    filter = saved.filter ?? filter;
    query = saved.query ?? query;
    stack.push(...saved.stack.map((route) => ({ route, screen: null })));
  }

  autoRefresh = await getAutoRefreshEnabled();
  onAutoRefreshChanged((enabled) => {
    autoRefresh = enabled;
    renderFooter();
  });

  content.replaceChildren();
  show();
}

start().catch((error) => {
  setHtml(content, errorState(error.message));
});
