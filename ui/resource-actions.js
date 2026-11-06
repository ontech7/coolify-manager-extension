import { safeExternalUrl, splitFqdn } from "../lib/format.js";
import { isResourceRunning } from "../lib/status.js";

const METHODS = {
  start: {
    application: "startApplication",
    database: "startDatabase",
    service: "startService",
  },
  stop: {
    application: "stopApplication",
    database: "stopDatabase",
    service: "stopService",
  },
  restart: {
    application: "restartApplication",
    database: "restartDatabase",
    service: "restartService",
  },
};

/** The URL the website button opens, or null when there is none safe to open. */
export function resourceSiteUrl(resource) {
  return safeExternalUrl(splitFqdn(resource.fqdn)[0]);
}

/**
 * Which actions a resource offers right now, with the rules of the app's
 * resource-actions.tsx. Coolify still reports the old status while an action is
 * underway: block actions that would queue it again. Stop stays available
 * unless stopping.
 */
export function resourceActionState(resource, { legacy = false, busy = null } = {}) {
  const isApplication = resource.resourceType === "application";
  const isService = resource.resourceType === "service";
  const isRunning = isResourceRunning(resource.status);
  const isPending = resource.pending !== undefined;
  const isStopping = resource.pending?.kind === "stopping";
  const isBusy = busy !== null;

  return {
    deploy: {
      show: isApplication,
      disabled: isBusy || isPending,
      loading: busy === "deploy",
    },
    pull: {
      show: isService,
      disabled: isBusy || isPending,
      loading: busy === "pull",
    },
    restart: {
      show: true,
      disabled: isBusy || !isRunning || isPending,
      loading: busy === "restart",
    },
    startStop: {
      show: true,
      kind: isRunning ? "stop" : "start",
      disabled: isBusy || isStopping || (isPending && !isRunning),
      loading: busy === "start" || busy === "stop",
    },
    logs: {
      show: isApplication || !legacy,
      disabled: isBusy,
      loading: false,
    },
    site: {
      show: isApplication && resourceSiteUrl(resource) !== null,
      disabled: isBusy,
      loading: false,
    },
  };
}

/**
 * Runs a method through the service worker. Failures show in a dialog, once
 * the buttons are back. Resolves with `{ok, data}`.
 */
/** Coolify can skip a deployment, e.g. one is already queued for this commit. */
const QUEUES_DEPLOYMENT = new Set([
  "startApplication",
  "restartApplication",
  "deployApplication",
]);

function skippedMessage(method, data) {
  if (!QUEUES_DEPLOYMENT.has(method)) return null;
  const answer = data?.deployments?.[0] ?? data;
  return answer?.deployment_uuid ? null : answer?.message;
}

async function run(ctx, resource, busy, verb, method, args, options) {
  options.setBusy?.(busy);
  let result;
  try {
    const data = await ctx.actions.run(method, args, {
      label: `${verb} ${resource.name}`,
    });
    await options.afterAction?.();
    result = { ok: true, data };
  } catch (error) {
    result = { ok: false, message: error.message };
  }
  options.setBusy?.(null);

  if (!result.ok) await ctx.dialogs.alert("Error", result.message);
  const skipped = result.ok && skippedMessage(method, result.data);
  if (skipped) ctx.dialogs.toast(skipped);
  return result;
}

async function deploy(ctx, resource, options) {
  const choice = await ctx.dialogs.confirm({
    title: "Deploy Application",
    message: `Deploy "${resource.name}"? Force rebuild skips the build cache.`,
    buttons: [
      { label: "Cancel", kind: "plain" },
      { label: "Force Rebuild", kind: "sec", value: "force" },
      { label: "Deploy", kind: "pri", value: "deploy" },
    ],
  });
  if (!choice) return;

  const { ok, data } = await run(
    ctx,
    resource,
    "deploy",
    "Deploy",
    "deployApplication",
    [resource.uuid, choice === "force"],
    options,
  );
  const deploymentUuid = data?.deployments?.[0]?.deployment_uuid;
  if (!ok || !deploymentUuid) return;

  const watch = await ctx.dialogs.confirm({
    title: "Deployment queued",
    message: `"${resource.name}" is deploying.`,
    buttons: [
      { label: "OK", kind: "plain" },
      { label: "Watch live", kind: "pri", value: true },
    ],
  });
  if (watch) {
    ctx.open({
      screen: "deployment",
      uuid: deploymentUuid,
      appUuid: resource.uuid,
      name: resource.name,
    });
  }
}

async function pull(ctx, resource, options) {
  const confirmed = await ctx.dialogs.confirm({
    title: "Pull Latest Images",
    message: `Pull the latest images and redeploy "${resource.name}"?`,
    buttons: [
      { label: "Cancel", kind: "plain" },
      { label: "Pull", kind: "pri", value: true },
    ],
  });
  if (confirmed) {
    await run(
      ctx,
      resource,
      "pull",
      "Pull latest images of",
      "pullLatestImagesService",
      [resource.uuid],
      options,
    );
  }
}

async function restart(ctx, resource, options) {
  const confirmed = await ctx.dialogs.confirm({
    title: "Restart",
    message: `Are you sure you want to restart "${resource.name}"?`,
    buttons: [
      { label: "Cancel", kind: "plain" },
      { label: "Restart", kind: "pri", value: true },
    ],
  });
  if (confirmed) {
    await run(
      ctx,
      resource,
      "restart",
      "Restart",
      METHODS.restart[resource.resourceType],
      [resource.uuid],
      options,
    );
  }
}

async function startStop(ctx, resource, options) {
  if (!isResourceRunning(resource.status)) {
    await run(
      ctx,
      resource,
      "start",
      "Start",
      METHODS.start[resource.resourceType],
      [resource.uuid],
      options,
    );
    return;
  }

  const confirmed = await ctx.dialogs.confirm({
    title: "Stop",
    message: `Are you sure you want to stop "${resource.name}"?`,
    buttons: [
      { label: "Cancel", kind: "plain" },
      { label: "Stop", kind: "dng", value: true },
    ],
  });
  if (confirmed) {
    await run(
      ctx,
      resource,
      "stop",
      "Stop",
      METHODS.stop[resource.resourceType],
      [resource.uuid],
      options,
    );
  }
}

const PERFORM = { deploy, pull, restart, startStop };

/**
 * `action` is deploy, pull, restart or startStop. `setBusy(name | null)` drives
 * the buttons, `afterAction()` runs after a success, before any next dialog.
 */
export function performResourceAction(ctx, action, resource, options = {}) {
  return PERFORM[action](ctx, resource, options);
}
