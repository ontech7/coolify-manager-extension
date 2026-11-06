import {
  emptyState,
  errorState,
  healthPills,
  iconButton,
  refreshErrorBanner,
  skeletonList,
} from "../components.js";
import { delegate, html, renderKeyed, setHtml } from "../dom.js";
import { createListStore } from "../list-store.js";

function serverAddress(server) {
  const address = server.ip
    ? `${server.ip}${server.port ? `:${server.port}` : ""}`
    : "n/a";
  return `${server.user ? `${server.user}@` : ""}${address}`;
}

function serverCard(server, isValidating) {
  const { uuid, name } = server;
  return html`<article class="card" data-action="open-server" data-uuid="${uuid}" data-name="${name}">
    <div class="c-top">
      <div class="c-info">
        <button class="c-name" data-action="open-server" data-uuid="${uuid}" data-name="${name}" title="${name}">${name}</button>
        ${server.description && html`<div class="c-sub"><span>${server.description}</span></div>`}
      </div>
      ${iconButton({ action: "validate", icon: "wifi", label: "Validate server", loading: isValidating, data: { uuid } })}
    </div>
    <div class="mono server-address">${serverAddress(server)}</div>
    ${healthPills(server)}
  </article>`;
}

function serverRow(server, isSelected) {
  const reachable = Boolean(server.settings?.is_reachable);
  return html`<button class="d-row${isSelected ? " on" : ""}" data-action="select" data-uuid="${server.uuid}"${isSelected ? html` aria-current="true"` : ""}>
    <div class="d-row-top"><span class="c-name">${server.name}</span><span class="badge ${reachable ? "ok" : "err"}"><i class="dot"></i>${reachable ? "Reachable" : "Unreachable"}</span></div>
    <div class="c-sub"><span class="mono">${server.ip ?? ""}</span></div>
  </button>`;
}

function subtitle(servers) {
  const unreachable = servers.filter((s) => !s.settings?.is_reachable).length;
  return unreachable > 0
    ? `${unreachable} of ${servers.length} unreachable`
    : `All ${servers.length} reachable`;
}

/** The Servers tab. */
export function createServersScreen(ctx, _route, opts = {}) {
  const store = createListStore(() => ctx.api.getServers());
  const validating = new Set();
  let hasEntered = false;
  const isRows = opts.variant === "rows";
  let selectedUuid = opts.selectedUuid ?? null;

  const el = document.createElement("div");
  el.className = "screen";
  setHtml(
    el,
    isRows
      ? html`<div class="d-list-head"><h2>Servers</h2><div class="sum" data-slot="summary"></div><div data-slot="banner"></div></div>
          <div class="d-rows"><div data-slot="state"></div><div class="d-rows-list" data-slot="list"></div></div>`
      : html`<div class="x-fixed" data-slot="fixed"><div class="sum" data-slot="summary"></div><div data-slot="banner"></div></div>
          <div class="x-scroll"><div data-slot="state"></div><div class="list" data-slot="list"></div></div>`,
  );

  const slot = (name) => el.querySelector(`[data-slot="${name}"]`);
  const list = slot("list");

  const renderCard = (server) =>
    isRows
      ? serverRow(server, server.uuid === selectedUuid)
      : serverCard(server, validating.has(server.uuid));

  function render() {
    const { items, isLoading, error } = store.get();

    if (!isLoading) opts.onItems?.(items);

    if (isLoading || (error && items.length === 0)) {
      if (slot("fixed")) slot("fixed").hidden = true;
      setHtml(slot("state"), isLoading ? skeletonList(3) : errorState(error));
      renderKeyed(list, [], () => "", () => "");
      return;
    }

    if (slot("fixed")) slot("fixed").hidden = false;
    setHtml(slot("summary"), html`<span>${items.length > 0 ? subtitle(items) : ""}</span>`);
    setHtml(slot("banner"), error ? refreshErrorBanner(error) : "");
    setHtml(
      slot("state"),
      items.length === 0
        ? emptyState({
            icon: "server",
            title: "No Servers",
            message: "No servers found on your Coolify instance.",
            actionLabel: "Refresh",
            action: "retry",
          })
        : "",
    );

    renderKeyed(list, items, (item) => item.uuid, renderCard);

    if (!isRows && !hasEntered && items.length > 0) {
      hasEntered = true;
      [...list.children].forEach((card, index) => {
        card.style.setProperty("--i", index);
      });
      list.classList.add("enter");
      setTimeout(() => list.classList.remove("enter"), 400);
    }
  }

  delegate(el, {
    select({ uuid }) {
      const item = store.get().items.find((server) => server.uuid === uuid);
      if (item) opts.onSelect?.(item);
    },
    "open-server": ({ uuid, name }) => ctx.open({ screen: "server", uuid, name }),
    async validate({ uuid }) {
      const server = store.get().items.find((item) => item.uuid === uuid);
      validating.add(uuid);
      render();

      let failure = null;
      try {
        await ctx.actions.run("validateServer", [uuid], {
          label: `Validate ${server?.name ?? uuid}`,
        });
        await store.refresh();
      } catch (err) {
        failure = err.message;
      }
      validating.delete(uuid);
      render();

      if (failure) await ctx.dialogs.alert("Error", failure);
    },
    retry: () => store.refresh(),
  });

  const unsubscribe = store.subscribe(render);
  render();

  return {
    el,
    title: () => "Servers",
    setSelected(uuid) {
      selectedUuid = uuid;
      render();
    },
    refresh: () => store.refresh(),
    activate: () => store.start(),
    deactivate: () => store.stop(),
    destroy() {
      unsubscribe();
      store.stop();
    },
  };
}
