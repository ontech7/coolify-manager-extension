import { routeToHash } from "./routes.js";

/** Opens the dashboard on a route, in the tab it already has if there is one. */
export async function openDashboard(route) {
  const base = chrome.runtime.getURL("dashboard/dashboard.html");
  const url = `${base}${routeToHash(route)}`;

  const contexts = await chrome.runtime.getContexts({ contextTypes: ["TAB"] });
  const open = contexts.find((context) => context.documentUrl?.startsWith(base));

  if (open) {
    await chrome.tabs.update(open.tabId, { active: true, url });
    await chrome.windows.update(open.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url });
  }
}
