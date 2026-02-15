import {
  addInstance,
  getConfig,
  removeInstance,
  switchActiveInstance,
  updateInstance,
} from "../lib/config-storage.js";

const form = document.getElementById("config-form");
const formTitle = document.getElementById("form-title");
const instanceNameInput = document.getElementById("instance-name");
const serverUrlInput = document.getElementById("server-url");
const apiTokenInput = document.getElementById("api-token");
const toggleTokenBtn = document.getElementById("toggle-token");
const testConnectionBtn = document.getElementById("test-connection");
const closeFormBtn = document.getElementById("close-form");
const addInstanceBtn = document.getElementById("add-instance-btn");
const instancesList = document.getElementById("instances-list");
const statusMessage = document.getElementById("status-message");
const versionEl = document.getElementById("version");
const saveBtn = form.querySelector('button[type="submit"]');

const iconEye = toggleTokenBtn.querySelector(".icon-eye");
const iconEyeOff = toggleTokenBtn.querySelector(".icon-eye-off");

let config = { instances: [], activeInstanceId: null };
let formMode = "idle"; // "idle" | "add" | "edit"
let editingInstanceId = null;
let isSaving = false;
let isTesting = false;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function showStatus(message, type = "info") {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
}

function hideStatus() {
  statusMessage.textContent = "";
  statusMessage.className = "status-message hidden";
}

function resetTokenVisibility() {
  apiTokenInput.type = "password";
  iconEye.classList.remove("hidden");
  iconEyeOff.classList.add("hidden");
}

function getActiveInstanceFromConfig() {
  return (
    config.instances.find(
      (instance) => instance.id === config.activeInstanceId,
    ) ?? null
  );
}

function createInstanceCard(instance) {
  const isActive = instance.id === config.activeInstanceId;

  return `
    <div class="instance-card ${isActive ? "active" : ""}" data-id="${instance.id}">
      <div class="instance-card-header">
        <div class="instance-title-row">
          <span class="instance-name">${escapeHtml(instance.name)}</span>
          ${isActive ? '<span class="instance-badge">Active</span>' : ""}
        </div>
        <div class="instance-url">${escapeHtml(instance.serverUrl)}</div>
      </div>
      <div class="instance-actions">
        ${
          isActive
            ? ""
            : '<button type="button" class="instance-action" data-action="activate">Set Active</button>'
        }
        <button type="button" class="instance-action" data-action="edit">Edit</button>
        <button type="button" class="instance-action danger" data-action="delete">Delete</button>
      </div>
    </div>
  `;
}

function renderInstances() {
  if (!instancesList) {
    return;
  }

  const isEmpty = config.instances.length === 0;
  instancesList.classList.toggle("empty", isEmpty);

  if (isEmpty) {
    instancesList.innerHTML = "";
    return;
  }

  instancesList.innerHTML = config.instances
    .map((instance) => createInstanceCard(instance))
    .join("");
}

function setFormMode(newMode, instance) {
  formMode = newMode;
  hideStatus();
  form.reset();
  resetTokenVisibility();

  if (formMode === "edit" && instance) {
    editingInstanceId = instance.id;
    formTitle.textContent = "Edit Instance";
    instanceNameInput.value = instance.name;
    serverUrlInput.value = instance.serverUrl;
    apiTokenInput.value = instance.apiToken;
    closeFormBtn.classList.remove("hidden");
  } else if (formMode === "add") {
    editingInstanceId = null;
    formTitle.textContent = "Add Instance";
    // Mostra il bottone X solo se ci sono istanze (altrimenti non può chiudere)
    closeFormBtn.classList.toggle("hidden", config.instances.length === 0);
  } else {
    // idle mode
    editingInstanceId = null;
    formTitle.textContent = "Add Instance";
    closeFormBtn.classList.add("hidden");
  }

  updateUI();
}

function updateUI() {
  const isFormOpen = formMode !== "idle";
  const hasInstances = config.instances.length > 0;

  // Mostra/nascondi sezione istanze
  const instancesSection = document.querySelector(".instances-section");
  if (instancesSection) {
    instancesSection.classList.toggle("hidden", isFormOpen);
  }

  // Mostra/nascondi form
  form.classList.toggle("hidden", !isFormOpen && hasInstances);
}

async function refreshConfig() {
  config = await getConfig();
  renderInstances();
  
  // Se non ci sono istanze, mostra la form in modalità add
  if (config.instances.length === 0 && formMode === "idle") {
    setFormMode("add");
  }
}

function validateInstanceName(name) {
  return name.trim() ? null : "Instance name is required";
}

function validateServerUrl(url) {
  if (!url.trim()) {
    return "Server URL is required";
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "Server URL must start with http:// or https://";
    }
  } catch (error) {
    return "Please enter a valid URL (e.g.: https://coolify.example.com)";
  }

  return null;
}

function validateApiToken(token) {
  const trimmed = token.trim();
  if (!trimmed) {
    return "API token is required";
  }

  if (trimmed.length < 10) {
    return "API token seems too short";
  }

  return null;
}

async function handleSubmit(event) {
  event.preventDefault();

  if (isSaving) {
    return;
  }

  const name = instanceNameInput.value.trim();
  const serverUrl = serverUrlInput.value.trim();
  const apiToken = apiTokenInput.value.trim();

  const nameError = validateInstanceName(name);
  if (nameError) {
    showStatus(nameError, "error");
    return;
  }

  const urlError = validateServerUrl(serverUrl);
  if (urlError) {
    showStatus(urlError, "error");
    return;
  }

  const tokenError = validateApiToken(apiToken);
  if (tokenError) {
    showStatus(tokenError, "error");
    return;
  }

  isSaving = true;
  saveBtn.disabled = true;

  try {
    if (formMode === "edit" && editingInstanceId) {
      await updateInstance({
        id: editingInstanceId,
        name,
        serverUrl,
        apiToken,
      });

      await refreshConfig();
      setFormMode("idle");
      showStatus("Instance updated successfully!", "success");
    } else {
      await addInstance({ name, serverUrl, apiToken });

      await refreshConfig();
      setFormMode("idle");
      showStatus("Instance added successfully!", "success");
    }
  } catch (error) {
    showStatus(`Save error: ${error.message}`, "error");
  } finally {
    isSaving = false;
    saveBtn.disabled = false;
  }
}

function handleAddInstance() {
  setFormMode("add");
  instanceNameInput.focus();
}

function handleCloseForm() {
  setFormMode("idle");
}

async function handleActivateInstance(instance) {
  try {
    await switchActiveInstance(instance.id);
    await refreshConfig();
    showStatus(`"${instance.name}" is now active.`, "success");
  } catch (error) {
    showStatus(`Activate error: ${error.message}`, "error");
  }
}

function handleEditInstance(instance) {
  setFormMode("edit", instance);
}

async function handleDeleteInstance(instance) {
  const confirmed = window.confirm(`Delete "${instance.name}"?`);
  if (!confirmed) {
    return;
  }

  try {
    await removeInstance(instance.id);
    await refreshConfig();

    // Se stiamo modificando questa istanza, chiudi la form
    if (formMode === "edit" && editingInstanceId === instance.id) {
      setFormMode("idle");
    }

    showStatus("Instance deleted.", "success");
  } catch (error) {
    showStatus(`Delete error: ${error.message}`, "error");
  }
}

async function handleInstancesListClick(event) {
  const button = event.target.closest(".instance-action");
  if (!button) {
    return;
  }

  const card = button.closest(".instance-card");
  if (!card) {
    return;
  }

  const instance = config.instances.find((item) => item.id === card.dataset.id);
  if (!instance) {
    return;
  }

  const action = button.dataset.action;

  if (action === "activate") {
    await handleActivateInstance(instance);
  } else if (action === "edit") {
    handleEditInstance(instance);
  } else if (action === "delete") {
    await handleDeleteInstance(instance);
  }
}

async function testConnection() {
  if (isTesting) {
    return;
  }

  const serverUrl = serverUrlInput.value.trim();
  const apiToken = apiTokenInput.value.trim();

  const urlError = validateServerUrl(serverUrl);
  if (urlError) {
    showStatus(urlError, "error");
    return;
  }

  const tokenError = validateApiToken(apiToken);
  if (tokenError) {
    showStatus(tokenError, "error");
    return;
  }

  isTesting = true;
  testConnectionBtn.disabled = true;
  testConnectionBtn.innerHTML = `
    <svg class="icon spinning" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 12a9 9 0 11-6.219-8.56"/>
    </svg>
    Testing...
  `;
  showStatus("Verifying connection...", "info");

  try {
    const response = await chrome.runtime.sendMessage({
      action: "testConnection",
      data: { serverUrl, apiToken },
    });

    if (response.success) {
      showStatus("Connection successful!", "success");
    } else {
      showStatus(`Error: ${response.error}`, "error");
    }
  } catch (error) {
    showStatus(`Error: ${error.message}`, "error");
  } finally {
    isTesting = false;
    testConnectionBtn.disabled = false;
    testConnectionBtn.innerHTML = `
      <svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="m9 12 2 2 4-4" />
      </svg>
      Test Connection
    `;
  }
}

function toggleTokenVisibility() {
  const isPassword = apiTokenInput.type === "password";
  apiTokenInput.type = isPassword ? "text" : "password";
  iconEye.classList.toggle("hidden", !isPassword);
  iconEyeOff.classList.toggle("hidden", isPassword);
}

async function init() {
  const manifest = chrome.runtime.getManifest();
  versionEl.textContent = `v${manifest.version}`;

  await refreshConfig();

  // Se ci sono istanze, inizia in modalità idle
  // Altrimenti la form si aprirà automaticamente in modalità add
  if (config.instances.length > 0) {
    setFormMode("idle");
  } else {
    setFormMode("add");
  }
}

form.addEventListener("submit", handleSubmit);
testConnectionBtn.addEventListener("click", testConnection);
toggleTokenBtn.addEventListener("click", toggleTokenVisibility);
addInstanceBtn.addEventListener("click", handleAddInstance);
closeFormBtn.addEventListener("click", handleCloseForm);
instancesList.addEventListener("click", handleInstancesListClick);

init();
