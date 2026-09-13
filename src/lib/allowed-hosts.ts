const CONNECT_HOST = /(^|\.)connect\.trimble\.com$/i;

export function isAllowedConnectOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:") return false;
    return CONNECT_HOST.test(url.hostname);
  } catch {
    return false;
  }
}

export function assertAllowedConnectOrigin(origin: string): URL {
  if (!isAllowedConnectOrigin(origin)) {
    throw new Error("Destination host is not an allowed Trimble Connect API.");
  }
  return new URL(origin);
}

export const MASTER_ORIGIN = "https://app.connect.trimble.com";
export const ECOM_ORIGIN = "https://ecom.connect.trimble.com";
export const PROJECTS_API_ORIGIN = "https://projects-api.connect.trimble.com";
