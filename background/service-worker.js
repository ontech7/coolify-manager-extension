import { CoolifyAPI } from "../lib/coolify-api.js";

async function getConfig() {
  const result = await chrome.storage.sync.get(["serverUrl", "apiToken"]);
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
  return { success: true, data: result };
}

async function stopApplication(uuid, appName) {
  const api = await createApiInstance();
  const result = await api.stopApplication(uuid);
  return { success: true, data: result };
}

async function restartApplication(uuid, appName) {
  const api = await createApiInstance();
  const result = await api.restartApplication(uuid);
  return { success: true, data: result };
}

async function deployApplication(uuid, appName) {
  const api = await createApiInstance();
  const result = await api.deployApplication(uuid);
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
  return { success: true, data: result };
}

console.log("Coolify Manager Service Worker loaded");
