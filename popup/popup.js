import { getActiveInstance } from "../lib/config-storage.js";

const icons = {
  rocket: `<svg class="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z"/>
    <path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z"/>
    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
  </svg>`,
  refreshCw: `<svg class="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 12a9 9 0 00-9-9 9.75 9.75 0 00-6.74 2.74L3 8"/>
    <path d="M3 3v5h5"/>
    <path d="M3 12a9 9 0 009 9 9.75 9.75 0 006.74-2.74L21 16"/>
    <path d="M16 16h5v5"/>
  </svg>`,
  play: `<svg class="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>`,
  square: `<svg class="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
  </svg>`,
  loader: `<svg class="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 12a9 9 0 11-6.219-8.56"/>
  </svg>`,
  fileText: `<svg class="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>`,
  x: `<svg class="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>`,
  externalLink: `<svg class="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
    <polyline points="15 3 21 3 21 9"/>
    <line x1="10" y1="14" x2="21" y2="3"/>
  </svg>`,
  history: `<svg class="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 3v5h5"/>
    <path d="M3.05 13A9 9 0 106 5.3L3 8"/>
    <path d="M12 7v5l4 2"/>
  </svg>`,
  copy: `<svg class="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
  </svg>`,
  check: `<svg class="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>`,
  wifi: `<svg class="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 20h.01"/>
    <path d="M2 8.82a15 15 0 0120 0"/>
    <path d="M5 12.859a10 10 0 0114 0"/>
    <path d="M8.5 16.429a5 5 0 017 0"/>
  </svg>`,
};

const RESOURCE_TYPES = {
  application: { label: "APP", cls: "chip-app" },
  database: { label: "DB", cls: "chip-db" },
  service: { label: "SVC", cls: "chip-svc" },
};

const states = {
  notConfigured: document.getElementById("not-configured"),
  loading: document.getElementById("loading"),
  error: document.getElementById("error"),
  emptyResources: document.getElementById("empty-resources"),
  resourcesList: document.getElementById("resources-list"),
  emptyDeployments: document.getElementById("empty-deployments"),
  deploymentsList: document.getElementById("deployments-list"),
  emptyServers: document.getElementById("empty-servers"),
  serversList: document.getElementById("servers-list"),
};

const elements = {
  tabsContainer: document.getElementById("tabs-container"),
  tabBtns: document.querySelectorAll(".tab-btn"),
  refreshBtn: document.getElementById("refresh-btn"),
  openOptionsBtn: document.getElementById("open-options"),
  retryBtn: document.getElementById("retry-btn"),
  autoRefreshBtn: document.getElementById("auto-refresh-btn"),
  settingsBtn: document.getElementById("settings-btn"),
  openCoolifyBtn: document.getElementById("open-coolify-btn"),
  errorMessage: document.getElementById("error-message"),
  loadingText: document.getElementById("loading-text"),
  resources: document.getElementById("resources"),
  resourceFilters: document.getElementById("resource-filters"),
  deployments: document.getElementById("deployments"),
  servers: document.getElementById("servers"),
  logsModal: document.getElementById("logs-modal"),
  logsTitle: document.getElementById("logs-title"),
  logsContent: document.getElementById("logs-content"),
  logsClose: document.getElementById("logs-close"),
  logsRefresh: document.getElementById("logs-refresh"),
  detailsModal: document.getElementById("details-modal"),
  detailsTitle: document.getElementById("details-title"),
  detailsContent: document.getElementById("details-content"),
  detailsClose: document.getElementById("details-close"),
};

const AUTO_REFRESH_INTERVAL = 10000; // 10 seconds
const HISTORY_PAGE_SIZE = 15;

let currentLogsApp = null;
let currentTab = "resources";
let resourceFilter = "all";
let allResources = [];
let historyState = null;
let serverUrl = "";
let activeInstance = null;
let activeInstanceName = "";
let autoRefreshInterval = null;
let autoRefreshEnabled = true;

function showState(stateName) {
  Object.entries(states).forEach(([name, element]) => {
    element.classList.toggle("hidden", name !== stateName);
  });
}

function send(action, data) {
  return chrome.runtime.sendMessage({ action, data });
}

function openOptions() {
  chrome.runtime.openOptionsPage();
}

function openCoolify() {
  if (!serverUrl) return;
  chrome.tabs.create({ url: serverUrl });
}

function updateOpenCoolifyButton() {
  if (!serverUrl) {
    elements.openCoolifyBtn.disabled = true;
    elements.openCoolifyBtn.textContent = "Open Coolify";
    elements.openCoolifyBtn.title = "Open Coolify Dashboard";
    return;
  }

  let label = activeInstanceName;

  if (!label) {
    try {
      label = new URL(serverUrl).host;
    } catch (error) {
      label = "Coolify";
    }
  }

  elements.openCoolifyBtn.disabled = false;
  elements.openCoolifyBtn.textContent = `Open ${label}`;
  elements.openCoolifyBtn.title = serverUrl;
}

async function isConfigured() {
  const [instance, storedSettings] = await Promise.all([
    getActiveInstance(),
    chrome.storage.sync.get(["autoRefreshEnabled"]),
  ]);

  activeInstance = instance;
  serverUrl = instance ? instance.serverUrl.replace(/\/$/, "") : "";
  activeInstanceName = instance ? instance.name : "";

  autoRefreshEnabled =
    storedSettings.autoRefreshEnabled === undefined
      ? true
      : !!storedSettings.autoRefreshEnabled;

  return Boolean(instance);
}

function openUrl(rawUrl) {
  if (!rawUrl) return;
  const url = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
  chrome.tabs.create({ url });
}

function splitFqdn(fqdn) {
  if (!fqdn) return [];
  return fqdn
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
}

function toggleAutoRefresh() {
  autoRefreshEnabled = !autoRefreshEnabled;

  chrome.storage.sync.set({ autoRefreshEnabled });

  if (autoRefreshEnabled) {
    elements.autoRefreshBtn.classList.add("active");
    autoRefreshInterval = setInterval(refreshCurrentTab, AUTO_REFRESH_INTERVAL);
  } else {
    elements.autoRefreshBtn.classList.remove("active");
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
      autoRefreshInterval = null;
    }
  }
}

function switchTab(tab) {
  currentTab = tab;
  elements.tabBtns.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });

  if (tab === "resources") {
    loadResources();
  } else if (tab === "deployments") {
    loadDeployments();
  } else if (tab === "servers") {
    loadServers();
  }
}

// ---------- Resources (applications + databases + services) ----------

async function loadResources() {
  elements.loadingText.textContent = "Loading resources...";
  showState("loading");
  elements.refreshBtn.classList.add("spinning");

  try {
    const [apps, dbs, svcs] = await Promise.all([
      send("getApplications"),
      send("getDatabases"),
      send("getServices"),
    ]);

    if (!apps.success && !dbs.success && !svcs.success) {
      throw new Error(apps.error || "Failed to load resources");
    }

    const merged = [];
    if (apps.success && Array.isArray(apps.data)) {
      merged.push(
        ...apps.data.map((a) => ({
          uuid: a.uuid,
          name: a.name,
          status: a.status,
          resourceType: "application",
          subtitle: a.build_pack || a.type || "application",
          fqdn: a.fqdn || "",
        })),
      );
    }
    if (dbs.success && Array.isArray(dbs.data)) {
      merged.push(
        ...dbs.data.map((d) => ({
          uuid: d.uuid,
          name: d.name,
          status: d.status,
          resourceType: "database",
          subtitle: d.image || "Database",
        })),
      );
    }
    if (svcs.success && Array.isArray(svcs.data)) {
      merged.push(
        ...svcs.data.map((s) => ({
          uuid: s.uuid,
          name: s.name,
          status: s.status,
          resourceType: "service",
          subtitle: s.service_type || "Service",
        })),
      );
    }

    merged.sort((a, b) => a.name.localeCompare(b.name));
    allResources = merged;

    if (merged.length === 0) {
      showState("emptyResources");
      return;
    }

    renderResources();
    showState("resourcesList");
  } catch (error) {
    elements.errorMessage.textContent = error.message;
    showState("error");
  } finally {
    elements.refreshBtn.classList.remove("spinning");
  }
}

function renderResources() {
  const counts = {
    all: allResources.length,
    application: allResources.filter((r) => r.resourceType === "application")
      .length,
    database: allResources.filter((r) => r.resourceType === "database").length,
    service: allResources.filter((r) => r.resourceType === "service").length,
  };

  elements.resourceFilters.querySelectorAll(".filter-chip").forEach((chip) => {
    const key = chip.dataset.filter;
    const label =
      key === "all"
        ? "All"
        : key === "application"
          ? "Apps"
          : key === "database"
            ? "DBs"
            : "Services";
    chip.textContent = `${label} ${counts[key] ?? 0}`;
    chip.classList.toggle("active", resourceFilter === key);
  });

  const visible =
    resourceFilter === "all"
      ? allResources
      : allResources.filter((r) => r.resourceType === resourceFilter);

  if (visible.length === 0) {
    elements.resources.innerHTML = `<div class="list-empty">No resources of this type.</div>`;
    return;
  }

  elements.resources.innerHTML = visible
    .map((r) => createResourceCard(r))
    .join("");

  elements.resources.querySelectorAll(".action-btn").forEach((btn) => {
    btn.addEventListener("click", handleAction);
  });
  elements.resources.querySelectorAll(".resource-name-link").forEach((link) => {
    link.addEventListener("click", handleShowAppDetails);
  });
  elements.resources.querySelectorAll(".open-logs-btn").forEach((btn) => {
    btn.addEventListener("click", handleShowLogs);
  });
  elements.resources.querySelectorAll(".open-site-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openUrl(splitFqdn(btn.dataset.fqdn)[0]);
    });
  });
}

function createResourceCard(resource) {
  const statusStr = (resource.status || "").toLowerCase();
  const statusClass = getStatusClass(statusStr);
  const isRunning = statusStr.includes("running");
  const displayStatus = statusStr ? formatStatus(statusStr) : "Unknown";
  const isApp = resource.resourceType === "application";
  const deployLabel = isRunning ? "Redeploy" : "Deploy";
  const hasFqdn = isApp && resource.fqdn && resource.fqdn.trim();
  const chip = RESOURCE_TYPES[resource.resourceType];

  const nameMarkup = isApp
    ? `<a href="#" class="resource-name-link" data-uuid="${resource.uuid}" title="${escapeHtml(resource.name)}">${escapeHtml(resource.name)}</a>`
    : `<span class="resource-name" title="${escapeHtml(resource.name)}">${escapeHtml(resource.name)}</span>`;

  return `
    <div class="app-card" data-uuid="${resource.uuid}">
      <div class="app-header">
        <div class="app-info">
          ${nameMarkup}
          <div class="resource-sub">
            <span class="type-chip ${chip.cls}">${chip.label}</span>
            <span class="app-type">${escapeHtml(resource.subtitle || "")}</span>
          </div>
        </div>
        <div class="app-status ${statusClass}">
          <span class="status-dot"></span>
          ${displayStatus}
        </div>
      </div>
      <div class="app-actions">
        <div class="actions-left">
          ${
            isApp
              ? `<button class="action-btn deploy" data-action="deploy" data-uuid="${resource.uuid}" data-type="${resource.resourceType}" title="${deployLabel}">${icons.rocket}</button>`
              : ""
          }
          <button class="action-btn restart" data-action="restart" data-uuid="${resource.uuid}" data-type="${resource.resourceType}" title="Restart" ${!isRunning ? "disabled" : ""}>
            ${icons.refreshCw}
          </button>
          ${
            isRunning
              ? `<button class="action-btn stop" data-action="stop" data-uuid="${resource.uuid}" data-type="${resource.resourceType}" title="Stop">${icons.square}</button>`
              : `<button class="action-btn start" data-action="start" data-uuid="${resource.uuid}" data-type="${resource.resourceType}" title="Start">${icons.play}</button>`
          }
        </div>
        <div class="actions-right">
          ${
            isApp
              ? `<button class="open-logs-btn util-btn" data-uuid="${resource.uuid}" data-name="${escapeHtml(resource.name)}" title="View Logs">${icons.fileText}</button>`
              : ""
          }
          ${hasFqdn ? `<button class="util-btn open-site-btn" data-fqdn="${escapeAttr(resource.fqdn)}" title="Open Website" ${!isRunning ? "disabled" : ""}>${icons.externalLink}</button>` : ""}
        </div>
      </div>
    </div>
  `;
}

// ---------- Deployments ----------

async function loadDeployments() {
  elements.loadingText.textContent = "Loading deployments...";
  showState("loading");
  elements.refreshBtn.classList.add("spinning");

  try {
    const response = await send("getDeployments");

    if (!response.success) {
      throw new Error(response.error);
    }

    let deployments = response.data;

    if (!deployments || deployments.length === 0) {
      showState("emptyDeployments");
      return;
    }

    deployments = deployments
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 10);

    renderDeployments(deployments);
    showState("deploymentsList");
  } catch (error) {
    elements.errorMessage.textContent = error.message;
    showState("error");
  } finally {
    elements.refreshBtn.classList.remove("spinning");
  }
}

function renderDeployments(deployments) {
  elements.deployments.innerHTML = deployments
    .map((deploy) => createDeploymentCard(deploy))
    .join("");

  elements.deployments
    .querySelectorAll(".deployment-name-link")
    .forEach((link) => {
      link.addEventListener("click", handleShowDeploymentDetails);
    });

  elements.deployments.querySelectorAll(".cancel-deploy-btn").forEach((btn) => {
    btn.addEventListener("click", handleCancelDeployment);
  });
}

function createDeploymentCard(deploy) {
  const status = deploy.status || "unknown";
  const statusClass = getDeploymentStatusClass(status);
  const displayStatus = formatDeploymentStatus(status);
  const appName = deploy.application_name || "Unknown App";
  const createdAt = formatDate(deploy.created_at);
  const lowerStatus = status.toLowerCase();
  const isInProgress =
    lowerStatus === "in_progress" ||
    lowerStatus === "running" ||
    lowerStatus === "building" ||
    lowerStatus === "deploying" ||
    lowerStatus === "queued" ||
    lowerStatus === "pending";

  return `
    <div class="deployment-card" data-uuid="${deploy.deployment_uuid}">
      <div class="deployment-header">
        <div class="deployment-info">
          <a href="#" class="deployment-name-link" data-uuid="${deploy.deployment_uuid}" title="${escapeHtml(appName)}">
            ${escapeHtml(appName)}
          </a>
          <div class="deployment-meta">
            <span class="deployment-date">${createdAt}</span>
            ${deploy.commit ? `<span class="deployment-commit" title="${escapeHtml(deploy.commit)}">${escapeHtml(deploy.commit.substring(0, 7))}</span>` : ""}
          </div>
        </div>
        <div class="deployment-actions">
          ${isInProgress ? `<button class="cancel-deploy-btn" data-uuid="${deploy.deployment_uuid}" data-name="${escapeAttr(appName)}" title="Cancel Deployment">${icons.x}</button>` : ""}
          <div class="deployment-status ${statusClass}">
            <span class="status-dot"></span>
            ${displayStatus}
          </div>
        </div>
      </div>
      ${deploy.commit_message ? `<div class="deployment-message" title="${escapeHtml(deploy.commit_message)}">${escapeHtml(deploy.commit_message)}</div>` : ""}
    </div>
  `;
}

// ---------- Servers ----------

async function loadServers() {
  elements.loadingText.textContent = "Loading servers...";
  showState("loading");
  elements.refreshBtn.classList.add("spinning");

  try {
    const response = await send("getServers");

    if (!response.success) {
      throw new Error(response.error);
    }

    const servers = response.data;

    if (!servers || servers.length === 0) {
      showState("emptyServers");
      return;
    }

    servers.sort((a, b) => a.name.localeCompare(b.name));
    renderServers(servers);
    showState("serversList");
  } catch (error) {
    elements.errorMessage.textContent = error.message;
    showState("error");
  } finally {
    elements.refreshBtn.classList.remove("spinning");
  }
}

function renderServers(servers) {
  elements.servers.innerHTML = servers
    .map((server) => createServerCard(server))
    .join("");

  elements.servers.querySelectorAll(".server-name-link").forEach((link) => {
    link.addEventListener("click", handleShowServerDetails);
  });
  elements.servers.querySelectorAll(".validate-btn").forEach((btn) => {
    btn.addEventListener("click", handleValidateServer);
  });
}

function healthPill(ok, label) {
  return `<span class="pill ${ok ? "pill-ok" : "pill-bad"}"><span class="status-dot"></span>${label}</span>`;
}

function createServerCard(server) {
  const reachable = server.settings?.is_reachable ?? false;
  const usable = server.settings?.is_usable ?? false;
  const host = server.ip
    ? `${server.user ? `${server.user}@` : ""}${server.ip}${server.port ? `:${server.port}` : ""}`
    : "n/a";

  return `
    <div class="server-card" data-uuid="${server.uuid}">
      <div class="server-header">
        <div class="server-info">
          <a href="#" class="server-name-link" data-uuid="${server.uuid}" title="${escapeHtml(server.name)}">${escapeHtml(server.name)}</a>
          ${server.description ? `<div class="app-type">${escapeHtml(server.description)}</div>` : ""}
        </div>
        <button class="validate-btn util-btn" data-uuid="${server.uuid}" title="Validate connection">${icons.wifi}</button>
      </div>
      <div class="server-host"><code>${escapeHtml(host)}</code></div>
      <div class="server-pills">
        ${healthPill(reachable, reachable ? "Reachable" : "Unreachable")}
        ${healthPill(usable, usable ? "Usable" : "Not usable")}
      </div>
    </div>
  `;
}

async function handleValidateServer(e) {
  e.stopPropagation();
  const btn = e.currentTarget;
  const uuid = btn.dataset.uuid;

  btn.disabled = true;
  btn.classList.add("spinning");
  btn.innerHTML = icons.loader;

  try {
    const response = await send("validateServer", { uuid });
    if (!response.success) throw new Error(response.error);
    setTimeout(loadServers, 1000);
  } catch (error) {
    alert(`Failed to validate server: ${error.message}`);
    btn.disabled = false;
    btn.classList.remove("spinning");
    btn.innerHTML = icons.wifi;
  }
}

async function handleShowServerDetails(e) {
  e.preventDefault();
  const uuid = e.currentTarget.dataset.uuid;

  elements.detailsTitle.textContent = "Server Details";
  elements.detailsContent.innerHTML =
    '<div class="details-loading">Loading...</div>';
  elements.detailsModal.classList.remove("hidden");

  try {
    const [srv, res] = await Promise.all([
      send("getServer", { uuid }),
      send("getServerResources", { uuid }),
    ]);

    if (!srv.success) throw new Error(srv.error);

    const server = srv.data;
    const resources = res.success && Array.isArray(res.data) ? res.data : [];
    elements.detailsTitle.textContent = server.name || "Server Details";
    elements.detailsContent.innerHTML = renderServerDetails(server, resources);
    attachCopyButtons(elements.detailsContent);
  } catch (error) {
    elements.detailsContent.innerHTML = `<div class="details-error">Error: ${escapeHtml(error.message)}</div>`;
  }
}

function cleanResourceType(type) {
  const last = String(type || "")
    .split("\\")
    .pop();
  return last.replace(/^Standalone/, "") || "Resource";
}

function renderServerDetails(server, resources) {
  const reachable = server.settings?.is_reachable ?? false;
  const usable = server.settings?.is_usable ?? false;

  const pills = `<div class="server-pills detail-pills">
    ${healthPill(reachable, reachable ? "Reachable" : "Unreachable")}
    ${healthPill(usable, usable ? "Usable" : "Not usable")}
  </div>`;

  const table = renderDetailsTable([
    { label: "UUID", value: server.uuid, mono: true, copy: true },
    { label: "Description", value: server.description },
    { label: "IP", value: server.ip, mono: true, copy: true },
    { label: "Port", value: server.port ? String(server.port) : null },
    { label: "User", value: server.user },
  ]);

  const resourcesList = resources.length
    ? `<div class="sub-list">${resources
        .map((r) => {
          const statusStr = (r.status || "").toLowerCase();
          const cls = getStatusClass(statusStr);
          const display = statusStr ? formatStatus(statusStr) : "Unknown";
          return `<div class="sub-row">
            <div class="sub-info">
              <div class="sub-name">${escapeHtml(r.name || "")}</div>
              <div class="app-type">${escapeHtml(cleanResourceType(r.type))}</div>
            </div>
            <div class="app-status ${cls}"><span class="status-dot"></span>${display}</div>
          </div>`;
        })
        .join("")}</div>`
    : `<div class="list-empty">No resources running on this server.</div>`;

  return `
    ${pills}
    ${table}
    <div class="section-label">Running Resources${resources.length ? ` (${resources.length})` : ""}</div>
    ${resourcesList}
  `;
}

// ---------- Shared formatters ----------

function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return date.toLocaleDateString();
}

function getDeploymentStatusClass(status) {
  const lowerStatus = status.toLowerCase();

  if (
    lowerStatus === "finished" ||
    lowerStatus === "success" ||
    lowerStatus === "completed"
  ) {
    return "status-success";
  }
  if (
    lowerStatus === "failed" ||
    lowerStatus === "error" ||
    lowerStatus === "cancelled" ||
    lowerStatus === "canceled"
  ) {
    return "status-failed";
  }
  if (
    lowerStatus === "in_progress" ||
    lowerStatus === "running" ||
    lowerStatus === "building" ||
    lowerStatus === "deploying"
  ) {
    return "status-in-progress";
  }
  if (lowerStatus === "queued" || lowerStatus === "pending") {
    return "status-queued";
  }
  return "status-unknown";
}

function formatDeploymentStatus(status) {
  if (!status) return "Unknown";
  const s = status.toLowerCase();
  // Coolify reports a completed deployment as "finished" (not "success"),
  // so normalize known synonyms to a consistent label.
  if (s === "finished" || s === "success" || s === "completed") return "Success";
  if (s === "failed" || s === "error") return "Failed";
  if (s.includes("cancel")) return "Cancelled";
  if (
    s === "in_progress" ||
    s === "running" ||
    s === "building" ||
    s === "deploying"
  ) {
    return "In Progress";
  }
  if (s === "queued" || s === "pending") return "Queued";
  return status
    .replace(/_/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function formatStatus(status) {
  return status
    .split(":")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(": ");
}

function getStatusClass(status) {
  const lowerStatus = status.toLowerCase();

  if (lowerStatus.includes("running") && lowerStatus.includes("healthy")) {
    return "status-running-healthy";
  }
  if (lowerStatus.includes("running") && lowerStatus.includes("unhealthy")) {
    return "status-running-unhealthy";
  }
  if (lowerStatus.includes("running")) {
    return "status-running-healthy";
  }
  if (lowerStatus.includes("exited") || lowerStatus.includes("unhealthy")) {
    return "status-stopped";
  }
  if (
    lowerStatus.includes("building") ||
    lowerStatus.includes("deploying") ||
    lowerStatus.includes("starting") ||
    lowerStatus.includes("restarting")
  ) {
    return "status-building";
  }
  if (lowerStatus.includes("stopped")) {
    return "status-stopped";
  }
  return "status-unknown";
}

// ---------- Application details + history ----------

async function handleShowAppDetails(e) {
  e.preventDefault();
  const uuid = e.currentTarget.dataset.uuid;

  elements.detailsTitle.textContent = "Application Details";
  elements.detailsContent.innerHTML =
    '<div class="details-loading">Loading...</div>';
  elements.detailsModal.classList.remove("hidden");

  try {
    const response = await send("getApplication", { uuid });
    if (!response.success) throw new Error(response.error);

    const app = response.data;
    showAppDetails(app);
  } catch (error) {
    elements.detailsContent.innerHTML = `<div class="details-error">Error: ${escapeHtml(error.message)}</div>`;
  }
}

function showAppDetails(app) {
  elements.detailsTitle.textContent = app.name || "Application Details";
  elements.detailsContent.innerHTML = renderAppDetails(app);
  attachCopyButtons(elements.detailsContent);

  const historyBtn = elements.detailsContent.querySelector("#app-history-btn");
  const logsBtn = elements.detailsContent.querySelector("#app-logs-btn");
  if (historyBtn) {
    historyBtn.addEventListener("click", () => showAppHistory(app));
  }
  if (logsBtn) {
    logsBtn.addEventListener("click", () => {
      closeDetails();
      currentLogsApp = { uuid: app.uuid, appName: app.name };
      elements.logsTitle.textContent = `Logs: ${app.name}`;
      elements.logsContent.innerHTML =
        '<div class="logs-loading">Loading logs...</div>';
      elements.logsModal.classList.remove("hidden");
      refreshLogs();
    });
  }
}

function renderAppDetails(app) {
  const fqdnUrls = splitFqdn(app.fqdn);
  const fqdnHtml = fqdnUrls.length
    ? `<div class="link-list">${fqdnUrls
        .map((url) => {
          const href = url.startsWith("http") ? url : `https://${url}`;
          return `<a href="${escapeAttr(href)}" target="_blank" rel="noopener">${escapeHtml(url)}</a>`;
        })
        .join("")}</div>`
    : null;

  const actions = `
    <div class="detail-actions">
      <button class="detail-action-btn" id="app-history-btn">${icons.history}<span>History</span></button>
      <button class="detail-action-btn" id="app-logs-btn">${icons.fileText}<span>Logs</span></button>
    </div>`;

  const table = renderDetailsTable([
    { label: "UUID", value: app.uuid, mono: true, copy: true },
    { label: "Status", value: app.status || "Unknown" },
    { label: "Type", value: app.type || "application" },
    { label: "Build Pack", value: app.build_pack },
    { label: "URL", html: fqdnHtml },
    { label: "Repository", value: app.git_repository, copy: !!app.git_repository },
    { label: "Branch", value: app.git_branch },
    {
      label: "Created",
      value: app.created_at ? new Date(app.created_at).toLocaleString() : null,
    },
    {
      label: "Updated",
      value: app.updated_at ? new Date(app.updated_at).toLocaleString() : null,
    },
  ]);

  return actions + table;
}

async function showAppHistory(app) {
  historyState = { app, skip: 0, items: [], hasMore: true };
  elements.detailsTitle.textContent = `${app.name} — History`;
  elements.detailsContent.innerHTML = `
    <button class="back-btn" id="history-back">← Back to details</button>
    <div id="history-list" class="sub-list"></div>
    <div class="details-loading" id="history-loading">Loading...</div>
    <div id="history-more"></div>`;

  elements.detailsContent
    .querySelector("#history-back")
    .addEventListener("click", () => showAppDetails(app));

  await loadMoreHistory();
}

async function loadMoreHistory() {
  if (!historyState) return;
  const { app, skip } = historyState;
  const loading = elements.detailsContent.querySelector("#history-loading");
  if (loading) loading.classList.remove("hidden");

  try {
    const response = await send("getDeploymentsByApp", {
      uuid: app.uuid,
      skip,
      take: HISTORY_PAGE_SIZE,
    });
    if (!response.success) throw new Error(response.error);

    // The endpoint wraps the list as { count, deployments }. Fall back to a
    // bare array just in case the shape differs across Coolify versions.
    const data = response.data || {};
    const batch = Array.isArray(data.deployments)
      ? data.deployments
      : Array.isArray(data)
        ? data
        : [];
    const count = typeof data.count === "number" ? data.count : null;

    historyState.items.push(...batch);
    historyState.skip += batch.length;
    historyState.hasMore =
      count != null
        ? historyState.skip < count
        : batch.length === HISTORY_PAGE_SIZE;

    renderHistory();
  } catch (error) {
    const listEl = elements.detailsContent.querySelector("#history-list");
    if (listEl) {
      listEl.innerHTML = `<div class="details-error">Error: ${escapeHtml(error.message)}</div>`;
    }
  } finally {
    const l = elements.detailsContent.querySelector("#history-loading");
    if (l) l.classList.add("hidden");
  }
}

function renderHistory() {
  const listEl = elements.detailsContent.querySelector("#history-list");
  const moreEl = elements.detailsContent.querySelector("#history-more");
  if (!listEl) return;

  if (historyState.items.length === 0) {
    listEl.innerHTML = `<div class="list-empty">No deployments yet.</div>`;
    return;
  }

  listEl.innerHTML = historyState.items
    .map((d) => {
      const status = d.status || "unknown";
      const cls = getDeploymentStatusClass(status);
      const display = formatDeploymentStatus(status);
      const date = formatDate(d.created_at);
      const commit = d.commit ? d.commit.substring(0, 7) : "";
      return `<div class="sub-row history-row" data-uuid="${d.deployment_uuid}">
        <div class="sub-info">
          <div class="sub-name">${date}${commit ? ` · <span class="deployment-commit">${escapeHtml(commit)}</span>` : ""}</div>
          ${d.commit_message ? `<div class="app-type">${escapeHtml(d.commit_message)}</div>` : ""}
        </div>
        <div class="deployment-status ${cls}"><span class="status-dot"></span>${display}</div>
      </div>`;
    })
    .join("");

  listEl.querySelectorAll(".history-row").forEach((row) => {
    row.addEventListener("click", () => {
      const uuid = row.dataset.uuid;
      showDeploymentDetails(uuid);
    });
  });

  if (moreEl) {
    moreEl.innerHTML = historyState.hasMore
      ? `<button class="btn btn-secondary load-more-btn" id="load-more">Load more</button>`
      : "";
    const loadMoreBtn = moreEl.querySelector("#load-more");
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener("click", () => {
        loadMoreBtn.disabled = true;
        loadMoreBtn.textContent = "Loading...";
        loadMoreHistory();
      });
    }
  }
}

// ---------- Deployment details (with build logs) ----------

async function handleShowDeploymentDetails(e) {
  e.preventDefault();
  showDeploymentDetails(e.currentTarget.dataset.uuid);
}

async function showDeploymentDetails(uuid) {
  elements.detailsTitle.textContent = "Deployment Details";
  elements.detailsContent.innerHTML =
    '<div class="details-loading">Loading...</div>';
  elements.detailsModal.classList.remove("hidden");

  try {
    const response = await send("getDeployment", { uuid });
    if (!response.success) throw new Error(response.error);

    const deploy = response.data;
    elements.detailsTitle.textContent = deploy.application_name
      ? `${deploy.application_name} — Deployment`
      : "Deployment Details";
    elements.detailsContent.innerHTML = renderDeploymentDetails(deploy);
    attachCopyButtons(elements.detailsContent);
  } catch (error) {
    elements.detailsContent.innerHTML = `<div class="details-error">Error: ${escapeHtml(error.message)}</div>`;
  }
}

function parseDeploymentLogs(raw) {
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((entry) => entry && !entry.hidden && entry.output != null)
        .map((entry) => String(entry.output))
        .join("\n")
        .trim();
    }
  } catch {
    // not JSON, show raw
  }
  return String(raw).trim();
}

function renderDeploymentDetails(deploy) {
  const table = renderDetailsTable([
    { label: "Application", value: deploy.application_name },
    { label: "UUID", value: deploy.deployment_uuid, mono: true, copy: true },
    {
      label: "Status",
      value: deploy.status ? formatDeploymentStatus(deploy.status) : null,
    },
    { label: "Server", value: deploy.server_name },
    { label: "Commit", value: deploy.commit, mono: true, copy: !!deploy.commit },
    { label: "Commit Message", value: deploy.commit_message },
    { label: "Git Type", value: deploy.git_type },
    { label: "Is Webhook", value: deploy.is_webhook ? "Yes" : "No" },
    { label: "Is API", value: deploy.is_api ? "Yes" : "No" },
    { label: "Force Rebuild", value: deploy.force_rebuild ? "Yes" : "No" },
    { label: "Restart Only", value: deploy.restart_only ? "Yes" : "No" },
    {
      label: "Created",
      value: deploy.created_at
        ? new Date(deploy.created_at).toLocaleString()
        : null,
    },
    {
      label: "Updated",
      value: deploy.updated_at
        ? new Date(deploy.updated_at).toLocaleString()
        : null,
    },
  ]);

  const logs = parseDeploymentLogs(deploy.logs);
  const logsHtml = logs
    ? `<div class="section-label">Build Logs</div>
       <div class="build-logs"><pre>${escapeHtml(logs)}</pre></div>`
    : "";

  return table + logsHtml;
}

// ---------- Details table (with copy + raw html) ----------

function renderDetailsTable(details) {
  const rows = details
    .filter(
      (d) =>
        d.html ||
        (d.value !== null && d.value !== undefined && d.value !== ""),
    )
    .map((d) => {
      let valueHtml;
      if (d.html) {
        valueHtml = d.html;
      } else {
        valueHtml = escapeHtml(String(d.value));
        if (d.mono) valueHtml = `<code>${valueHtml}</code>`;
        if (d.link) {
          const url = d.value.startsWith("http")
            ? d.value
            : `https://${d.value}`;
          valueHtml = `<a href="${escapeAttr(url)}" target="_blank" rel="noopener">${valueHtml}</a>`;
        }
      }

      const copyBtn =
        d.copy && d.value
          ? `<button class="copy-btn" data-copy="${escapeAttr(String(d.value))}" title="Copy">${icons.copy}</button>`
          : "";

      return `
      <tr>
        <td class="detail-label">${escapeHtml(d.label)}</td>
        <td class="detail-value">
          <div class="detail-value-wrap">
            <div class="detail-value-content">${valueHtml}</div>
            ${copyBtn}
          </div>
        </td>
      </tr>
    `;
    })
    .join("");

  return `<table class="details-table">${rows}</table>`;
}

function attachCopyButtons(container) {
  container.querySelectorAll(".copy-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.copy || "");
        const original = btn.innerHTML;
        btn.innerHTML = icons.check;
        btn.classList.add("copied");
        setTimeout(() => {
          btn.innerHTML = original;
          btn.classList.remove("copied");
        }, 1500);
      } catch {
        // clipboard unavailable
      }
    });
  });
}

// ---------- Resource actions ----------

const ACTION_MAP = {
  application: {
    deploy: "deployApplication",
    restart: "restartApplication",
    start: "startApplication",
    stop: "stopApplication",
  },
  database: {
    restart: "restartDatabase",
    start: "startDatabase",
    stop: "stopDatabase",
  },
  service: {
    restart: "restartService",
    start: "startService",
    stop: "stopService",
  },
};

async function handleAction(e) {
  const btn = e.currentTarget;
  const action = btn.dataset.action;
  const uuid = btn.dataset.uuid;
  const type = btn.dataset.type || "application";

  if (btn.classList.contains("loading")) return;

  if (action === "stop") {
    if (!confirm(`Are you sure you want to stop this ${type}?`)) {
      return;
    }
  }

  btn.classList.add("loading");
  const originalContent = btn.innerHTML;
  btn.innerHTML = icons.loader;

  try {
    const messageAction = ACTION_MAP[type]?.[action];
    if (!messageAction) throw new Error("Unsupported action");

    const response = await send(messageAction, { uuid });
    if (!response.success) throw new Error(response.error);

    setTimeout(loadResources, 1500);
  } catch (error) {
    alert(`Error: ${error.message}`);
    btn.innerHTML = originalContent;
    btn.classList.remove("loading");
  }
}

// ---------- Logs ----------

async function handleShowLogs(e) {
  const btn = e.currentTarget;
  const uuid = btn.dataset.uuid;
  const appName = btn.dataset.name;

  currentLogsApp = { uuid, appName };
  elements.logsTitle.textContent = `Logs: ${appName}`;
  elements.logsContent.innerHTML =
    '<div class="logs-loading">Loading logs...</div>';
  elements.logsModal.classList.remove("hidden");

  await refreshLogs();
}

async function refreshLogs() {
  if (!currentLogsApp) return;

  elements.logsRefresh.classList.add("spinning");

  try {
    const response = await send("getApplicationLogs", {
      uuid: currentLogsApp.uuid,
      lines: 200,
    });

    if (!response.success) {
      throw new Error(response.error);
    }

    const logs = response.data?.logs || response.data || "No logs available";
    elements.logsContent.innerHTML = `<pre>${escapeHtml(typeof logs === "string" ? logs : JSON.stringify(logs, null, 2))}</pre>`;
    elements.logsContent.scrollTop = elements.logsContent.scrollHeight;
  } catch (error) {
    elements.logsContent.innerHTML = `<div class="logs-error">Error loading logs: ${escapeHtml(error.message)}</div>`;
  } finally {
    elements.logsRefresh.classList.remove("spinning");
  }
}

function closeLogs() {
  elements.logsModal.classList.add("hidden");
  currentLogsApp = null;
}

function closeDetails() {
  elements.detailsModal.classList.add("hidden");
  historyState = null;
}

async function handleCancelDeployment(e) {
  e.stopPropagation();

  const btn = e.currentTarget;
  const uuid = btn.dataset.uuid;
  const appName = btn.dataset.name;

  btn.disabled = true;
  btn.innerHTML = icons.loader;
  btn.classList.add("spinning");

  try {
    const response = await send("cancelDeployment", { uuid, appName });
    if (!response.success) throw new Error(response.error);
    loadDeployments();
  } catch (error) {
    alert(`Failed to cancel deployment: ${error.message}`);
    btn.disabled = false;
    btn.innerHTML = icons.x;
    btn.classList.remove("spinning");
  }
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function escapeAttr(text) {
  return escapeHtml(text).replace(/"/g, "&quot;");
}

function refreshCurrentTab() {
  if (currentTab === "resources") {
    loadResources();
  } else if (currentTab === "deployments") {
    loadDeployments();
  } else if (currentTab === "servers") {
    loadServers();
  }
}

async function init() {
  elements.refreshBtn.addEventListener("click", refreshCurrentTab);
  elements.openOptionsBtn.addEventListener("click", openOptions);
  elements.retryBtn.addEventListener("click", refreshCurrentTab);
  elements.autoRefreshBtn.addEventListener("click", toggleAutoRefresh);
  elements.settingsBtn.addEventListener("click", openOptions);
  elements.openCoolifyBtn.addEventListener("click", openCoolify);
  elements.logsClose.addEventListener("click", closeLogs);
  elements.logsRefresh.addEventListener("click", refreshLogs);
  elements.detailsClose.addEventListener("click", closeDetails);

  elements.resourceFilters.querySelectorAll(".filter-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      resourceFilter = chip.dataset.filter;
      renderResources();
    });
  });

  elements.logsModal.addEventListener("click", (e) => {
    if (e.target === elements.logsModal) {
      closeLogs();
    }
  });

  elements.detailsModal.addEventListener("click", (e) => {
    if (e.target === elements.detailsModal) {
      closeDetails();
    }
  });

  elements.tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      switchTab(btn.dataset.tab);
    });
  });

  if (await isConfigured()) {
    elements.tabsContainer.classList.remove("hidden");
    updateOpenCoolifyButton();

    if (autoRefreshEnabled) {
      elements.autoRefreshBtn.classList.add("active");
      autoRefreshInterval = setInterval(
        refreshCurrentTab,
        AUTO_REFRESH_INTERVAL,
      );
    } else {
      elements.autoRefreshBtn.classList.remove("active");
    }

    loadResources();
  } else {
    updateOpenCoolifyButton();
    elements.autoRefreshBtn.classList.remove("active");
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
      autoRefreshInterval = null;
    }
    showState("notConfigured");
  }
}

init();
