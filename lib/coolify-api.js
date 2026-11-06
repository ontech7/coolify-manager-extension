import {
  POST_ACTIONS_MIN_VERSION,
  REQUEST_TIMEOUT,
  RESPONSE_BODY_TIMEOUT,
  SERVER_ACTIONS_MIN_VERSION,
} from "./constants.js";

/** The endpoint is missing on this server: it needs a newer Coolify. */
export class UnsupportedVersionError extends Error {
  constructor(minVersion) {
    super(`This action requires Coolify ${minVersion} or newer.`);
    this.name = "UnsupportedVersionError";
  }
}

/** Non-2xx API response. Keeps the status so callers can tell a 404 apart. */
export class HttpError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

const NETWORK_FAILURES = ["Failed to fetch", "Network request failed"];

function isNetworkFailure(error) {
  return (
    error instanceof Error &&
    (NETWORK_FAILURES.includes(error.message) ||
      error.message.startsWith("fetch failed"))
  );
}

/**
 * Coolify API client, the port of the app's lib/coolify-api.ts.
 * @see https://coolify.io/docs/api-reference/api/operations/list-applications
 */
export class CoolifyAPI {
  constructor(
    baseUrl,
    token,
    apiMode = "current",
    { requestTimeout = REQUEST_TIMEOUT, bodyTimeout = RESPONSE_BODY_TIMEOUT } = {},
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.token = token;
    this.apiMode = apiMode;
    this.requestTimeout = requestTimeout;
    this.bodyTimeout = bodyTimeout;
  }

  /** Coolify >= 4.2.0 requires POST for state-changing actions; older ones GET. */
  actionMethod() {
    return this.apiMode === "legacy" ? "GET" : "POST";
  }

  get headers() {
    return {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  /**
   * The server version (e.g. "4.2.0"), or null when the endpoint is
   * unavailable (e.g. a token without read permission).
   */
  async getVersion() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/version`, {
        headers: this.headers,
        signal: controller.signal,
      });

      if (!response.ok) return null;

      return (await response.text()).trim().replace(/^v/i, "");
    } catch {
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}/api/v1${endpoint}`;

    const controller = new AbortController();
    let timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: { ...this.headers, ...options.headers },
      });

      // The body gets its own, longer budget: a server can send headers and
      // then stall, but large logs also need time on a slow connection.
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => controller.abort(), this.bodyTimeout);
      const body = await response.text();

      if (!response.ok) {
        let message;
        try {
          message = JSON.parse(body).message;
        } catch {
          // Not JSON: fall back to the status.
        }
        const status = response.statusText
          ? `Status ${response.status}: ${response.statusText}`
          : `Status ${response.status}`; // HTTP/2 has no status text
        throw new HttpError(message || status, response.status);
      }

      try {
        return JSON.parse(body);
      } catch {
        // e.g. an HTML login page from an auth proxy, a wrong base path, or an
        // empty body: Coolify always answers with JSON.
        throw new Error(
          "Unexpected response from server. Check the URL — is it behind a login page or proxy?",
        );
      }
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error("Connection timeout. Server took too long to respond.");
      }
      if (isNetworkFailure(error)) {
        throw new Error(
          "Unable to connect to server. Please check URL and connection.",
        );
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * For endpoints added in newer Coolify releases: an older server answers
   * unknown routes with a generic `404 "Not found."`, so turn that into an
   * actionable message. Specific 404s ("Application not found.") pass through.
   */
  async requestSince(minVersion, endpoint, options = {}) {
    try {
      return await this.request(endpoint, options);
    } catch (error) {
      if (
        error instanceof HttpError &&
        error.status === 404 &&
        error.message === "Not found."
      ) {
        throw new UnsupportedVersionError(minVersion);
      }
      throw error;
    }
  }

  async testConnection() {
    try {
      await this.request("/applications");
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // Applications

  getApplications() {
    return this.request("/applications");
  }

  getApplication(uuid) {
    return this.request(`/applications/${encodeURIComponent(uuid)}`);
  }

  /** Returns the queued deployment's UUID, when Coolify reports one. */
  async startApplication(uuid) {
    const result = await this.request(
      `/applications/${encodeURIComponent(uuid)}/start`,
      { method: this.actionMethod() },
    );
    return result?.deployment_uuid;
  }

  async stopApplication(uuid) {
    await this.request(`/applications/${encodeURIComponent(uuid)}/stop`, {
      method: this.actionMethod(),
    });
  }

  /** Returns the queued deployment's UUID, when Coolify reports one. */
  async restartApplication(uuid) {
    const result = await this.request(
      `/applications/${encodeURIComponent(uuid)}/restart`,
      { method: this.actionMethod() },
    );
    return result?.deployment_uuid;
  }

  /** `force` rebuilds without the Docker build cache. */
  deployApplication(uuid, force = false) {
    // Only send `force` when set: older servers read the raw query string,
    // and PHP casts "false" to true.
    if (this.apiMode === "legacy") {
      return this.request(
        `/deploy?uuid=${encodeURIComponent(uuid)}${force ? "&force=true" : ""}`,
      );
    }

    return this.request("/deploy", {
      method: "POST",
      body: JSON.stringify(force ? { uuid, force } : { uuid }),
    });
  }

  getApplicationLogs(uuid, lines = 100) {
    return this.request(
      `/applications/${encodeURIComponent(uuid)}/logs?lines=${lines}`,
    );
  }

  getRollbackImages(uuid) {
    return this.requestSince(
      SERVER_ACTIONS_MIN_VERSION,
      `/applications/${encodeURIComponent(uuid)}/rollback-images`,
    );
  }

  /** Queue a deployment of a previous image. `commit` is the image tag. */
  rollbackApplication(uuid, commit) {
    return this.requestSince(
      SERVER_ACTIONS_MIN_VERSION,
      `/applications/${encodeURIComponent(uuid)}/rollback`,
      { method: "POST", body: JSON.stringify({ commit }) },
    );
  }

  // Deployments

  getDeployments() {
    return this.request("/deployments");
  }

  getDeploymentsByApp(uuid, skip = 0, take = 10) {
    return this.request(
      `/deployments/applications/${encodeURIComponent(uuid)}?skip=${skip}&take=${take}`,
    );
  }

  getDeployment(uuid) {
    return this.request(`/deployments/${encodeURIComponent(uuid)}`);
  }

  async cancelDeployment(uuid) {
    await this.request(`/deployments/${encodeURIComponent(uuid)}/cancel`, {
      method: "POST",
    });
  }

  // Databases

  getDatabases() {
    return this.request("/databases");
  }

  getDatabase(uuid) {
    return this.request(`/databases/${encodeURIComponent(uuid)}`);
  }

  /**
   * Scheduled backups with all their runs, latest first (Coolify >= 4.2.0).
   * The endpoint can't limit the runs, so the body grows with the history.
   */
  getDatabaseBackups(uuid) {
    return this.requestSince(
      POST_ACTIONS_MIN_VERSION,
      `/databases/${encodeURIComponent(uuid)}/backups`,
    );
  }

  /** Runs a scheduled backup right away (Coolify >= 4.2.0). */
  runDatabaseBackup(uuid, backupUuid) {
    return this.requestSince(
      POST_ACTIONS_MIN_VERSION,
      `/databases/${encodeURIComponent(uuid)}/backups/${encodeURIComponent(backupUuid)}`,
      { method: "PATCH", body: JSON.stringify({ backup_now: true }) },
    );
  }

  async startDatabase(uuid) {
    await this.request(`/databases/${encodeURIComponent(uuid)}/start`, {
      method: this.actionMethod(),
    });
  }

  async stopDatabase(uuid) {
    await this.request(`/databases/${encodeURIComponent(uuid)}/stop`, {
      method: this.actionMethod(),
    });
  }

  async restartDatabase(uuid) {
    await this.request(`/databases/${encodeURIComponent(uuid)}/restart`, {
      method: this.actionMethod(),
    });
  }

  /** Coolify >= 4.2.0 only. */
  getDatabaseLogs(uuid, lines = 100) {
    return this.requestSince(
      POST_ACTIONS_MIN_VERSION,
      `/databases/${encodeURIComponent(uuid)}/logs?lines=${lines}`,
    );
  }

  // Services

  getServices() {
    return this.request("/services");
  }

  /** Includes the service's sub-applications and sub-databases. */
  getService(uuid) {
    return this.request(`/services/${encodeURIComponent(uuid)}`);
  }

  /**
   * Logs of one container of a service (Coolify >= 4.2.0). `subServiceName`
   * is the `name` of one of the service's applications or databases.
   */
  getServiceLogs(uuid, subServiceName, lines = 100) {
    return this.requestSince(
      POST_ACTIONS_MIN_VERSION,
      `/services/${encodeURIComponent(uuid)}/logs?sub_service_name=${encodeURIComponent(subServiceName)}&lines=${lines}`,
    );
  }

  async startService(uuid) {
    await this.request(`/services/${encodeURIComponent(uuid)}/start`, {
      method: this.actionMethod(),
    });
  }

  async stopService(uuid) {
    await this.request(`/services/${encodeURIComponent(uuid)}/stop`, {
      method: this.actionMethod(),
    });
  }

  async restartService(uuid) {
    await this.request(`/services/${encodeURIComponent(uuid)}/restart`, {
      method: this.actionMethod(),
    });
  }

  /** Start, stop or restart one container of a service (Coolify >= 4.2.0). */
  serviceContainerAction(uuid, kind, containerUuid, action) {
    const segment = kind === "application" ? "applications" : "databases";
    return this.requestSince(
      POST_ACTIONS_MIN_VERSION,
      `/services/${encodeURIComponent(uuid)}/${segment}/${encodeURIComponent(containerUuid)}/${action}`,
      { method: "POST" },
    );
  }

  async pullLatestImagesService(uuid) {
    await this.request(
      `/services/${encodeURIComponent(uuid)}/restart?latest=true`,
      { method: this.actionMethod() },
    );
  }

  // Servers

  getServers() {
    return this.request("/servers");
  }

  getServer(uuid) {
    return this.request(`/servers/${encodeURIComponent(uuid)}`);
  }

  getServerResources(uuid) {
    return this.request(`/servers/${encodeURIComponent(uuid)}/resources`);
  }

  async validateServer(uuid) {
    await this.request(`/servers/${encodeURIComponent(uuid)}/validate`, {
      method: this.actionMethod(),
    });
  }

  restartProxy(uuid) {
    return this.requestSince(
      SERVER_ACTIONS_MIN_VERSION,
      `/servers/${encodeURIComponent(uuid)}/proxy/restart`,
      { method: "POST" },
    );
  }

  /** Removes unused images, build cache and stopped containers. */
  runDockerCleanup(uuid) {
    return this.requestSince(
      SERVER_ACTIONS_MIN_VERSION,
      `/servers/${encodeURIComponent(uuid)}/docker-cleanup/run`,
      { method: "POST" },
    );
  }
}
