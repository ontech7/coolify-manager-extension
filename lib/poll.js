/**
 * Calls `refresh` every `interval` ms while the page is visible. The next tick
 * is scheduled only after the previous request finishes, so a slow server
 * doesn't pile up requests. When the page shows again it refreshes right away
 * instead of showing stale data until the next tick. `refresh` should handle
 * its own errors; a rejection is swallowed so polling keeps going.
 */
export function createPoller({
  refresh,
  interval,
  isEnabled = () => true,
  doc = document,
}) {
  let running = false;
  let inFlight = false;
  let timer = null;

  function clearTimer() {
    clearTimeout(timer);
    timer = null;
  }

  function schedule() {
    clearTimer();
    if (running && !doc.hidden) {
      timer = setTimeout(tick, interval);
    }
  }

  async function tick() {
    if (isEnabled()) {
      inFlight = true;
      try {
        await refresh();
      } catch {
        // The caller surfaces errors; keep polling.
      } finally {
        inFlight = false;
      }
    }
    schedule();
  }

  function handleVisibility() {
    clearTimer();
    // A refresh in flight already schedules the next tick when it ends.
    if (running && !doc.hidden && !inFlight) {
      tick();
    }
  }

  return {
    start() {
      if (running) return;
      running = true;
      doc.addEventListener("visibilitychange", handleVisibility);
      schedule();
    },
    stop() {
      running = false;
      clearTimer();
      doc.removeEventListener("visibilitychange", handleVisibility);
    },
  };
}
