import { NextRequest, NextResponse } from "next/server";
import { ECOM_ORIGIN } from "@/lib/allowed-hosts";
import { forwardJson, getBearerToken, unauthorized } from "@/lib/bff-auth";

export async function GET(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) return unauthorized();

  const accountId = request.nextUrl.searchParams.get("accountId")?.trim();
  const resource = request.nextUrl.searchParams.get("resource");
  const userId = request.nextUrl.searchParams.get("userId")?.trim();

  if (!accountId) {
    return NextResponse.json({ error: "accountId is required." }, { status: 400 });
  }
  if (!/^[A-Za-z0-9_-]+$/.test(accountId)) {
    return NextResponse.json({ error: "Invalid accountId." }, { status: 400 });
  }

  let path: string;
  if (resource === "projects") {
    path = `/v1/accounts/${accountId}/projects?size=100&page=1`;
  } else if (resource === "project-users") {
    path = `/v1/accounts/${accountId}/project-users?pageSize=1000`;
  } else if (resource === "project-user") {
    if (!userId || !/^[A-Za-z0-9_-]+$/.test(userId)) {
      return NextResponse.json({ error: "Valid userId is required." }, { status: 400 });
    }
    path = `/v1/accounts/${accountId}/project-users/${userId}`;
  } else {
    return NextResponse.json({ error: "Unknown account resource." }, { status: 400 });
  }

  const extra = request.nextUrl.searchParams.get("page");
  const url = new URL(path, ECOM_ORIGIN);
  if (extra && resource === "projects") url.searchParams.set("page", extra);

  return forwardJson(url.toString(), token);
}
