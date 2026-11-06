import { formatRelativeTime, truncateCommit } from "../../lib/format.js";
import { getDeploymentStatus } from "../../lib/status.js";
import {
  emptyState,
  errorState,
  iconButton,
  refreshErrorBanner,
  skeletonList,
  statusBadge,
} from "../components.js";
import { delegate, html, renderKeyed, setHtml } from "../dom.js";
import { createListStore } from "../list-store.js";
import { confirmCancelDeployment } from "./deployment.js";

function sortNewestFirst(deployments) {
  const time = (deployment) => new Date(deployment.created_at).getTime() || 0;
  return [...deployments].sort((a, b) => time(b) - time(a));
}

function deploymentCard(deployment, isCancelling) {
  const uuid = deployment.deployment_uuid;
  const name = deployment.application_name ?? "";

  return html`<article class="card" data-action="open-deployment" data-uuid="${uuid}" data-name="${name}">
    <div class="c-top">
      <div class="c-info">
        <button class="c-name" data-action="open-deployment" data-uuid="${uuid}" data-name="${name}" title="${name}">${name}</button>
        <div class="c-sub"><span>${formatRelativeTime(deployment.created_at)}</span>${
          deployment.commit &&
          html`<span class="commit">${truncateCommit(deployment.commit)}</span>`
        }</div>
      </div>
      <div class="grp">
        ${iconButton({ action: "cancel-deployment", icon: "x", label: "Cancel deployment", variant: "stop", loading: isCancelling, data: { uuid } })}
        ${statusBadge(getDeploymentStatus(deployment.status))}
      </div>
    </div>
    ${deployment.commit_message && html`<div class="msg">${deployment.commit_message}</div>`}
  </article>`;
}

function deploymentRow(deployment, isSelected) {
  return html`<button class="d-row${isSelected ? " on" : ""}" data-action="select" data-uuid="${deployment.deployment_uuid}"${isSelected ? html` aria-current="true"` : ""}>
    <div class="d-row-top"><span class="c-name">${deployment.application_name ?? ""}</span>${statusBadge(getDeploymentStatus(deployment.status))}</div>
    <div class="c-sub"><span>${formatRelativeTime(deployment.created_at)}</span>${
      deployment.commit &&
      html`<span class="commit">${truncateCommit(deployment.commit)}</span>`
    }</div>
  </button>`;
}

/** The Deployments tab: only what is active now, as Coolify's list has it. */
export function createDeploymentsScreen(ctx, _route, opts = {}) {
  const store = createListStore(async () =>
    sortNewestFirst(await ctx.api.getDeployments()),
  );
  const cancelling = new Set();
  let hasEntered = false;
  const isRows = opts.variant === "rows";
  let selectedUuid = opts.selectedUuid ?? null;

  const el = document.createElement("div");
  el.className = "screen";
  setHtml(
    el,
    isRows
      ? html`<div class="d-list-head"><h2>Deployments</h2><div class="sum" data-slot="summary"></div><div data-slot="banner"></div></div>
          <div class="d-rows"><div data-slot="state"></div><div class="d-rows-list" data-slot="list"></div></div>`
      : html`<div class="x-fixed" data-slot="fixed"><div class="sum" data-slot="summary"></div><div data-slot="banner"></div></div>
          <div class="x-scroll"><div data-slot="state"></div><div class="list" data-slot="list"></div></div>`,
  );

  const slot = (name) => el.querySelector(`[data-slot="${name}"]`);
  const list = slot("list");

  const renderCard = (deployment) =>
    isRows
      ? deploymentRow(deployment, deployment.deployment_uuid === selectedUuid)
      : deploymentCard(deployment, cancelling.has(deployment.deployment_uuid));

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
    setHtml(
      slot("summary"),
      html`<span>${items.length > 0 ? html`<b>${items.length}</b> active` : "Active & in progress"}</span>`,
    );
    setHtml(slot("banner"), error ? refreshErrorBanner(error) : "");
    setHtml(
      slot("state"),
      items.length === 0
        ? emptyState({
            icon: "rocket",
            title: "No Active Deployments",
            message:
              "Nothing is deploying right now. This tab shows active and in-progress deployments. To see past deployments, open an application and tap the history icon.",
            actionLabel: "Refresh",
            action: "retry",
          })
        : "",
    );

    renderKeyed(list, items, (item) => item.deployment_uuid, renderCard);

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
      const item = store.get().items.find((d) => d.deployment_uuid === uuid);
      if (item) opts.onSelect?.(item);
    },
    "open-deployment": ({ uuid, name }) =>
      ctx.open({ screen: "deployment", uuid, name }),
    async "cancel-deployment"({ uuid }) {
      await confirmCancelDeployment(ctx, uuid, {
        setBusy(isBusy) {
          if (isBusy) cancelling.add(uuid);
          else cancelling.delete(uuid);
          render();
        },
        afterAction: () => store.refresh(),
      });
    },
    retry: () => store.refresh(),
  });

  const unsubscribe = store.subscribe(render);
  render();

  return {
    el,
    title: () => "Deployments",
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
