import { NextResponse } from "next/server";

export function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const token = match?.[1]?.trim();
  return token || null;
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Missing Authorization bearer token." }, { status: 401 });
}

export async function forwardJson(
  url: string,
  token: string,
  init: RequestInit = {},
): Promise<NextResponse> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("Accept", "application/json");

  const response = await fetch(url, { ...init, headers, cache: "no-store" });
  const text = await response.text();
  const contentType = response.headers.get("content-type") ?? "application/json";

  return new NextResponse(text, {
    status: response.status,
    headers: { "Content-Type": contentType },
  });
}
