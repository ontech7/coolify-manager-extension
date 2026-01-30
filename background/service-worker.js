import { CoolifyAPI } from "../lib/coolify-api.js";

const pendingDeployments = new Map();

async function getConfig() {
  const result = await chrome.storage.sync.get([
    "serverUrl",
    "apiToken",
    "notificationsEnabled",
  ]);
  return result;
}

async function createApiInstance() {
  const config = await getConfig();

  if (!config.serverUrl || !config.apiToken) {
    throw new Error(
      "Configuration missing. Go to options to configure the server.",
    );
  }

  return new CoolifyAPI(config.serverUrl, config.apiToken);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request)
    .then(sendResponse)
    .catch((error) => sendResponse({ success: false, error: error.message }));

  return true;
});

async function handleMessage(request) {
  const { action, data } = request;

  switch (action) {
    case "testConnection":
      return await testConnection(data);

    case "getApplications":
      return await getApplications();

    case "getApplication":
      return await getApplication(data.uuid);

    case "startApplication":
      return await startApplication(data.uuid, data.appName);

    case "stopApplication":
      return await stopApplication(data.uuid, data.appName);

    case "restartApplication":
      return await restartApplication(data.uuid, data.appName);

    case "deployApplication":
      return await deployApplication(data.uuid, data.appName);

    case "getApplicationLogs":
      return await getApplicationLogs(data.uuid, data.lines);

    case "getDeployments":
      return await getDeployments();

    case "getDeploymentsByApp":
      return await getDeploymentsByApp(data.uuid, data.skip, data.take);

    case "getDeployment":
      return await getDeployment(data.uuid);

    case "cancelDeployment":
      return await cancelDeployment(data.uuid, data.appName);

    case "setNotificationsEnabled":
      return await setNotificationsEnabled(data.enabled);

    case "getNotificationsEnabled":
      return await getNotificationsEnabled();

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

async function testConnection(data) {
  const api = new CoolifyAPI(data.serverUrl, data.apiToken);
  return await api.testConnection();
}

async function getApplications() {
  const api = await createApiInstance();
  const applications = await api.getApplications();
  return { success: true, data: applications };
}

async function getApplication(uuid) {
  const api = await createApiInstance();
  const application = await api.getApplication(uuid);
  return { success: true, data: application };
}

async function startApplication(uuid, appName) {
  const api = await createApiInstance();
  const result = await api.startApplication(uuid);
  showNotification(
    "Application Starting",
    `${appName || "Application"} is starting...`,
    "info",
  );
  monitorDeployment(uuid, appName, "start");
  return { success: true, data: result };
}

async function stopApplication(uuid, appName) {
  const api = await createApiInstance();
  const result = await api.stopApplication(uuid);
  showNotification(
    "Application Stopped",
    `${appName || "Application"} has been stopped.`,
    "info",
  );
  return { success: true, data: result };
}

async function restartApplication(uuid, appName) {
  const api = await createApiInstance();
  const result = await api.restartApplication(uuid);
  showNotification(
    "Application Restarting",
    `${appName || "Application"} is restarting...`,
    "info",
  );
  monitorDeployment(uuid, appName, "restart");
  return { success: true, data: result };
}

async function deployApplication(uuid, appName) {
  const api = await createApiInstance();
  const result = await api.deployApplication(uuid);
  showNotification(
    "Deployment Started",
    `${appName || "Application"} deployment started...`,
    "info",
  );
  monitorDeployment(uuid, appName, "deploy");
  return { success: true, data: result };
}

async function getApplicationLogs(uuid, lines = 100) {
  const api = await createApiInstance();
  const result = await api.getApplicationLogs(uuid, lines);
  return { success: true, data: result };
}

async function getDeployments() {
  const api = await createApiInstance();
  const deployments = await api.getDeployments();
  return { success: true, data: deployments };
}

async function getDeploymentsByApp(uuid, skip = 0, take = 10) {
  const api = await createApiInstance();
  const deployments = await api.getDeploymentsByApp(uuid, skip, take);
  return { success: true, data: deployments };
}

async function getDeployment(uuid) {
  const api = await createApiInstance();
  const deployment = await api.getDeployment(uuid);
  return { success: true, data: deployment };
}

async function cancelDeployment(uuid, appName) {
  const api = await createApiInstance();
  const result = await api.cancelDeployment(uuid);
  showNotification(
    "Deployment Cancelled",
    `${appName || "Deployment"} has been cancelled.`,
    "info",
  );
  return { success: true, data: result };
}

async function setNotificationsEnabled(enabled) {
  await chrome.storage.sync.set({ notificationsEnabled: enabled });
  return { success: true };
}

async function getNotificationsEnabled() {
  const config = await getConfig();
  return { success: true, data: config.notificationsEnabled !== false };
}

async function showNotification(title, message, type = "info") {
  const config = await getConfig();

  if (config.notificationsEnabled === false) {
    return;
  }

  const iconUrl = chrome.runtime.getURL("assets/icon-128.png");

  try {
    await chrome.notifications.create(`coolify-${Date.now()}`, {
      type: "basic",
      iconUrl: iconUrl,
      title: `Coolify: ${title}`,
      message: message,
      priority: type === "error" ? 2 : 1,
    });
  } catch (error) {
    console.error("Failed to show notification:", error);
  }
}

async function monitorDeployment(uuid, appName, actionType) {
  const monitorId = `${uuid}-${Date.now()}`;
  pendingDeployments.set(monitorId, {
    uuid,
    appName,
    actionType,
    startTime: Date.now(),
  });

  let attempts = 0;
  const maxAttempts = 60;
  const checkInterval = 5000;

  const checkStatus = async () => {
    attempts++;

    if (attempts > maxAttempts) {
      pendingDeployments.delete(monitorId);
      showNotification(
        "Deployment Timeout",
        `${appName || "Application"} deployment is taking longer than expected.`,
        "info",
      );
      return;
    }

    try {
      const api = await createApiInstance();
      const app = await api.getApplication(uuid);
      const status = (app.status || "").toLowerCase();

      if (status.includes("running") && status.includes("healthy")) {
        pendingDeployments.delete(monitorId);
        const actionLabel =
          actionType === "deploy"
            ? "Deployment"
            : actionType === "restart"
              ? "Restart"
              : "Start";
        showNotification(
          `${actionLabel} Successful`,
          `${appName || "Application"} is now running and healthy!`,
          "success",
        );
        return;
      }

      if (
        status.includes("exited") ||
        status.includes("failed") ||
        (status.includes("unhealthy") && !status.includes("running"))
      ) {
        pendingDeployments.delete(monitorId);
        const actionLabel =
          actionType === "deploy"
            ? "Deployment"
            : actionType === "restart"
              ? "Restart"
              : "Start";
        showNotification(
          `${actionLabel} Failed`,
          `${appName || "Application"} failed. Status: ${status}`,
          "error",
        );
        return;
      }

      setTimeout(checkStatus, checkInterval);
    } catch (error) {
      console.error("Error monitoring deployment:", error);
      setTimeout(checkStatus, checkInterval);
    }
  };

  setTimeout(checkStatus, checkInterval);
}

console.log("Coolify Manager Service Worker loaded");
