import { HttpError } from "../../lib/coolify-api.js";
import { onPendingChanged, readPending } from "../../lib/pending.js";
import { html, setHtml } from "../dom.js";

export const isNotFound = (error) =>
  error instanceof HttpError && error.status === 404;

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
 */
export function watchResourcePending(ctx, uuid, onChange) {
  const instanceId = ctx.instance.id;
  let stopped = false;

  const stop = onPendingChanged(instanceId, (next) => {
    onChange(next[uuid] ?? null);
  });
  readPending(instanceId).then((current) => {
    if (!stopped) onChange(current[uuid] ?? null);
  });

  return () => {
    stopped = true;
    stop();
  };
}
