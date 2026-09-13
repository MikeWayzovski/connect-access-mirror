"use client";

import { useCallback, useMemo, useState } from "react";
import { loadRegions, pickHomeRegion } from "@/lib/regions";
import {
  accountRequest,
  asArray,
  coreRequest,
  fetchMe,
  updateUsers,
} from "@/lib/trimble-client";
import type {
  ConnectUserSummary,
  MirrorMode,
  PreviewAction,
  PreviewRow,
  ProjectRole,
  ProjectSummary,
  RegionInfo,
} from "@/lib/types";
import { normalizeRole } from "@/lib/types";

type HttpError = Error & { status?: number };

function isHttpError(error: unknown): error is HttpError {
  return error instanceof Error;
}

function emailOf(value: Record<string, unknown>): string {
  return String(value.email ?? value.userEmail ?? "").trim();
}

function idOf(value: Record<string, unknown>): string | undefined {
  const id = value.id ?? value.userId ?? value.tiduuid;
  return typeof id === "string" && id ? id : undefined;
}

function toUser(value: Record<string, unknown>): ConnectUserSummary | null {
  const email = emailOf(value);
  if (!email && !idOf(value)) return null;
  return {
    id: idOf(value),
    email: email || String(idOf(value)),
    firstName: typeof value.firstName === "string" ? value.firstName : undefined,
    lastName: typeof value.lastName === "string" ? value.lastName : undefined,
    role: typeof value.role === "string" ? value.role : undefined,
    status: typeof value.status === "string" ? value.status : undefined,
  };
}

function usersMatch(a: ConnectUserSummary, b: Record<string, unknown> | ConnectUserSummary): boolean {
  const other = "email" in b && typeof (b as ConnectUserSummary).email === "string"
    ? (b as ConnectUserSummary)
    : toUser(b as Record<string, unknown>);
  if (!other) return false;
  if (a.id && other.id && a.id === other.id) return true;
  return Boolean(a.email && other.email && a.email.toLowerCase() === other.email.toLowerCase());
}

function extractAccountId(
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

async function mapPool<T, R>(items: T[], limit: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await mapper(items[index]);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function parseProjects(payload: unknown, regionOrigin: string): ProjectSummary[] {
  return asArray<Record<string, unknown>>(payload).flatMap((item) => {
    const id = String(item.id ?? item.projectId ?? "");
    if (!id) return [];
    return [
      {
        id,
        name: String(item.name ?? item.projectName ?? id),
        regionOrigin,
        location: typeof item.location === "string" ? item.location : undefined,
      },
    ];
  });
}

function parseAccountUserProjects(payload: unknown): Array<{ id: string; name: string; role: ProjectRole }> {
  const root = (payload ?? {}) as Record<string, unknown>;
  const projects = Array.isArray(root.projects) ? root.projects : payload;
  const list = asArray<Record<string, unknown>>(projects);
  return list.flatMap((item) => {
    const id = String(item.id ?? item.projectId ?? "");
    if (!id) return [];
    return [
      {
        id,
        name: String(item.name ?? item.projectName ?? id),
        role: normalizeRole(typeof item.role === "string" ? item.role : undefined),
      },
    ];
  });
}

function chunk<T>(items: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let i = 0; i < items.length; i += size) groups.push(items.slice(i, i + size));
  return groups;
}

export function useMirrorFlow(options: {
  token: string | null;
  currentProjectId?: string;
  currentProjectLocation?: string;
  operatorEmail?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<MirrorMode | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [applyLog, setApplyLog] = useState<string[]>([]);

  const reset = useCallback(() => {
    setRows([]);
    setMode(null);
    setMessage(null);
    setApplyLog([]);
  }, []);

  const preview = useCallback(
    async (source: ConnectUserSummary, target: ConnectUserSummary) => {
      if (!options.token) {
        setMessage("Grant the access token before previewing.");
        return;
      }
      setBusy(true);
      setMessage(null);
      setApplyLog([]);
      try {
        const token = options.token;
        const me = await fetchMe(token);
        const regions = await loadRegions(token);
        const home = pickHomeRegion(regions, options.currentProjectLocation);

        let projectDetails: Record<string, unknown> | undefined;
        if (options.currentProjectId) {
          try {
            projectDetails = await coreRequest<Record<string, unknown>>(token, {
              origin: home.origin,
              path: `/tc/api/2.0/projects/${options.currentProjectId}`,
              query: { fullyLoaded: true },
            });
          } catch {
            projectDetails = undefined;
          }
        }

        const accountId = extractAccountId(me, projectDetails);
        const accountRows = accountId
          ? await tryAccountPreview(token, accountId, source, target, regions, home.origin)
          : null;

        if (accountRows) {
          setMode("account");
          setRows(accountRows);
          setMessage(
            `Account admin path: ${accountRows.filter((row) => row.action === "add").length} project(s) to update.`,
          );
          return;
        }

        const operatorRows = await operatorPreview(
          token,
          regions,
          source,
          target,
          options.operatorEmail,
        );
        setMode("operator");
        setRows(operatorRows);
        setMessage(
          `Operator-visible path: ${operatorRows.filter((row) => row.action === "add").length} project(s) to update.`,
        );
      } catch (error) {
        setRows([]);
        setMode(null);
        setMessage(error instanceof Error ? error.message : "Preview failed.");
      } finally {
        setBusy(false);
      }
    },
    [options.currentProjectId, options.currentProjectLocation, options.operatorEmail, options.token],
  );

  const apply = useCallback(
    async (target: ConnectUserSummary) => {
      if (!options.token) return;
      const pending = rows.filter((row) => row.action === "add");
      if (!pending.length) {
        setMessage("Nothing to apply.");
        return;
      }
      setBusy(true);
      const log: string[] = [];
      try {
        if (mode === "account") {
          const batches = chunk(pending, 30);
          for (const batch of batches) {
            try {
              await updateUsers(
                options.token,
                batch.map((row) => ({
                  projectId: row.projectId,
                  updates: [{ action: "add", email: target.email, role: row.sourceRole }],
                })),
              );
              log.push(`Account batch OK (${batch.length} project(s)).`);
            } catch (error) {
              log.push(
                `Account batch failed (${isHttpError(error) ? error.message : "error"}). Falling back per project.`,
              );
              for (const row of batch) {
                log.push(await inviteOne(options.token, row, target));
              }
            }
          }
        } else {
          for (const row of pending) {
            log.push(await inviteOne(options.token, row, target));
          }
        }
        setApplyLog(log);
        setMessage("Mirroring finished. Review per-project results below.");
      } finally {
        setBusy(false);
      }
    },
    [mode, options.token, rows],
  );

  const counts = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc[row.action] += 1;
        return acc;
      },
      { add: 0, skip: 0, forbidden: 0, "already-member": 0 } as Record<PreviewAction, number>,
    );
  }, [rows]);

  return { busy, mode, message, rows, counts, applyLog, preview, apply, reset };
}

async function tryAccountPreview(
  token: string,
  accountId: string,
  source: ConnectUserSummary,
  target: ConnectUserSummary,
  regions: RegionInfo[],
  defaultOrigin: string,
): Promise<PreviewRow[] | null> {
  try {
    const userId = source.id;
    if (!userId) return null;
    const payload = await accountRequest<unknown>(token, {
      accountId,
      resource: "project-user",
      userId,
    });
    const projects = parseAccountUserProjects(payload);
    if (!projects.length) return null;

    return projects.map((project) => ({
      projectId: project.id,
      projectName: project.name,
      regionOrigin: matchRegion(regions, defaultOrigin).origin,
      sourceRole: project.role,
      action: "add" as const,
      detail: `Account membership; target ${target.email} will be invited as ${project.role}.`,
    }));
  } catch (error) {
    if (isHttpError(error) && (error.status === 401 || error.status === 403 || error.status === 404)) {
      return null;
    }
    return null;
  }
}

function matchRegion(regions: RegionInfo[], origin: string): RegionInfo {
  return regions.find((region) => region.origin === origin) ?? regions[0];
}

async function operatorPreview(
  token: string,
  regions: RegionInfo[],
  source: ConnectUserSummary,
  target: ConnectUserSummary,
  operatorEmail?: string,
): Promise<PreviewRow[]> {
  const projects: ProjectSummary[] = [];
  for (const region of regions) {
    try {
      const payload = await coreRequest<unknown>(token, {
        origin: region.origin,
        path: "/tc/api/2.0/projects",
        query: { fullyLoaded: false },
      });
      projects.push(...parseProjects(payload, region.origin));
    } catch {
      // Region may be empty for this user.
    }
  }

  const rows = await mapPool(projects, 4, async (project) => {
    try {
      const membersPayload = await coreRequest<unknown>(token, {
        origin: project.regionOrigin,
        path: `/tc/api/2.0/projects/${project.id}/users`,
      });
      const members = asArray<Record<string, unknown>>(membersPayload);
      const sourceMember = members.find((member) => usersMatch(source, member));
      if (!sourceMember) return null;

      const targetMember = members.find((member) => usersMatch(target, member));
      const operatorMember = operatorEmail
        ? members.find((member) => emailOf(member).toLowerCase() === operatorEmail.toLowerCase())
        : undefined;
      const operatorRole = operatorMember
        ? normalizeRole(typeof operatorMember.role === "string" ? operatorMember.role : undefined)
        : undefined;

      let action: PreviewAction = "add";
      const sourceRole = normalizeRole(
        typeof sourceMember.role === "string" ? sourceMember.role : undefined,
      );
      let detail = `Source role ${sourceRole}.`;
      if (targetMember) {
        action = "already-member";
        detail = `Target already has role ${normalizeRole(
          typeof targetMember.role === "string" ? targetMember.role : undefined,
        )}.`;
      } else if (operatorRole && operatorRole !== "ADMIN") {
        action = "forbidden";
        detail = "You are not a project admin on this project.";
      }

      return {
        projectId: project.id,
        projectName: project.name,
        regionOrigin: project.regionOrigin,
        sourceRole,
        action,
        detail,
      } satisfies PreviewRow;
    } catch (error) {
      return {
        projectId: project.id,
        projectName: project.name,
        regionOrigin: project.regionOrigin,
        sourceRole: "USER" as const,
        action: "forbidden" as const,
        detail: error instanceof Error ? error.message : "Could not read members.",
      } satisfies PreviewRow;
    }
  });

  return rows.flatMap((row) => (row ? [row] : []));
}

async function inviteOne(
  token: string,
  row: PreviewRow,
  target: ConnectUserSummary,
): Promise<string> {
  try {
    await coreRequest<unknown>(token, {
      origin: row.regionOrigin,
      path: `/tc/api/2.0/projects/${row.projectId}/users`,
      method: "POST",
      body: [{ email: target.email, role: row.sourceRole }],
    });
    return `Added ${target.email} to ${row.projectName} as ${row.sourceRole}.`;
  } catch (error) {
    const status = isHttpError(error) ? error.status : undefined;
    if (status === 409) {
      return `Already a member of ${row.projectName}.`;
    }
    return `Failed ${row.projectName}: ${error instanceof Error ? error.message : "unknown error"}`;
  }
}
