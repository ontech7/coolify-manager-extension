import { HttpError } from "../../lib/coolify-api.js";
import { getAutoRefreshEnabled } from "../../lib/config-storage.js";
import { AUTO_REFRESH_INTERVAL } from "../../lib/constants.js";
import {
  onPendingChanged,
  prunePending,
  readPending,
  updatePending,
} from "../../lib/pending.js";
import { html, setHtml } from "../dom.js";

const RESOURCE_GONE = /^(application|database|service|server|deployment) not found\.?$/i;

/**
 * The resource itself is gone. Any other 404 ("Sub-service not found.", a route
 * the server doesn't have) says nothing about it, so it is an ordinary error.
 */
export const isNotFound = (error) =>
  error instanceof HttpError &&
  error.status === 404 &&
  RESOURCE_GONE.test(error.message);

/** A screen that is one scrolling body. */
export function createScrollScreen() {
  const el = document.createElement("div");
  el.className = "screen";
  setHtml(el, html`<div class="x-scroll" data-slot="body"></div>`);
  return { el, body: el.querySelector('[data-slot="body"]') };
}

/**
 * The pending entry of one resource, now and whenever it changes, for the
 * status on a detail screen. Returns the function that stops listening.
 *
 * With `reload`, it also looks again while the entry is there: in the popup no
 * list is running under a detail screen, so nothing else would notice that
 * Coolify has caught up.
 */
export function watchResourcePending(ctx, uuid, onChange, reload) {
  const instanceId = ctx.instance.id;
  let stopped = false;
  let timer = null;

  function show(entry) {
    onChange(entry);
    clearTimeout(timer);
    if (entry && reload) timer = setTimeout(lookAgain, AUTO_REFRESH_INTERVAL);
  }

  async function read() {
    const current = await readPending(instanceId);
    if (!stopped) show(current[uuid] ?? null);
  }

  async function lookAgain() {
    if (await getAutoRefreshEnabled()) await reload();
    if (!stopped) await read();
  }

  const stop = onPendingChanged(instanceId, (next) => {
    show(next[uuid] ?? null);
  });
  read();

  return () => {
    stopped = true;
    clearTimeout(timer);
    stop();
  };
}

/**
 * What the list does for its resources, for one a detail screen has just loaded:
 * drops its pending entry when this data answers it, or when it has expired.
 */
export async function settleResourcePending(ctx, resource, fetchStartedAt) {
  const instanceId = ctx.instance.id;
  try {
    const entry = (await readPending(instanceId))[resource.uuid];
    if (!entry) return;

    const active =
      entry.kind === "deploying" ? await ctx.api.getDeployments().catch(() => null) : null;
    await updatePending(instanceId, (current) =>
      prunePending(current, [resource], active, fetchStartedAt),
    );
  } catch {
    // Only a clean-up: the next load tries again.
  }
}
