const form = document.getElementById("config-form");
const serverUrlInput = document.getElementById("server-url");
const apiTokenInput = document.getElementById("api-token");
const toggleTokenBtn = document.getElementById("toggle-token");
const testConnectionBtn = document.getElementById("test-connection");
const statusMessage = document.getElementById("status-message");

const iconEye = toggleTokenBtn.querySelector(".icon-eye");
const iconEyeOff = toggleTokenBtn.querySelector(".icon-eye-off");

function showStatus(message, type = "info") {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
}

function hideStatus() {
  statusMessage.className = "status-message hidden";
}

async function loadConfig() {
  const config = await chrome.storage.sync.get(["serverUrl", "apiToken"]);

  if (config.serverUrl) {
    serverUrlInput.value = config.serverUrl;
  }

  if (config.apiToken) {
    apiTokenInput.value = config.apiToken;
  }
}

async function saveConfig(serverUrl, apiToken) {
  await chrome.storage.sync.set({
    serverUrl: serverUrl.replace(/\/$/, ""),
    apiToken,
  });
}

async function testConnection() {
  const serverUrl = serverUrlInput.value.trim();
  const apiToken = apiTokenInput.value.trim();

  if (!serverUrl || !apiToken) {
    showStatus("Please enter URL and API Token", "error");
    return;
  }

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
    testConnectionBtn.disabled = false;
    testConnectionBtn.innerHTML = `
      <svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
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

async function handleSubmit(e) {
  e.preventDefault();

  const serverUrl = serverUrlInput.value.trim();
  const apiToken = apiTokenInput.value.trim();

  if (!serverUrl || !apiToken) {
    showStatus("Please fill in all fields", "error");
    return;
  }

  try {
    await saveConfig(serverUrl, apiToken);
    showStatus("Configuration saved successfully!", "success");
  } catch (error) {
    showStatus(`Save error: ${error.message}`, "error");
  }
}

form.addEventListener("submit", handleSubmit);
testConnectionBtn.addEventListener("click", testConnection);
toggleTokenBtn.addEventListener("click", toggleTokenVisibility);

loadConfig();
