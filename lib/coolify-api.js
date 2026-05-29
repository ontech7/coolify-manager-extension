/**
 * coolify API wrapper
 * @docs https://coolify.io/docs/api-reference/api/operations/list-applications
 */
export class CoolifyAPI {
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.token = token;
  }

  get headers() {
    return {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}/api/v1${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.headers,
          ...options.headers,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          error.message || `Status ${response.status}: ${response.statusText}`,
        );
      }

      return await response.json();
    } catch (error) {
      if (error.name === "TypeError" && error.message === "Failed to fetch") {
        throw new Error(
          "Unable to connect to server. Please check URL and connection.",
        );
      }
      throw error;
    }
  }

  async testConnection() {
    try {
      await this.request("/applications");
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getApplications() {
    return this.request("/applications");
  }

  async getApplication(uuid) {
    return this.request(`/applications/${uuid}`);
  }

  async startApplication(uuid) {
    return this.request(`/applications/${uuid}/start`);
  }

  async stopApplication(uuid) {
    return this.request(`/applications/${uuid}/stop`);
  }

  async restartApplication(uuid) {
    return this.request(`/applications/${uuid}/restart`);
  }

  async deployApplication(uuid) {
    return this.request(`/deploy?uuid=${uuid}`);
  }

  async getApplicationLogs(uuid, lines = 100) {
    return this.request(`/applications/${uuid}/logs?lines=${lines}`);
  }

  async getDeployments() {
    return this.request("/deployments");
  }

  async getDeploymentsByApp(uuid, skip = 0, take = 10) {
    return this.request(
      `/deployments/applications/${uuid}?skip=${skip}&take=${take}`,
    );
  }

  async getDeployment(uuid) {
    return this.request(`/deployments/${uuid}`);
  }


  async cancelDeployment(uuid) {
    return this.request(`/deployments/${uuid}/cancel`, { method: "POST" });
  }

  // Databases

  async getDatabases() {
    return this.request("/databases");
  }

  async startDatabase(uuid) {
    return this.request(`/databases/${uuid}/start`);
  }

  async stopDatabase(uuid) {
    return this.request(`/databases/${uuid}/stop`);
  }

  async restartDatabase(uuid) {
    return this.request(`/databases/${uuid}/restart`);
  }

  // Services

  async getServices() {
    return this.request("/services");
  }

  async startService(uuid) {
    return this.request(`/services/${uuid}/start`);
  }

  async stopService(uuid) {
    return this.request(`/services/${uuid}/stop`);
  }

  async restartService(uuid) {
    return this.request(`/services/${uuid}/restart`);
  }

  // Servers

  async getServers() {
    return this.request("/servers");
  }

  async getServer(uuid) {
    return this.request(`/servers/${uuid}`);
  }

  async getServerResources(uuid) {
    return this.request(`/servers/${uuid}/resources`);
  }

  async validateServer(uuid) {
    return this.request(`/servers/${uuid}/validate`);
  }
}
