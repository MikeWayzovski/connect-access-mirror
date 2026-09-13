import { MASTER_ORIGIN } from "./allowed-hosts";
import { asArray, coreRequest, fetchRegions } from "./trimble-client";
import type { RegionInfo } from "./types";

function normalizeRegion(raw: Record<string, unknown>): RegionInfo | null {
  const origin =
    (typeof raw.origin === "string" && raw.origin) ||
    (typeof raw.tcApi === "string" && new URL(raw.tcApi).origin) ||
    (typeof raw.url === "string" && raw.url);
  if (!origin) return null;
  return {
    origin: origin.replace(/\/$/, ""),
    location: typeof raw.location === "string" ? raw.location : undefined,
    tcApi: typeof raw.tcApi === "string" ? raw.tcApi : undefined,
    projectsApi: typeof raw.projectsApi === "string" ? raw.projectsApi : undefined,
    isMaster: Boolean(raw.isMaster) || origin === MASTER_ORIGIN,
  };
}

export async function loadRegions(token: string): Promise<RegionInfo[]> {
  try {
    const payload = await fetchRegions(token);
    const rawList = Array.isArray(payload.regions)
      ? payload.regions
      : asArray<unknown>(payload);
    const regions = rawList
      .map((item) => normalizeRegion(item as unknown as Record<string, unknown>))
      .filter((item): item is RegionInfo => Boolean(item));
    if (regions.length) return uniqueOrigins(regions);
  } catch {
    // Fall through to a Core GET in case the dedicated route shape differs.
  }

  try {
    const payload = await coreRequest<unknown>(token, {
      origin: MASTER_ORIGIN,
      path: "/tc/api/2.0/regions",
    });
    const regions = asArray<Record<string, unknown>>(payload)
      .map((item) => normalizeRegion(item))
      .filter((item): item is RegionInfo => Boolean(item));
    if (regions.length) return uniqueOrigins(regions);
  } catch {
    // Ignore and return the master region.
  }

  return [{ origin: MASTER_ORIGIN, isMaster: true, location: "North America" }];
}

function uniqueOrigins(regions: RegionInfo[]): RegionInfo[] {
  const seen = new Set<string>();
  return regions.filter((region) => {
    if (seen.has(region.origin)) return false;
    seen.add(region.origin);
    return true;
  });
}

export function pickHomeRegion(
  regions: RegionInfo[],
  location?: string,
): RegionInfo {
  if (location) {
    const match = regions.find(
      (region) =>
        region.location?.toLowerCase() === location.toLowerCase() ||
        region.origin.toLowerCase().includes(location.toLowerCase()),
    );
    if (match) return match;
  }
  return regions.find((region) => region.isMaster) ?? regions[0];
}
