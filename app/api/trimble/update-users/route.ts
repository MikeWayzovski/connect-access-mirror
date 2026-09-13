import { NextRequest, NextResponse } from "next/server";
import { PROJECTS_API_ORIGIN } from "@/lib/allowed-hosts";
import { forwardJson, getBearerToken, unauthorized } from "@/lib/bff-auth";

export async function POST(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON body is required." }, { status: 400 });
  }

  if (!Array.isArray(body) || body.length === 0 || body.length > 30) {
    return NextResponse.json(
      { error: "Body must be an array of 1–30 project update jobs." },
      { status: 400 },
    );
  }

  return forwardJson(`${PROJECTS_API_ORIGIN}/v1/projects/update-users`, token, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
