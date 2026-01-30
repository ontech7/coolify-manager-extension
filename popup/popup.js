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
};

const states = {
  notConfigured: document.getElementById("not-configured"),
  loading: document.getElementById("loading"),
  error: document.getElementById("error"),
  emptyList: document.getElementById("empty-list"),
  appList: document.getElementById("app-list"),
  emptyDeployments: document.getElementById("empty-deployments"),
  deploymentsList: document.getElementById("deployments-list"),
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
  applications: document.getElementById("applications"),
  deployments: document.getElementById("deployments"),
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

let currentLogsApp = null;
let currentTab = "apps";
let serverUrl = "";
let autoRefreshInterval = null;
let autoRefreshEnabled = false;

function showState(stateName) {
  Object.entries(states).forEach(([name, element]) => {
    element.classList.toggle("hidden", name !== stateName);
  });
}

function hideAllStates() {
  Object.values(states).forEach((element) => {
    element.classList.add("hidden");
  });
}

function openOptions() {
  chrome.runtime.openOptionsPage();
}

function openCoolify() {
  if (!serverUrl) return;
  chrome.tabs.create({ url: serverUrl });
}

async function isConfigured() {
  const config = await chrome.storage.sync.get(["serverUrl", "apiToken"]);
  if (config.serverUrl) {
    serverUrl = config.serverUrl.replace(/\/$/, "");
  }
  return !!(config.serverUrl && config.apiToken);
}

function openAppSite(fqdn) {
  if (!fqdn) return;
  const firstUrl = fqdn.split(",")[0].trim();
  if (!firstUrl) return;
  const url = firstUrl.startsWith("http") ? firstUrl : `https://${firstUrl}`;
  chrome.tabs.create({ url });
}

function toggleAutoRefresh() {
  autoRefreshEnabled = !autoRefreshEnabled;

  if (autoRefreshEnabled) {
    elements.autoRefreshBtn.classList.add("active");
    autoRefreshInterval = setInterval(refreshCurrentTab, 10000);
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

  if (tab === "apps") {
    loadApplications();
  } else if (tab === "deployments") {
    loadDeployments();
  }
}

async function loadApplications() {
  elements.loadingText.textContent = "Loading applications...";
  showState("loading");
  elements.refreshBtn.classList.add("spinning");

  try {
    const response = await chrome.runtime.sendMessage({
      action: "getApplications",
    });

    if (!response.success) {
      throw new Error(response.error);
    }

    const apps = response.data;

    if (!apps || apps.length === 0) {
      showState("emptyList");
      return;
    }

    renderApplications(apps);
    showState("appList");
  } catch (error) {
    elements.errorMessage.textContent = error.message;
    showState("error");
  } finally {
    elements.refreshBtn.classList.remove("spinning");
  }
}

async function loadDeployments() {
  elements.loadingText.textContent = "Loading deployments...";
  showState("loading");
  elements.refreshBtn.classList.add("spinning");

  try {
    const response = await chrome.runtime.sendMessage({
      action: "getDeployments",
    });

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

function renderApplications(apps) {
  elements.applications.innerHTML = apps
    .map((app) => createAppCard(app))
    .join("");

  elements.applications.querySelectorAll(".action-btn").forEach((btn) => {
    btn.addEventListener("click", handleAction);
  });

  elements.applications.querySelectorAll(".app-name-link").forEach((link) => {
    link.addEventListener("click", handleShowAppDetails);
  });

  elements.applications.querySelectorAll(".open-logs-btn").forEach((btn) => {
    btn.addEventListener("click", handleShowLogs);
  });

  elements.applications.querySelectorAll(".open-site-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openAppSite(btn.dataset.fqdn);
    });
  });
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

function createAppCard(app) {
  const status = getAppStatus(app);
  const statusClass = getStatusClass(status);
  const isRunning = status.includes("running");
  const deployLabel = isRunning ? "Redeploy" : "Deploy";
  const displayStatus = formatStatus(status);
  const hasFqdn = app.fqdn && app.fqdn.trim();

  return `
    <div class="app-card" data-uuid="${app.uuid}" data-name="${app.name}">
      <div class="app-header">
        <div class="app-info">
          <a href="#" class="app-name-link" data-uuid="${app.uuid}" title="${app.name}">${app.name}</a>
          <div class="app-type">${app.type || "application"}</div>
        </div>
        <div class="app-status ${statusClass}">
          <span class="status-dot"></span>
          ${displayStatus}
        </div>
      </div>
      <div class="app-actions">
        <div class="actions-left">
          <button class="action-btn deploy" data-action="deploy" data-uuid="${app.uuid}" data-name="${app.name}" title="${deployLabel}">
            ${icons.rocket}
          </button>
          <button class="action-btn restart" data-action="restart" data-uuid="${app.uuid}" data-name="${app.name}" title="Restart" ${!isRunning ? "disabled" : ""}>
            ${icons.refreshCw}
          </button>
          ${
            isRunning
              ? `
            <button class="action-btn stop" data-action="stop" data-uuid="${app.uuid}" data-name="${app.name}" title="Stop">
              ${icons.square}
            </button>
          `
              : `
            <button class="action-btn start" data-action="start" data-uuid="${app.uuid}" data-name="${app.name}" title="Start">
              ${icons.play}
            </button>
          `
          }
        </div>
        <div class="actions-right">
          <button class="open-logs-btn util-btn" data-uuid="${app.uuid}" data-name="${app.name}" title="View Logs">
            ${icons.fileText}
          </button>
          ${hasFqdn ? `<button class="util-btn open-site-btn" data-fqdn="${escapeHtml(app.fqdn)}" title="Open Website" ${!isRunning ? "disabled" : ""}>${icons.externalLink}</button>` : ""}
        </div>
      </div>
    </div>
  `;
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
          <a href="#" class="deployment-name-link" data-uuid="${deploy.deployment_uuid}" data-deploy='${JSON.stringify(deploy).replace(/'/g, "&#39;")}' title="${appName}">
            ${appName}
          </a>
          <div class="deployment-meta">
            <span class="deployment-date">${createdAt}</span>
            ${deploy.commit ? `<span class="deployment-commit" title="${deploy.commit}">${deploy.commit.substring(0, 7)}</span>` : ""}
          </div>
        </div>
        <div class="deployment-actions">
          ${isInProgress ? `<button class="cancel-deploy-btn" data-uuid="${deploy.deployment_uuid}" data-name="${appName}" title="Cancel Deployment">${icons.x}</button>` : ""}
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

function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) {
    return "Just now";
  }

  if (diff < 3600000) {
    const mins = Math.floor(diff / 60000);
    return `${mins}m ago`;
  }

  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}h ago`;
  }

  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000);
    return `${days}d ago`;
  }

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

function getAppStatus(app) {
  if (app.status) {
    return app.status.toLowerCase();
  }
  if (app.is_running || app.running) {
    return "running";
  }
  return "stopped";
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

async function handleShowAppDetails(e) {
  e.preventDefault();
  const link = e.currentTarget;
  const uuid = link.dataset.uuid;

  elements.detailsTitle.textContent = "Application Details";
  elements.detailsContent.innerHTML =
    '<div class="details-loading">Loading...</div>';
  elements.detailsModal.classList.remove("hidden");

  try {
    const response = await chrome.runtime.sendMessage({
      action: "getApplication",
      data: { uuid },
    });

    if (!response.success) {
      throw new Error(response.error);
    }

    const app = response.data;
    elements.detailsTitle.textContent = app.name || "Application Details";
    elements.detailsContent.innerHTML = renderAppDetails(app);
  } catch (error) {
    elements.detailsContent.innerHTML = `<div class="details-error">Error: ${escapeHtml(error.message)}</div>`;
  }
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
    const response = await chrome.runtime.sendMessage({
      action: "cancelDeployment",
      data: { uuid, appName },
    });

    if (!response.success) {
      throw new Error(response.error);
    }

    loadDeployments();
  } catch (error) {
    alert(`Failed to cancel deployment: ${error.message}`);
    btn.disabled = false;
    btn.innerHTML = icons.x;
    btn.classList.remove("spinning");
  }
}

function handleShowDeploymentDetails(e) {
  e.preventDefault();
  const link = e.currentTarget;
  const deployData = JSON.parse(link.dataset.deploy);

  elements.detailsTitle.textContent = "Deployment Details";
  elements.detailsContent.innerHTML = renderDeploymentDetails(deployData);
  elements.detailsModal.classList.remove("hidden");
}

function renderAppDetails(app) {
  const details = [
    { label: "Name", value: app.name },
    { label: "UUID", value: app.uuid, mono: true },
    { label: "Status", value: app.status || "Unknown" },
    { label: "Type", value: app.type || "application" },
    { label: "FQDN", value: app.fqdn, link: true },
    { label: "Repository", value: app.git_repository },
    { label: "Branch", value: app.git_branch },
    { label: "Build Pack", value: app.build_pack },
    {
      label: "Created",
      value: app.created_at ? new Date(app.created_at).toLocaleString() : null,
    },
    {
      label: "Updated",
      value: app.updated_at ? new Date(app.updated_at).toLocaleString() : null,
    },
  ];

  return renderDetailsTable(details);
}

function renderDeploymentDetails(deploy) {
  const details = [
    { label: "Application", value: deploy.application_name },
    { label: "Deployment UUID", value: deploy.deployment_uuid, mono: true },
    { label: "Status", value: deploy.status },
    { label: "Server", value: deploy.server_name },
    { label: "Commit", value: deploy.commit, mono: true },
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
  ];

  return renderDetailsTable(details);
}

function renderDetailsTable(details) {
  const rows = details
    .filter((d) => d.value !== null && d.value !== undefined && d.value !== "")
    .map((d) => {
      let valueHtml = escapeHtml(String(d.value));
      if (d.mono) {
        valueHtml = `<code>${valueHtml}</code>`;
      }
      if (d.link && d.value) {
        const url = d.value.startsWith("http") ? d.value : `https://${d.value}`;
        valueHtml = `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${valueHtml}</a>`;
      }
      return `
      <tr>
        <td class="detail-label">${escapeHtml(d.label)}</td>
        <td class="detail-value">${valueHtml}</td>
      </tr>
    `;
    })
    .join("");

  return `<table class="details-table">${rows}</table>`;
}

async function handleAction(e) {
  const btn = e.currentTarget;
  const action = btn.dataset.action;
  const uuid = btn.dataset.uuid;
  const appName = btn.dataset.name;

  if (btn.classList.contains("loading")) return;

  if (action === "stop") {
    if (!confirm("Are you sure you want to stop this application?")) {
      return;
    }
  }

  btn.classList.add("loading");
  const originalContent = btn.innerHTML;
  btn.innerHTML = icons.loader;

  try {
    const actionMap = {
      deploy: "deployApplication",
      restart: "restartApplication",
      start: "startApplication",
      stop: "stopApplication",
    };

    const response = await chrome.runtime.sendMessage({
      action: actionMap[action],
      data: { uuid, appName },
    });

    if (!response.success) {
      throw new Error(response.error);
    }

    setTimeout(loadApplications, 1500);
  } catch (error) {
    alert(`Error: ${error.message}`);
    btn.innerHTML = originalContent;
    btn.classList.remove("loading");
  }
}

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
    const response = await chrome.runtime.sendMessage({
      action: "getApplicationLogs",
      data: { uuid: currentLogsApp.uuid, lines: 200 },
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
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function refreshCurrentTab() {
  if (currentTab === "apps") {
    loadApplications();
  } else if (currentTab === "deployments") {
    loadDeployments();
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
    elements.openCoolifyBtn.disabled = !serverUrl;
    loadApplications();
  } else {
    elements.openCoolifyBtn.disabled = true;
    showState("notConfigured");
  }
}

init();
