import { consumeActionErrors } from "../lib/action-runner.js";
import { createActionsClient } from "../lib/actions-client.js";
import {
  ensureApiMode,
  getActiveInstance,
  onConfigChanged,
} from "../lib/config-storage.js";
import { CoolifyAPI } from "../lib/coolify-api.js";
import { safeExternalUrl } from "../lib/format.js";
import { createDialogs } from "./dialog.js";
import { delegate } from "./dom.js";
import { icon } from "./icons.js";

const COPIED_FEEDBACK = 1300;

const fingerprint = (instance) =>
  instance
    ? JSON.stringify([
        instance.id,
        instance.name,
        instance.serverUrl,
        instance.apiToken,
        instance.apiMode ?? null,
      ])
    : null;

async function showStoredErrors(ctx) {
  const errors = await consumeActionErrors(ctx.instance.id);
  if (errors.length === 0) return;

  ctx.dialogs.alert(
    "Error",
    errors
      .map(({ label, message }) => (label ? `${label}: ${message}` : message))
      .join("\n"),
  );
}

/**
 * What every screen needs, for one page. `open` and `notFound` come from the
 * shell, which decides where a screen goes: on a stack or in a column.
 */
export async function createSurface({ kind, root, open, back, notFound }) {
  const dialogs = createDialogs(root);
  const instance = await getActiveInstance();

  const ctx = {
    kind,
    instance,
    api: null,
    legacy: false,
    actions: null,
    dialogs,
    open,
    back,
    notFound,

    /** Only http and https: these values come from the API. */
    openExternal(url) {
      const safe = safeExternalUrl(url);
      if (safe) chrome.tabs.create({ url: safe });
    },

    async copy(text, element) {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        dialogs.toast("Clipboard is not available here.");
        return;
      }

      if (!element || element.classList.contains("done")) return;
      const original = element.innerHTML;
      element.innerHTML = String(icon("check", 12));
      element.classList.add("done");
      setTimeout(() => {
        element.innerHTML = original;
        element.classList.remove("done");
      }, COPIED_FEEDBACK);
    },
  };

  delegate(root, {
    copy: (data, element) => ctx.copy(data.value, element),
  });

  if (instance) {
    const apiMode = await ensureApiMode(instance);
    ctx.api = new CoolifyAPI(instance.serverUrl, instance.apiToken, apiMode);
    ctx.legacy = apiMode === "legacy";
    ctx.actions = createActionsClient(instance.id);
    await showStoredErrors(ctx);
  }

  // Read after ensureApiMode, which may have just saved the mode.
  const current = fingerprint(await getActiveInstance());
  onConfigChanged(async () => {
    if (fingerprint(await getActiveInstance()) !== current) {
      location.reload();
    }
  });

  return ctx;
}
