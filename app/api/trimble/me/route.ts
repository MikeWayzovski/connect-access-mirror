import { NextRequest } from "next/server";
import { MASTER_ORIGIN } from "@/lib/allowed-hosts";
import { forwardJson, getBearerToken, unauthorized } from "@/lib/bff-auth";

export async function GET(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) return unauthorized();
  return forwardJson(`${MASTER_ORIGIN}/tc/api/2.0/users/me`, token);
}
