import { errorState } from "../components.js";
import { setHtml } from "../dom.js";
import {
  createApplicationScreen,
  createHistoryScreen,
  createRollbackScreen,
} from "./application.js";
import { createDeploymentScreen } from "./deployment.js";
import { createDeploymentsScreen } from "./deployments.js";
import { createResourcesScreen } from "./resources.js";

function createPendingScreen(route) {
  const el = document.createElement("div");
  el.className = "screen";
  setHtml(el, errorState("This screen is not available yet."));
  return {
    el,
    title: () => route.name ?? route.screen,
    refresh: async () => {},
    destroy() {},
  };
}

/** The screen of a route. Every surface builds its screens through here. */
export function createScreen(ctx, route, opts) {
  switch (route.screen) {
    case "resources":
      return createResourcesScreen(ctx, route, opts);
    case "application":
      return createApplicationScreen(ctx, route, opts);
    case "history":
      return createHistoryScreen(ctx, route, opts);
    case "rollback":
      return createRollbackScreen(ctx, route, opts);
    case "deployment":
      return createDeploymentScreen(ctx, route, opts);
    case "deployments":
      return createDeploymentsScreen(ctx, route, opts);
    default:
      return createPendingScreen(route);
  }
}
