const nameOf = (item) => item.name ?? item.uuid ?? "";

const base = (item, resourceType) => ({
  uuid: item.uuid,
  name: nameOf(item),
  status: item.status,
  resourceType,
});

/**
 * One view over applications, databases and services, sorted by name. A list
 * that failed to load is null: the others still show.
 */
export function mergeResources(apps, dbs, svcs) {
  const merged = [
    ...(apps ?? []).map((app) => ({
      ...base(app, "application"),
      subtitle: app.build_pack || app.type,
      fqdn: app.fqdn,
    })),
    ...(dbs ?? []).map((db) => ({
      ...base(db, "database"),
      subtitle: db.image || "Database",
    })),
    ...(svcs ?? []).map((svc) => ({
      ...base(svc, "service"),
      subtitle: svc.service_type || "Service",
    })),
  ];

  return merged.sort((a, b) => a.name.localeCompare(b.name));
}
