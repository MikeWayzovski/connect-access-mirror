"use client";

import { MASTER_ORIGIN } from "./allowed-hosts";
import type { PreviewRow, ProjectRole, RegionInfo } from "./types";

export class TrimbleHttpError extends Error {
  status: number;
  body?: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = "TrimbleHttpError";
    this.status = status;
    this.body = body;
  }
}

export function isTrimbleHttpError(error: unknown): error is TrimbleHttpError {
  return error instanceof TrimbleHttpError;
}

function statusMessage(status: number, fallback: string): string {
  if (status === 401) {
    return "401 Unauthorized: the Trimble token is missing, expired, or was rejected.";
  }
  if (status === 403) {
    return "403 Forbidden: this identity is not allowed (not Account Admin, or members cannot be listed).";
  }
  return fallback;
}

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
  let payload: T & { error?: string; message?: string } = {} as T & {
    error?: string;
    message?: string;
  };
  if (text) {
    try {
      payload = JSON.parse(text) as T & { error?: string; message?: string };
    } catch {
      payload = { error: text.slice(0, 180) } as T & { error?: string };
    }
  }

  if (!response.ok) {
    const fallback =
      payload.error ?? payload.message ?? `Request failed (${response.status})`;
    throw new TrimbleHttpError(statusMessage(response.status, fallback), response.status, payload);
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
    const keys = [
      "items",
      "users",
      "projects",
      "data",
      "content",
      "members",
      "result",
      "list",
      "projectUsers",
    ];
    for (const key of keys) {
      if (Array.isArray(record[key])) return record[key] as T[];
    }
    for (const key of keys) {
      const nested = record[key];
      if (nested && typeof nested === "object" && !Array.isArray(nested)) {
        const inner = asArray<T>(nested);
        if (inner.length) return inner;
      }
    }
  }
  return [];
}

export type { PreviewRow };
