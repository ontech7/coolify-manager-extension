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

/** The Deployments tab: only what is active now, as Coolify's list has it. */
export function createDeploymentsScreen(ctx) {
  const store = createListStore(async () =>
    sortNewestFirst(await ctx.api.getDeployments()),
  );
  const cancelling = new Set();
  let hasEntered = false;

  const el = document.createElement("div");
  el.className = "screen";
  setHtml(
    el,
    html`<div class="x-fixed" data-slot="fixed"><div class="sum" data-slot="summary"></div><div data-slot="banner"></div></div>
      <div class="x-scroll"><div data-slot="state"></div><div class="list" data-slot="list"></div></div>`,
  );

  const slot = (name) => el.querySelector(`[data-slot="${name}"]`);
  const list = slot("list");

  const renderCard = (deployment) =>
    deploymentCard(deployment, cancelling.has(deployment.deployment_uuid));

  function render() {
    const { items, isLoading, error } = store.get();

    if (isLoading || (error && items.length === 0)) {
      slot("fixed").hidden = true;
      setHtml(slot("state"), isLoading ? skeletonList(3) : errorState(error));
      renderKeyed(list, [], () => "", () => "");
      return;
    }

    slot("fixed").hidden = false;
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

    if (!hasEntered && items.length > 0) {
      hasEntered = true;
      [...list.children].forEach((card, index) => {
        card.style.setProperty("--i", index);
      });
      list.classList.add("enter");
      setTimeout(() => list.classList.remove("enter"), 400);
    }
  }

  delegate(el, {
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
    refresh: () => store.refresh(),
    activate: () => store.start(),
    deactivate: () => store.stop(),
    destroy() {
      unsubscribe();
      store.stop();
    },
  };
}
