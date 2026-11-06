/**
 * Fake Coolify API for tests and local development, without dependencies.
 * Behaves like the version it is given: < 4.2.0 takes actions by GET only,
 * newer versions by POST only, and endpoints newer than the version answer the
 * generic 404 a real server gives.
 *
 *   node test/mock-coolify/server.js --version 4.3.1 --port 4103
 *
 * Control endpoints, without auth:
 *   POST /__control {mode?, failPaths?, failStatus?, failMessage?, delayMs?, stateChangeDelayMs?, seed?}
 *     mode: "ok" | "html" (login page) | "hang" (never answers)
 *           | "stall" (headers, then nothing)
 *     seed: {applications?, databases?, services?, deployments?, removeResources?}
 *   POST /__reset
 *   GET  /__requests → [{method, path, body}]
 */
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { isVersionAtLeast } from "../../lib/version.js";
import { buildScript, createFixtures } from "./fixtures.js";

export const TEST_TOKEN = "test-token";

const STATE_CHANGE_DELAY = 1500;
const LINES_PER_READ = 5;

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const NOT_FOUND = () => new ApiError(404, "Not found.");

function logLine(kind, time = new Date()) {
  const stamp = time.toISOString().replace(/\.\d+Z/, "Z");
  return kind === "database"
    ? `${stamp} [412] LOG:  checkpoint complete`
    : `${stamp} GET /healthz 200 4ms`;
}

function createLogStore() {
  const logs = new Map();
  return (key, kind) => {
    if (!logs.has(key)) {
      const lines = [];
      for (let back = 80; back > 0; back--) {
        lines.push(logLine(kind, new Date(Date.now() - back * 15000)));
      }
      logs.set(key, lines);
    }
    const lines = logs.get(key);
    lines.push(logLine(kind));
    return lines;
  };
}

function publicDeployment(deployment, { withLogs = true } = {}) {
  // The real API doesn't say which application a deployment belongs to.
  const { lines, script, application_uuid: _application, ...fields } = deployment;
  return {
    ...fields,
    logs: withLogs
      ? JSON.stringify(lines.map((output) => ({ output, hidden: false })))
      : null,
  };
}

function createApi(version, stateChangeDelay) {
  let state = createFixtures();
  const logsFor = createLogStore();
  let nextId = 1;

  const usesPost = isVersionAtLeast(version, "4.2.0");
  const hasServerActions = isVersionAtLeast(version, "4.3.0");

  const requireActionMethod = (method) => {
    const allowed = usesPost ? "POST" : "GET";
    if (method !== allowed) throw new ApiError(405, "Method not allowed.");
  };
  const requireSince42 = () => {
    if (!usesPost) throw NOT_FOUND();
  };
  const requireSince43 = () => {
    if (!hasServerActions) throw NOT_FOUND();
  };

  const find = (list, uuid, label) => {
    const item = list.find((entry) => entry.uuid === uuid);
    if (!item) throw new ApiError(404, `${label} not found.`);
    return item;
  };
  const application = (uuid) => find(state.applications, uuid, "Application");
  const database = (uuid) => find(state.databases, uuid, "Database");
  const service = (uuid) => find(state.services, uuid, "Service");
  const server = (uuid) => find(state.servers, uuid, "Server");

  const later = (change) => {
    const timer = setTimeout(change, stateChangeDelay());
    timer.unref?.();
  };

  const startDeployment = (app, options = {}) => {
    const commit =
      options.rollback ??
      `${String(nextId).padStart(8, "0")}`.repeat(5).slice(0, 40);
    const now = new Date().toISOString();
    const deployment = {
      deployment_uuid: `dep-new-${nextId++}`,
      application_uuid: app.uuid,
      application_name: app.name,
      status: "queued",
      server_name: "prod-eu-1",
      commit,
      commit_message: options.rollback
        ? `Rollback to ${options.rollback.slice(0, 7)}`
        : "feat: new deployment",
      git_type: "github",
      is_webhook: false,
      is_api: true,
      force_rebuild: Boolean(options.force),
      restart_only: Boolean(options.restart),
      created_at: now,
      updated_at: now,
      lines: [],
      script: buildScript(app.name, { ...options, commit }),
    };
    state.deployments.unshift(deployment);
    return deployment;
  };

  const advance = (deployment) => {
    if (deployment.status !== "queued" && deployment.status !== "in_progress") {
      return;
    }
    deployment.status = "in_progress";
    deployment.lines.push(...deployment.script.splice(0, LINES_PER_READ));
    deployment.updated_at = new Date().toISOString();
    if (deployment.script.length === 0) {
      deployment.status = "finished";
      const app = state.applications.find(
        (entry) => entry.uuid === deployment.application_uuid,
      );
      if (app) app.status = "running:healthy";
    }
  };

  const setStatusLater = (resource, status) => {
    later(() => {
      resource.status = status;
    });
  };

  const routes = [
    ["GET", /^\/version$/, () => ({ text: version })],

    // Applications
    ["GET", /^\/applications$/, () => state.applications],
    ["GET", /^\/applications\/([^/]+)$/, ([uuid]) => application(uuid)],
    [
      "ANY",
      /^\/applications\/([^/]+)\/(start|restart)$/,
      ([uuid, action], { method }) => {
        requireActionMethod(method);
        const deployment = startDeployment(application(uuid), {
          restart: action === "restart",
        });
        return {
          message: `Deployment queued.`,
          deployment_uuid: deployment.deployment_uuid,
        };
      },
    ],
    [
      "ANY",
      /^\/applications\/([^/]+)\/stop$/,
      ([uuid], { method }) => {
        requireActionMethod(method);
        setStatusLater(application(uuid), "exited:unhealthy");
        return { message: "Application stopping request queued." };
      },
    ],
    [
      "GET",
      /^\/applications\/([^/]+)\/logs$/,
      ([uuid], { query }) => {
        const app = application(uuid);
        if (!app.status.includes("running")) return { logs: "" };
        const lines = logsFor(uuid, "application");
        return { logs: lines.slice(-Number(query.get("lines") ?? 100)).join("\n") };
      },
    ],
    [
      "GET",
      /^\/applications\/([^/]+)\/rollback-images$/,
      ([uuid]) => {
        requireSince43();
        application(uuid);
        const images = state.rollbackImages[uuid] ?? [];
        return {
          current: images.find((image) => image.is_current)?.tag ?? null,
          images,
        };
      },
    ],
    [
      "POST",
      /^\/applications\/([^/]+)\/rollback$/,
      ([uuid], { body }) => {
        requireSince43();
        const app = application(uuid);
        for (const image of state.rollbackImages[uuid] ?? []) {
          image.is_current = image.tag === body?.commit;
        }
        const deployment = startDeployment(app, { rollback: body?.commit });
        return {
          message: "Rollback queued.",
          deployment_uuid: deployment.deployment_uuid,
        };
      },
    ],

    // Deploy
    [
      "ANY",
      /^\/deploy$/,
      (_, { method, query, body }) => {
        requireActionMethod(method);
        const uuid = method === "GET" ? query.get("uuid") : body?.uuid;
        const force =
          method === "GET" ? query.get("force") === "true" : body?.force === true;
        const deployment = startDeployment(application(uuid), { force });
        return {
          deployments: [
            {
              message: "Deployment queued.",
              resource_uuid: uuid,
              deployment_uuid: deployment.deployment_uuid,
            },
          ],
        };
      },
    ],

    // Deployments. The global list only has the active ones.
    [
      "GET",
      /^\/deployments$/,
      () =>
        state.deployments
          .filter((d) => d.status === "queued" || d.status === "in_progress")
          .map((d) => publicDeployment(d, { withLogs: false })),
    ],
    [
      "GET",
      /^\/deployments\/applications\/([^/]+)$/,
      ([uuid], { query }) => {
        application(uuid);
        const all = state.deployments.filter((d) => d.application_uuid === uuid);
        const skip = Number(query.get("skip") ?? 0);
        const take = Number(query.get("take") ?? 10);
        return {
          count: all.length,
          deployments: all
            .slice(skip, skip + take)
            .map((d) => publicDeployment(d, { withLogs: false })),
        };
      },
    ],
    [
      "POST",
      /^\/deployments\/([^/]+)\/cancel$/,
      ([uuid]) => {
        const deployment = state.deployments.find(
          (d) => d.deployment_uuid === uuid,
        );
        if (!deployment) throw new ApiError(404, "Deployment not found.");
        deployment.status = "cancelled";
        deployment.script = [];
        deployment.lines.push("Deployment cancelled by the user.");
        return { message: "Deployment cancelled." };
      },
    ],
    [
      "GET",
      /^\/deployments\/([^/]+)$/,
      ([uuid]) => {
        const deployment = state.deployments.find(
          (d) => d.deployment_uuid === uuid,
        );
        if (!deployment) throw new ApiError(404, "Deployment not found.");
        advance(deployment);
        return publicDeployment(deployment);
      },
    ],

    // Databases
    ["GET", /^\/databases$/, () => state.databases],
    ["GET", /^\/databases\/([^/]+)$/, ([uuid]) => database(uuid)],
    [
      "GET",
      /^\/databases\/([^/]+)\/logs$/,
      ([uuid], { query }) => {
        requireSince42();
        const db = database(uuid);
        if (!db.status.includes("running")) return { logs: "" };
        const lines = logsFor(uuid, "database");
        return { logs: lines.slice(-Number(query.get("lines") ?? 100)).join("\n") };
      },
    ],
    [
      "GET",
      /^\/databases\/([^/]+)\/backups$/,
      ([uuid]) => {
        requireSince42();
        database(uuid);
        return state.backups[uuid] ?? [];
      },
    ],
    [
      "PATCH",
      /^\/databases\/([^/]+)\/backups\/([^/]+)$/,
      ([uuid, backupUuid], { body }) => {
        requireSince42();
        database(uuid);
        const backup = (state.backups[uuid] ?? []).find(
          (entry) => entry.uuid === backupUuid,
        );
        if (!backup) throw new ApiError(404, "Backup not found.");
        if (body?.backup_now) {
          const run = {
            uuid: `e-new-${nextId++}`,
            status: "running",
            size: null,
            created_at: new Date().toISOString(),
          };
          backup.executions = [run, ...(backup.executions ?? [])];
          later(() => {
            run.status = "success";
            run.size = 512000000;
          });
        }
        return { message: "Backup started." };
      },
    ],
    [
      "ANY",
      /^\/databases\/([^/]+)\/(start|stop|restart)$/,
      ([uuid, action], { method }) => {
        requireActionMethod(method);
        const db = database(uuid);
        if (action === "start") setStatusLater(db, "running:healthy");
        if (action === "stop") setStatusLater(db, "stopped");
        return { message: `Database ${action} request queued.` };
      },
    ],

    // Services
    ["GET", /^\/services$/, () => state.services],
    ["GET", /^\/services\/([^/]+)$/, ([uuid]) => service(uuid)],
    [
      "GET",
      /^\/services\/([^/]+)\/logs$/,
      ([uuid], { query }) => {
        requireSince42();
        const svc = service(uuid);
        const name = query.get("sub_service_name");
        const container = [...svc.applications, ...svc.databases].find(
          (entry) => entry.name === name,
        );
        if (!container) throw new ApiError(404, "Sub-service not found.");
        if (!container.status.includes("running")) return { logs: "" };
        const lines = logsFor(`${uuid}/${name}`, "service").map(
          (line) => `[${name}] ${line}`,
        );
        return { logs: lines.slice(-Number(query.get("lines") ?? 100)).join("\n") };
      },
    ],
    [
      "POST",
      /^\/services\/([^/]+)\/(applications|databases)\/([^/]+)\/(start|stop|restart)$/,
      ([uuid, segment, containerUuid, action]) => {
        requireSince42();
        const svc = service(uuid);
        const container = svc[segment].find((c) => c.uuid === containerUuid);
        if (!container) throw new ApiError(404, "Container not found.");
        if (action === "start") setStatusLater(container, "running:healthy");
        if (action === "stop") setStatusLater(container, "exited");
        return { message: `Container ${action} request queued.` };
      },
    ],
    [
      "ANY",
      /^\/services\/([^/]+)\/(start|stop|restart)$/,
      ([uuid, action], { method }) => {
        requireActionMethod(method);
        const svc = service(uuid);
        if (action === "start") setStatusLater(svc, "running:healthy");
        if (action === "stop") setStatusLater(svc, "stopped");
        return { message: `Service ${action} request queued.` };
      },
    ],

    // Servers
    ["GET", /^\/servers$/, () => state.servers],
    ["GET", /^\/servers\/([^/]+)$/, ([uuid]) => server(uuid)],
    [
      "GET",
      /^\/servers\/([^/]+)\/resources$/,
      ([uuid]) => {
        const srv = server(uuid);
        if (srv.uuid !== "srv-prod") return [];
        return [
          ...state.applications.map((app) => ({
            uuid: app.uuid,
            name: app.name,
            status: app.status,
            type: "App\\Models\\Application",
          })),
          ...state.databases.map((db) => ({
            uuid: db.uuid,
            name: db.name,
            status: db.status,
            type: `App\\Models\\Standalone${db.database_type.replace("standalone-", "")}`,
          })),
          ...state.services.map((svc) => ({
            uuid: svc.uuid,
            name: svc.name,
            status: svc.status,
            type: "App\\Models\\Service",
          })),
        ];
      },
    ],
    [
      "ANY",
      /^\/servers\/([^/]+)\/validate$/,
      ([uuid], { method }) => {
        requireActionMethod(method);
        server(uuid);
        return { message: "Validation started." };
      },
    ],
    [
      "POST",
      /^\/servers\/([^/]+)\/proxy\/restart$/,
      ([uuid]) => {
        requireSince43();
        server(uuid);
        return { message: "Proxy restart queued." };
      },
    ],
    [
      "POST",
      /^\/servers\/([^/]+)\/docker-cleanup\/run$/,
      ([uuid]) => {
        requireSince43();
        server(uuid);
        return { message: "Docker cleanup queued." };
      },
    ],
  ];

  return {
    handle(method, path, query, body) {
      for (const [verb, pattern, handler] of routes) {
        const match = path.match(pattern);
        if (!match || (verb !== "ANY" && verb !== method)) continue;
        const params = match.slice(1).map(decodeURIComponent);
        return handler(params, { method, query, body });
      }
      throw NOT_FOUND();
    },
    applySeed(seed) {
      for (const key of ["applications", "databases", "services", "deployments"]) {
        if (seed[key]) state[key].push(...seed[key]);
      }
      const removed = new Set(seed.removeResources ?? []);
      for (const key of ["applications", "databases", "services"]) {
        state[key] = state[key].filter((entry) => !removed.has(entry.uuid));
      }
    },
    reset() {
      state = createFixtures();
    },
  };
}

function readBody(request) {
  return new Promise((resolve) => {
    let text = "";
    request.on("data", (chunk) => {
      text += chunk;
    });
    request.on("end", () => resolve(text));
    request.on("error", () => resolve(text));
  });
}

function sendJson(response, status, value) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(value));
}

export async function startMockCoolify({
  version = "4.3.1",
  port = 0,
  basePath = "",
} = {}) {
  const initialControl = {
    mode: "ok",
    failPaths: [],
    failStatus: 500,
    failMessage: "Server Error",
    delayMs: 0,
    stateChangeDelayMs: STATE_CHANGE_DELAY,
  };
  let control = { ...initialControl };
  const api = createApi(version, () => control.stateChangeDelayMs);
  let requests = [];

  const prefix = `${basePath}/api/v1`;

  const server = createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");
    const text = await readBody(request);
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      // Not JSON: leave it out.
    }

    if (url.pathname === "/__control" && request.method === "POST") {
      const { seed, ...rest } = body ?? {};
      control = { ...control, ...rest };
      if (seed) api.applySeed(seed);
      return sendJson(response, 200, { ok: true });
    }
    if (url.pathname === "/__reset" && request.method === "POST") {
      control = { ...initialControl };
      requests = [];
      api.reset();
      return sendJson(response, 200, { ok: true });
    }
    if (url.pathname === "/__requests" && request.method === "GET") {
      return sendJson(response, 200, requests);
    }

    // Raw pathname: tests check that uuids arrive encoded.
    requests.push({
      method: request.method,
      path: `${url.pathname}${url.search}`,
      body,
    });

    if (!url.pathname.startsWith(prefix)) {
      return sendJson(response, 404, { message: "Not found." });
    }

    if (control.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, control.delayMs));
    }

    if (control.mode === "hang") return undefined;
    if (control.mode === "stall") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.write("[");
      return undefined;
    }
    if (control.mode === "html") {
      response.writeHead(200, { "Content-Type": "text/html" });
      return response.end("<!doctype html><title>Log in</title>");
    }

    if (request.headers.authorization !== `Bearer ${TEST_TOKEN}`) {
      return sendJson(response, 401, { message: "Unauthenticated." });
    }

    const path = url.pathname.slice(prefix.length);
    if (control.failPaths.some((failed) => path.startsWith(failed))) {
      return sendJson(response, control.failStatus, { message: control.failMessage });
    }

    try {
      const result = api.handle(request.method, path, url.searchParams, body);
      if (result && typeof result.text === "string") {
        response.writeHead(200, { "Content-Type": "text/plain" });
        return response.end(result.text);
      }
      return sendJson(response, 200, result);
    } catch (error) {
      if (error instanceof ApiError) {
        return sendJson(response, error.status, { message: error.message });
      }
      console.error(error);
      return sendJson(response, 500, { message: "Mock server error" });
    }
  });

  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}${basePath}`;
  const origin = `http://127.0.0.1:${server.address().port}`;

  const post = (path, value) =>
    fetch(`${origin}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value ?? {}),
    });

  return {
    url,
    version,
    control: (value) => post("/__control", value),
    reset: () => post("/__reset"),
    requests: async () => (await fetch(`${origin}/__requests`)).json(),
    stop() {
      return new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      });
    },
  };
}

// Started directly: node test/mock-coolify/server.js --version 4.3.1 --port 4103
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const option = (name, fallback) => {
    const index = process.argv.indexOf(`--${name}`);
    return index === -1 ? fallback : process.argv[index + 1];
  };
  const mock = await startMockCoolify({
    version: option("version", "4.3.1"),
    port: Number(option("port", 0)),
    basePath: option("base-path", ""),
  });
  console.log(`Mock Coolify ${mock.version} on ${mock.url}, token: ${TEST_TOKEN}`);
}
