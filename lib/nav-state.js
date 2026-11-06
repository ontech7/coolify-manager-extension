const STORAGE_KEY = "popupNav";

/** Where the popup was, so that reopening it goes back there. */
export async function saveNavState(instanceId, state) {
  await chrome.storage.session.set({
    [STORAGE_KEY]: { instanceId, ...state },
  });
}

/** Null when nothing is saved, or when it belongs to another instance. */
export async function loadNavState(instanceId) {
  const { [STORAGE_KEY]: saved } = await chrome.storage.session.get(STORAGE_KEY);
  if (saved?.instanceId !== instanceId) return null;

  const { instanceId: _instanceId, ...state } = saved;
  return state;
}
