import { NextRequest, NextResponse } from "next/server";
import { assertAllowedConnectOrigin } from "@/lib/allowed-hosts";
import { forwardJson, getBearerToken, unauthorized } from "@/lib/bff-auth";

type CoreBody = {
  origin?: string;
  path?: string;
  method?: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
};

const ALLOWED_METHODS = new Set(["GET", "POST", "PATCH", "PUT", "DELETE"]);

export async function POST(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) return unauthorized();

  const payload = (await request.json()) as CoreBody;
  const origin = payload.origin?.trim();
  const path = payload.path?.trim();
  const method = (payload.method ?? "GET").toUpperCase();

  if (!origin || !path) {
    return NextResponse.json({ error: "origin and path are required." }, { status: 400 });
  }
  if (!path.startsWith("/tc/api/")) {
    return NextResponse.json({ error: "path must start with /tc/api/." }, { status: 400 });
  }
  if (!ALLOWED_METHODS.has(method)) {
    return NextResponse.json({ error: "Unsupported HTTP method." }, { status: 400 });
  }

  let base: URL;
  try {
    base = assertAllowedConnectOrigin(origin);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid origin." },
      { status: 400 },
    );
  }

  const url = new URL(path, base.origin);
  for (const [key, value] of Object.entries(payload.query ?? {})) {
    if (value === undefined) continue;
    url.searchParams.set(key, String(value));
  }

  return forwardJson(url.toString(), token, {
    method,
    body: payload.body === undefined ? undefined : JSON.stringify(payload.body),
  });
}
