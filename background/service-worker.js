import { getActiveInstance } from "../lib/config-storage.js";
import { CoolifyAPI } from "../lib/coolify-api.js";

async function createApiInstance() {
  const instance = await getActiveInstance();

  if (!instance) {
    throw new Error(
      "Configuration missing. Go to options to add a Coolify instance.",
    );
  }

  return new CoolifyAPI(instance.serverUrl, instance.apiToken);
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

    case "getDatabases":
      return await getDatabases();

    case "startDatabase":
      return await runResourceAction("startDatabase", data.uuid);

    case "stopDatabase":
      return await runResourceAction("stopDatabase", data.uuid);

    case "restartDatabase":
      return await runResourceAction("restartDatabase", data.uuid);

    case "getServices":
      return await getServices();

    case "startService":
      return await runResourceAction("startService", data.uuid);

    case "stopService":
      return await runResourceAction("stopService", data.uuid);

    case "restartService":
      return await runResourceAction("restartService", data.uuid);

    case "getServers":
      return await getServers();

    case "getServer":
      return await getServer(data.uuid);

    case "getServerResources":
      return await getServerResources(data.uuid);

    case "validateServer":
      return await runResourceAction("validateServer", data.uuid);

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

async function getDatabases() {
  const api = await createApiInstance();
  const databases = await api.getDatabases();
  return { success: true, data: databases };
}

async function getServices() {
  const api = await createApiInstance();
  const services = await api.getServices();
  return { success: true, data: services };
}

async function getServers() {
  const api = await createApiInstance();
  const servers = await api.getServers();
  return { success: true, data: servers };
}

async function getServer(uuid) {
  const api = await createApiInstance();
  const server = await api.getServer(uuid);
  return { success: true, data: server };
}

async function getServerResources(uuid) {
  const api = await createApiInstance();
  const resources = await api.getServerResources(uuid);
  return { success: true, data: resources };
}

// Generic dispatcher for start/stop/restart/validate across resource types.
async function runResourceAction(method, uuid) {
  const api = await createApiInstance();
  const result = await api[method](uuid);
  return { success: true, data: result };
}

console.log("Coolify Manager Service Worker loaded");
