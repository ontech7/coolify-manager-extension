import { handleRunAction } from "../lib/action-runner.js";

// State-changing actions run here: a page can close at any moment, and with it
// a request in flight and its answer.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "run-action") return false;

  handleRunAction(message).then(sendResponse);
  return true;
});
