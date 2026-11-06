/**
 * A route says what a surface shows:
 * {screen, uuid?, type?, name?, container?, appUuid?, filter?, query?}
 * The popup stacks them, the dashboard keeps the current one in the URL hash.
 */
const ROOT_SCREENS = ["resources", "deployments", "servers"];
const DETAIL_SCREENS = [
  "application",
  "database",
  "service",
  "server",
  "history",
  "rollback",
  "logs",
  "deployment",
];
const FIELDS = ["uuid", "type", "name", "container", "appUuid", "filter", "query"];

export function routeToHash(route) {
  const params = new URLSearchParams({ screen: route.screen });
  for (const field of FIELDS) {
    if (route[field]) params.set(field, route[field]);
  }
  return `#${params}`;
}

export function hashToRoute(hash) {
  const fallback = { screen: "resources" };
  const params = new URLSearchParams(String(hash ?? "").replace(/^#/, ""));
  const screen = params.get("screen");

  const isRoot = ROOT_SCREENS.includes(screen);
  const isDetail = DETAIL_SCREENS.includes(screen);
  if (!isRoot && !(isDetail && params.get("uuid"))) return fallback;

  const route = { screen };
  for (const field of FIELDS) {
    const value = params.get(field);
    if (value) route[field] = value;
  }
  return route;
}

const RESOURCE_SUBS = { history: "history", rollback: "rollback", logs: "logs" };

/** Where a route goes in the dashboard's three columns. */
export function dashboardViewFor(route) {
  const view = {
    nav: "resources",
    selection: null,
    sub: "overview",
    container: route.container ?? null,
    filter: route.filter ?? "all",
    query: route.query ?? "",
    appUuid: route.appUuid ?? null,
  };

  switch (route.screen) {
    case "deployments":
    case "servers":
      return { ...view, nav: route.screen };
    case "server":
      return {
        ...view,
        nav: "servers",
        selection: { kind: "server", uuid: route.uuid },
      };
    case "deployment":
      // From an application it stays in Resources, so that row can be selected.
      return {
        ...view,
        nav: route.appUuid ? "resources" : "deployments",
        selection: { kind: "deployment", uuid: route.uuid },
      };
    case "application":
    case "database":
    case "service":
    case "history":
    case "rollback":
    case "logs":
      return {
        ...view,
        selection: { kind: "resource", uuid: route.uuid },
        sub: RESOURCE_SUBS[route.screen] ?? "overview",
      };
    default:
      return view;
  }
}
