import {
  createApplicationScreen,
  createHistoryScreen,
  createRollbackScreen,
} from "./application.js";
import { createDatabaseScreen } from "./database.js";
import { createDeploymentScreen } from "./deployment.js";
import { createDeploymentsScreen } from "./deployments.js";
import { createLogsScreen } from "./logs.js";
import { createResourcesScreen } from "./resources.js";
import { createServerScreen } from "./server.js";
import { createServersScreen } from "./servers.js";
import { createServiceScreen } from "./service.js";

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
    case "database":
      return createDatabaseScreen(ctx, route, opts);
    case "service":
      return createServiceScreen(ctx, route, opts);
    case "logs":
      return createLogsScreen(ctx, route, opts);
    case "deployment":
      return createDeploymentScreen(ctx, route, opts);
    case "deployments":
      return createDeploymentsScreen(ctx, route, opts);
    case "servers":
      return createServersScreen(ctx, route, opts);
    case "server":
      return createServerScreen(ctx, route, opts);
    default:
      throw new Error(`Unknown screen: ${route.screen}`);
  }
}
