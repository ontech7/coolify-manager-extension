const MINUTE = 60000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const MESSAGES = [
  "fix: debounce cart updates",
  "feat: add saved filters",
  "chore: bump base image",
  "fix: session cookie on subdomains",
  "feat: export orders as CSV",
  "refactor: split checkout steps",
  "fix: image cache headers",
  "feat: webhook retries",
  "fix: timezone in invoices",
  "chore: update dependencies",
];

/** Stable, 40 character hex commit for a deployment index. */
function shaFor(seed, index) {
  let hash = 0;
  for (const char of `${seed}${index}`) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0").repeat(5).slice(0, 40);
}

const iso = (time) => new Date(time).toISOString();

/** Log lines of a build, as Coolify stores them. */
export function buildScript(name, { restart, rollback, force, commit } = {}) {
  if (restart) {
    return [
      `Restarting ${name} on prod-eu-1.`,
      "Restart only: the build is skipped.",
      "Stopping the old container.",
      "New container started.",
      "Waiting for the health check to pass.",
      "Health check passed.",
      "Restart completed.",
    ];
  }

  const lines = [
    `Starting deployment of acme/${name}:main to prod-eu-1.`,
    "Preparing container with helper image ghcr.io/coollabsio/coolify-helper:latest.",
    rollback
      ? `Rolling back to image ${rollback.slice(0, 7)}. The build is skipped.`
      : `Importing acme/${name}:main (commit ${String(commit).slice(0, 7)}).`,
  ];

  if (!rollback) {
    lines.push(
      force
        ? "Force rebuild: the build cache is ignored."
        : "Using the Docker build cache.",
      "Building the image.",
    );
    for (let step = 1; step <= 11; step++) {
      lines.push(`#${step} [${step}/11] build step`, `#${step} DONE 0.${step}s`);
    }
    lines.push("Image built.");
  }

  lines.push(
    "Rolling update started.",
    "New container started.",
    "Waiting for the health check to pass on the new container.",
    "Attempt 1 of 10: starting.",
    "Attempt 2 of 10: healthy.",
    "Health check passed.",
    "Removing the old container.",
    "Rolling update completed.",
  );

  return lines;
}

/** A finished build log long enough to be cut at 500 lines. */
function longLog(name, commit) {
  const lines = buildScript(name, { commit });
  for (let layer = 0; layer < 620; layer++) {
    lines.splice(5, 0, `#${620 - layer} sha256:${"0".repeat(32)} done`);
  }
  return lines;
}

function deploymentRecord(fields) {
  return {
    server_name: "prod-eu-1",
    git_type: "github",
    is_webhook: false,
    is_api: true,
    force_rebuild: false,
    restart_only: false,
    commit_message: null,
    ...fields,
  };
}

export function createFixtures(now = Date.now()) {
  const applications = [
    {
      uuid: "a-admin",
      name: "admin-panel",
      type: "application",
      status: "running:unhealthy",
      build_pack: "dockerfile",
      fqdn: "https://admin.example.com",
      git_repository: "acme/admin-panel",
      git_branch: "main",
      created_at: iso(now - 90 * DAY),
      updated_at: iso(now - 3 * HOUR),
    },
    {
      uuid: "a-api",
      name: "api-gateway",
      type: "application",
      status: "exited:unhealthy",
      build_pack: "dockerfile",
      fqdn: "https://api.example.com",
      git_repository: "acme/api-gateway",
      git_branch: "release",
      created_at: iso(now - 200 * DAY),
      updated_at: iso(now - 2 * DAY),
    },
    {
      uuid: "a-store",
      name: "storefront-web",
      type: "application",
      status: "running:healthy",
      build_pack: "nixpacks",
      fqdn: "https://shop.example.com,https://www.shop.example.com",
      git_repository: "acme/storefront-web",
      git_branch: "main",
      created_at: iso(now - 120 * DAY),
      updated_at: iso(now - 2 * HOUR),
    },
  ];

  const databases = [
    {
      uuid: "d-maria",
      name: "mariadb-legacy",
      status: "stopped",
      description: "Old CMS data",
      image: "mariadb:11",
      database_type: "standalone-mariadb",
      is_public: false,
      public_port: null,
      internal_db_url: null,
      external_db_url: null,
      created_at: iso(now - 400 * DAY),
      updated_at: iso(now - 40 * DAY),
    },
    {
      uuid: "d-pg",
      name: "postgres-main",
      status: "running:healthy",
      description: "Primary database",
      image: "postgres:16-alpine",
      database_type: "standalone-postgresql",
      is_public: true,
      public_port: 5433,
      internal_db_url: "postgres://app:s3cr3t-pass@postgres-main:5432/app",
      external_db_url: "postgres://app:s3cr3t-pass@203.0.113.10:5433/app",
      created_at: iso(now - 300 * DAY),
      updated_at: iso(now - 6 * HOUR),
    },
    {
      uuid: "d-redis",
      name: "redis-cache",
      status: "running:healthy",
      description: null,
      image: "redis:7.2",
      database_type: "standalone-redis",
      is_public: false,
      public_port: null,
      internal_db_url: "redis://default:r3dis-pass@redis-cache:6379/0",
      external_db_url: null,
      created_at: iso(now - 250 * DAY),
      updated_at: iso(now - 12 * HOUR),
    },
  ];

  const services = [
    {
      uuid: "s-minio",
      name: "media-bucket",
      status: "stopped",
      description: "Object storage",
      service_type: "minio",
      created_at: iso(now - 160 * DAY),
      updated_at: iso(now - 9 * DAY),
      applications: [
        {
          uuid: "c-minio",
          name: "minio",
          human_name: "MinIO",
          status: "exited",
          image: "minio/minio:latest",
          fqdn: "https://media.example.com",
        },
      ],
      databases: [],
    },
    {
      uuid: "s-n8n",
      name: "n8n-workflows",
      status: "running:healthy",
      description: "Automations",
      service_type: "n8n",
      created_at: iso(now - 70 * DAY),
      updated_at: iso(now - 5 * HOUR),
      applications: [
        {
          uuid: "c-n8n",
          name: "n8n",
          human_name: "n8n",
          status: "running:healthy",
          image: "n8nio/n8n:1.62",
          fqdn: "https://n8n.example.com",
        },
      ],
      databases: [
        {
          uuid: "c-n8n-db",
          name: "postgresql",
          human_name: "PostgreSQL",
          status: "running:healthy",
          image: "postgres:16-alpine",
        },
      ],
    },
    {
      uuid: "s-plausible",
      name: "plausible",
      status: "running:healthy",
      description: "Web analytics",
      service_type: "plausible",
      created_at: iso(now - 50 * DAY),
      updated_at: iso(now - DAY),
      applications: [
        {
          uuid: "c-pl",
          name: "plausible",
          human_name: "Plausible",
          status: "running:healthy",
          image: "plausible/analytics:v2",
          fqdn: "https://stats.example.com",
        },
      ],
      databases: [
        {
          uuid: "c-pl-ch",
          name: "clickhouse",
          human_name: "ClickHouse",
          status: "running:healthy",
          image: "clickhouse/clickhouse-server:24",
        },
        {
          uuid: "c-pl-db",
          name: "postgresql",
          human_name: "PostgreSQL",
          status: "running:healthy",
          image: "postgres:16-alpine",
        },
      ],
    },
  ];

  const servers = [
    {
      uuid: "srv-build",
      name: "build-runner",
      description: "Build server",
      ip: "203.0.113.24",
      port: 22,
      user: "root",
      settings: { is_reachable: true, is_usable: true, is_build_server: true },
    },
    {
      uuid: "srv-lab",
      name: "lab-nas",
      description: "Home lab",
      ip: "192.168.1.40",
      port: 22,
      user: "admin",
      settings: { is_reachable: false, is_usable: false },
    },
    {
      uuid: "srv-prod",
      name: "prod-eu-1",
      description: "Main node",
      ip: "203.0.113.10",
      port: 22,
      user: "root",
      settings: { is_reachable: true, is_usable: true },
    },
  ];

  const backups = {
    "d-pg": [
      {
        uuid: "b-daily",
        frequency: "0 3 * * *",
        enabled: true,
        save_s3: true,
        executions: [
          {
            uuid: "e-1",
            status: "success",
            size: 482344960,
            created_at: iso(now - 9 * HOUR),
          },
        ],
      },
      {
        uuid: "b-weekly",
        frequency: "weekly",
        enabled: true,
        save_s3: false,
        executions: [
          {
            uuid: "e-2",
            status: "failed",
            message: "Disk full",
            size: null,
            created_at: iso(now - 3 * DAY),
          },
        ],
      },
      { uuid: "b-new", frequency: "daily", enabled: false, save_s3: false },
    ],
  };

  const deployments = [];
  const rollbackImages = {};

  const history = [
    ["a-store", "storefront-web", 23],
    ["a-admin", "admin-panel", 6],
    ["a-api", "api-gateway", 4],
  ];
  for (const [appUuid, name, count] of history) {
    const images = [];
    for (let index = 0; index < count; index++) {
      const commit = shaFor(appUuid, index);
      const status =
        index % 7 === 3 ? "failed" : index % 11 === 5 ? "cancelled" : "finished";
      const createdAt = now - (index + 1) * 7 * HOUR;
      deployments.push(
        deploymentRecord({
          deployment_uuid: `dep-${appUuid}-${index}`,
          application_uuid: appUuid,
          application_name: name,
          status,
          commit,
          commit_message: MESSAGES[index % MESSAGES.length],
          is_webhook: index % 2 === 0,
          is_api: index % 2 !== 0,
          created_at: iso(createdAt),
          updated_at: iso(createdAt + 3 * MINUTE),
          lines: index === 0 ? longLog(name, commit) : buildScript(name, { commit }),
          script: [],
        }),
      );
      if (status === "finished" && images.length < 5) {
        images.push({
          tag: commit,
          created_at: new Date(createdAt)
            .toISOString()
            .replace("T", " ")
            .replace(/\.\d+Z$/, " +0000 UTC"),
          is_current: images.length === 0,
        });
      }
    }
    rollbackImages[appUuid] = images;
  }

  // One build already running, so the Deployments tab isn't empty.
  const liveCommit = shaFor("live", 0);
  const liveScript = buildScript("admin-panel", { commit: liveCommit });
  deployments.unshift(
    deploymentRecord({
      deployment_uuid: "dep-live-admin",
      application_uuid: "a-admin",
      application_name: "admin-panel",
      status: "in_progress",
      commit: liveCommit,
      commit_message: "feat: audit log page",
      is_webhook: true,
      is_api: false,
      created_at: iso(now - 2 * MINUTE),
      updated_at: iso(now),
      lines: liveScript.splice(0, 9),
      script: liveScript,
    }),
  );

  return {
    applications,
    databases,
    services,
    servers,
    backups,
    deployments,
    rollbackImages,
  };
}
