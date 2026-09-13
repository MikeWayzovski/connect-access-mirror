import { NextRequest, NextResponse } from "next/server";
import { MASTER_ORIGIN } from "@/lib/allowed-hosts";
import { forwardJson, getBearerToken, unauthorized } from "@/lib/bff-auth";

export async function GET(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) return unauthorized();

  const response = await forwardJson(`${MASTER_ORIGIN}/tc/api/2.0/regions`, token);
  if (response.status !== 200) return response;

  const payload = await response.json();
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.regions)
      ? payload.regions
      : Array.isArray(payload?.items)
        ? payload.items
        : [];

  return NextResponse.json({ regions: list });
}
