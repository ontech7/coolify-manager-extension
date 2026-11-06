/**
 * Normalizes a raw Coolify status ("running:healthy", "exited:unhealthy") into
 * a known type. Applications, databases and services share the format.
 */
export function getResourceStatus(rawStatus) {
  const status = rawStatus?.toLowerCase() ?? "";

  if (status === "building") return "building";
  if (status.includes("stopped")) return "stopped";
  if (status.includes("exited") && status.includes("unhealthy")) {
    return "exited:unhealthy";
  }
  if (status.includes("exited")) return "stopped";
  // Coolify's aggregate for containers that are partly up, or dead. Before
  // "healthy", which "unhealthy" contains.
  if (status.includes("degraded") || status.includes("unhealthy")) {
    return "running:unhealthy";
  }
  if (status.includes("running") || status.includes("healthy")) {
    return "running:healthy";
  }
  // Also "restarting".
  if (status.includes("starting")) return "starting";

  return "unknown";
}

/** Whether it can be stopped or restarted, rather than started. */
export function isResourceRunning(rawStatus) {
  const status = rawStatus?.toLowerCase() ?? "";
  return ["running", "degraded", "starting"].some((word) => status.includes(word));
}

/**
 * Normalizes a raw deployment status. Coolify reports a completed deployment
 * as "finished", not "success".
 */
export function getDeploymentStatus(rawStatus) {
  const s = rawStatus?.toLowerCase() ?? "";

  if (s === "finished" || s === "success" || s === "completed") return "success";
  if (s === "failed" || s === "error") return "failed";
  if (s.includes("cancel")) return "cancelled";
  if (
    s === "in_progress" ||
    s === "running" ||
    s === "building" ||
    s === "deploying"
  ) {
    return "in_progress";
  }
  if (s === "queued" || s === "pending") return "queued";

  return "unknown";
}

export function isDeploymentActive(rawStatus) {
  const status = getDeploymentStatus(rawStatus);
  return status === "in_progress" || status === "queued";
}

/** At-a-glance counts for a list of resources, for the header summary. */
export function summarizeStatuses(items) {
  const summary = { running: 0, unhealthy: 0, stopped: 0 };

  for (const item of items) {
    const status = getResourceStatus(item.status);
    if (status === "running:healthy") summary.running++;
    else if (status === "running:unhealthy" || status === "exited:unhealthy") {
      summary.unhealthy++;
    } else if (status === "stopped") summary.stopped++;
  }

  return summary;
}
