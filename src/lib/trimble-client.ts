"use client";

import { MASTER_ORIGIN } from "./allowed-hosts";
import type { PreviewRow, ProjectRole, RegionInfo } from "./types";

async function callApi<T>(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, { ...init, headers, cache: "no-store" });
  const text = await response.text();
  const payload = text ? (JSON.parse(text) as T & { error?: string }) : ({} as T);

  if (!response.ok) {
    const message =
      (payload as { error?: string; message?: string }).error ??
      (payload as { message?: string }).message ??
      `Request failed (${response.status})`;
    const error = new Error(message) as Error & { status?: number; body?: unknown };
    error.status = response.status;
    error.body = payload;
    throw error;
  }

  return payload;
}

export function fetchMe(token: string) {
  return callApi<Record<string, unknown>>("/api/trimble/me", token);
}

export function fetchRegions(token: string) {
  return callApi<{ regions: RegionInfo[] }>("/api/trimble/regions", token);
}

export function coreRequest<T>(
  token: string,
  input: {
    origin: string;
    path: string;
    method?: string;
    query?: Record<string, string | number | boolean | undefined>;
    body?: unknown;
  },
) {
  return callApi<T>("/api/trimble/core", token, {
    method: "POST",
    body: JSON.stringify({
      origin: input.origin,
      path: input.path,
      method: input.method ?? "GET",
      query: input.query,
      body: input.body,
    }),
  });
}

export function accountRequest<T>(
  token: string,
  input: {
    accountId: string;
    resource: "projects" | "project-users" | "project-user";
    userId?: string;
    query?: Record<string, string>;
  },
) {
  const params = new URLSearchParams({
    accountId: input.accountId,
    resource: input.resource,
    ...input.query,
  });
  if (input.userId) params.set("userId", input.userId);
  return callApi<T>(`/api/trimble/account?${params.toString()}`, token);
}

export function updateUsers(
  token: string,
  body: Array<{
    projectId: string;
    updates: Array<{ action: string; email: string; role: ProjectRole }>;
  }>,
) {
  return callApi<unknown>("/api/trimble/update-users", token, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function masterOrigin(): string {
  return MASTER_ORIGIN;
}

export function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["items", "users", "projects", "data", "content", "members"]) {
      if (Array.isArray(record[key])) return record[key] as T[];
    }
  }
  return [];
}

export type { PreviewRow };
