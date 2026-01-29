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
}
