"use client";

import { loadRegions, pickHomeRegion } from "./regions";
import { accountRequest, asArray, coreRequest, fetchMe, isTrimbleHttpError } from "./trimble-client";
import type { ConnectUserSummary, OperatorCapability, RegionInfo } from "./types";
import { normalizeRole } from "./types";

export function parseConnectUsers(payload: unknown): ConnectUserSummary[] {
  return asArray<Record<string, unknown>>(payload).flatMap((item) => {
    const nested = item.user;
    const source =
      nested && typeof nested === "object" ? { ...item, ...(nested as Record<string, unknown>) } : item;
    const email = String(source.email ?? source.userEmail ?? source.mail ?? "").trim();
    const id = source.id ?? source.userId ?? source.tiduuid;
    if (!email && typeof id !== "string") return [];
    const roleRaw = source.role ?? source.projectRole ?? source.userRole;
    return [
      {
        id: typeof id === "string" && id ? id : undefined,
        email: email || String(id),
        firstName:
          typeof source.firstName === "string"
            ? source.firstName
            : typeof source.givenName === "string"
              ? source.givenName
              : undefined,
        lastName:
          typeof source.lastName === "string"
            ? source.lastName
            : typeof source.familyName === "string"
              ? source.familyName
              : undefined,
        role: typeof roleRaw === "string" ? roleRaw : undefined,
        status: typeof source.status === "string" ? source.status : undefined,
      },
    ];
  });
}

export function mergeUsers(...lists: ConnectUserSummary[][]): ConnectUserSummary[] {
  const byKey = new Map<string, ConnectUserSummary>();
  for (const list of lists) {
    for (const user of list) {
      const key = (user.email || user.id || "").toLowerCase();
      if (!key) continue;
      const previous = byKey.get(key);
      byKey.set(key, previous ? { ...previous, ...user } : user);
    }
  }
  return [...byKey.values()].sort((a, b) => a.email.localeCompare(b.email));
}

export function extractAccountId(
  me: Record<string, unknown>,
  project?: Record<string, unknown>,
): string | undefined {
  const company = me.company as Record<string, unknown> | undefined;
  const account = me.account as Record<string, unknown> | undefined;
  const accounts = asArray<Record<string, unknown>>(me.accounts);
  const projectAccount = project?.account as Record<string, unknown> | undefined;
  const candidates = [
    me.accountId,
    me.account_id,
    account?.id,
    company?.id,
    accounts[0]?.id,
    project?.accountId,
    projectAccount?.id,
  ];
  return candidates.find((value): value is string => typeof value === "string" && value.length > 0);
}

export async function probeAccountAdmin(
  token: string,
  accountId: string,
): Promise<boolean> {
  try {
    await accountRequest<unknown>(token, { accountId, resource: "project-users" });
    return true;
  } catch (error) {
    if (isTrimbleHttpError(error) && (error.status === 401 || error.status === 403 || error.status === 404)) {
      console.info(
        `[access-mirror] Account API ${error.status} for project-users — falling back to Core project members`,
      );
      return false;
    }
    console.info("[access-mirror] Account Admin probe failed — using Core project members");
    return false;
  }
}

export async function fetchProjectMembers(input: {
  token: string;
  projectId: string;
  location?: string;
}): Promise<{ users: ConnectUserSummary[]; origin: string; coreForbidden: boolean }> {
  const regions = await loadRegions(input.token);
  const home = pickHomeRegion(regions, input.location);
  const origins = uniqueOrigins([home, ...regions]);

  let coreForbidden = false;

  for (const region of origins) {
    try {
      const payload = await coreRequest<unknown>(input.token, {
        origin: region.origin,
        path: `/tc/api/2.0/projects/${input.projectId}/users`,
      });
      const users = parseConnectUsers(payload);
      console.info(
        `[access-mirror] Core GET /projects/${input.projectId}/users via ${region.origin} returned ${users.length} member(s)`,
      );
      return { users, origin: region.origin, coreForbidden: false };
    } catch (error) {
      if (isTrimbleHttpError(error) && error.status === 401) {
        throw error;
      }
      if (isTrimbleHttpError(error) && error.status === 403) {
        coreForbidden = region.origin === home.origin;
        console.info(
          `[access-mirror] Core 403 on ${region.origin} for project ${input.projectId} — ${
            region.origin === home.origin ? "home region" : "trying next region"
          }`,
        );
        continue;
      }
    }
  }

  return { users: [], origin: home.origin, coreForbidden };
}

function uniqueOrigins(regions: RegionInfo[]): RegionInfo[] {
  const seen = new Set<string>();
  return regions.filter((region) => {
    if (seen.has(region.origin)) return false;
    seen.add(region.origin);
    return true;
  });
}

export async function resolveOperatorCapability(input: {
  token: string;
  projectId?: string;
  location?: string;
  operatorEmail?: string;
  members: ConnectUserSummary[];
}): Promise<OperatorCapability> {
  const self = input.operatorEmail
    ? input.members.find((member) => member.email.toLowerCase() === input.operatorEmail!.toLowerCase())
    : undefined;
  const projectLevel: OperatorCapability = self
    ? normalizeRole(self.role) === "ADMIN"
      ? "project-admin"
      : "project-user"
    : "unknown";

  try {
    const me = await fetchMe(input.token);
    let projectDetails: Record<string, unknown> | undefined;
    if (input.projectId) {
      const regions = await loadRegions(input.token);
      const home = pickHomeRegion(regions, input.location);
      try {
        projectDetails = await coreRequest<Record<string, unknown>>(input.token, {
          origin: home.origin,
          path: `/tc/api/2.0/projects/${input.projectId}`,
          query: { fullyLoaded: true },
        });
      } catch {
        projectDetails = undefined;
      }
    }
    const accountId = extractAccountId(me, projectDetails);
    if (accountId && (await probeAccountAdmin(input.token, accountId))) {
      return "account-admin";
    }
  } catch (error) {
    if (isTrimbleHttpError(error) && error.status === 401) {
      throw error;
    }
    console.info(
      `[access-mirror] Account Admin probe skipped (${isTrimbleHttpError(error) ? error.status : "error"}) — using ${projectLevel}`,
    );
  }

  return projectLevel;
}
