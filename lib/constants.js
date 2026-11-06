export const AUTO_REFRESH_INTERVAL = 5000; // 5 seconds

/** Faster polling while watching a deployment build live. */
export const LIVE_DEPLOYMENT_REFRESH_INTERVAL = 3000; // 3 seconds

export const LOG_LINES = 500;

/** Time for a Coolify server to start answering a request. */
export const REQUEST_TIMEOUT = 10000; // 10 seconds

/** Time to download a response once it started: logs can be several MB. */
export const RESPONSE_BODY_TIMEOUT = 30000; // 30 seconds

/**
 * How long a resource shows "Starting"/"Stopping" after an action, if Coolify
 * never reports the new state (e.g. the action failed).
 */
export const PENDING_ACTION_TIMEOUT = 120000; // 2 minutes

/**
 * Safety net for "Deploying" when Coolify's deployment list can't be read:
 * builds can be long, so this is much larger than PENDING_ACTION_TIMEOUT.
 */
export const PENDING_DEPLOY_TIMEOUT = 1800000; // 30 minutes

/**
 * Distance from the bottom (px) within which a live log view keeps following
 * new lines. Scrolling further up pauses following so the user can read.
 */
export const SCROLL_FOLLOW_THRESHOLD = 80;

export const HISTORY_PAGE_SIZE = 15;

/**
 * Coolify version that switched state-changing API actions (start/stop/restart/
 * deploy/validate) from GET to POST. Servers >= this version require POST.
 */
export const POST_ACTIONS_MIN_VERSION = "4.2.0";

/**
 * Coolify version that added the rollback, proxy restart and Docker cleanup
 * endpoints. Older servers answer 404 on them.
 */
export const SERVER_ACTIONS_MIN_VERSION = "4.3.0";
