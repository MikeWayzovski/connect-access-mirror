import { NextRequest, NextResponse } from "next/server";

function appOrigin(request: NextRequest): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  return request.nextUrl.origin;
}

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-cache",
    "Content-Type": "application/json",
  };
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export function GET(request: NextRequest) {
  const origin = appOrigin(request);
  const manifest = {
    title: "Access Mirror",
    description:
      "Copy Trimble Connect project membership from a source user to a target user.",
    icon: `${origin}/icon.svg`,
    url: `${origin}/`,
    configCommand: "open-config",
    extensionType: ["project"],
    enabled: true,
  };

  return NextResponse.json(manifest, { headers: corsHeaders() });
}
