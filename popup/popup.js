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
};

const states = {
  notConfigured: document.getElementById("not-configured"),
  loading: document.getElementById("loading"),
  error: document.getElementById("error"),
  emptyList: document.getElementById("empty-list"),
  appList: document.getElementById("app-list"),
};

const elements = {
  refreshBtn: document.getElementById("refresh-btn"),
  openOptionsBtn: document.getElementById("open-options"),
  retryBtn: document.getElementById("retry-btn"),
  settingsBtn: document.getElementById("settings-btn"),
  errorMessage: document.getElementById("error-message"),
  applications: document.getElementById("applications"),
  logsModal: document.getElementById("logs-modal"),
  logsTitle: document.getElementById("logs-title"),
  logsContent: document.getElementById("logs-content"),
  logsClose: document.getElementById("logs-close"),
  logsRefresh: document.getElementById("logs-refresh"),
};

let currentLogsApp = null;

function showState(stateName) {
  Object.entries(states).forEach(([name, element]) => {
    element.classList.toggle("hidden", name !== stateName);
  });
}

function openOptions() {
  chrome.runtime.openOptionsPage();
}

async function isConfigured() {
  const config = await chrome.storage.sync.get(["serverUrl", "apiToken"]);
  return !!(config.serverUrl && config.apiToken);
}

async function loadApplications() {
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

function renderApplications(apps) {
  elements.applications.innerHTML = apps
    .map((app) => createAppCard(app))
    .join("");

  elements.applications.querySelectorAll(".action-btn").forEach((btn) => {
    btn.addEventListener("click", handleAction);
  });

  elements.applications.querySelectorAll(".logs-btn").forEach((btn) => {
    btn.addEventListener("click", handleShowLogs);
  });
}

function createAppCard(app) {
  const status = getAppStatus(app);
  const statusClass = getStatusClass(status);
  const isRunning = status.includes("running");
  const deployLabel = isRunning ? "Redeploy" : "Deploy";
  const displayStatus = formatStatus(status);

  return `
    <div class="app-card" data-uuid="${app.uuid}" data-name="${app.name}">
      <div class="app-header">
        <div class="app-info">
          <div class="app-name" title="${app.name}">${app.name}</div>
          <div class="app-type">${app.type || "application"}</div>
        </div>
        <div class="app-status ${statusClass}">
          <span class="status-dot"></span>
          ${displayStatus}
        </div>
      </div>
      <div class="app-actions">
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
        <button class="logs-btn" data-uuid="${app.uuid}" data-name="${app.name}" title="View Logs">
          ${icons.fileText}
        </button>
      </div>
    </div>
  `;
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

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

async function init() {
  elements.refreshBtn.addEventListener("click", loadApplications);
  elements.openOptionsBtn.addEventListener("click", openOptions);
  elements.retryBtn.addEventListener("click", loadApplications);
  elements.settingsBtn.addEventListener("click", openOptions);
  elements.logsClose.addEventListener("click", closeLogs);
  elements.logsRefresh.addEventListener("click", refreshLogs);
  elements.logsModal.addEventListener("click", (e) => {
    if (e.target === elements.logsModal) {
      closeLogs();
    }
  });

  if (await isConfigured()) {
    loadApplications();
  } else {
    showState("notConfigured");
  }
}

init();
