export type ProjectRole = "ADMIN" | "USER";

export type ConnectionState =
  | "connecting"
  | "connected"
  | "standalone"
  | "error";

export type TokenStatus = "idle" | "pending" | "granted" | "denied" | "error";

export type MirrorMode = "account" | "operator";

export type OperatorCapability = "account-admin" | "project-admin" | "project-user" | "unknown";

export type PreviewAction = "add" | "skip" | "forbidden" | "already-member";

export interface ConnectUserSummary {
  id?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  status?: string;
}

export interface RegionInfo {
  origin: string;
  location?: string;
  tcApi?: string;
  projectsApi?: string;
  isMaster?: boolean;
}

export interface ProjectSummary {
  id: string;
  name: string;
  regionOrigin: string;
  location?: string;
}

export interface PreviewRow {
  projectId: string;
  projectName: string;
  regionOrigin: string;
  sourceRole: ProjectRole;
  action: PreviewAction;
  detail?: string;
}

export function displayName(user: ConnectUserSummary): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return name || user.email;
}

export function normalizeRole(role?: string): ProjectRole {
  const value = (role ?? "USER").toUpperCase().replace(/[\s_-]/g, "");
  if (
    value === "ADMIN" ||
    value === "PROJECTADMIN" ||
    value === "PROJECTADMINISTRATOR" ||
    value === "ADMINISTRATOR"
  ) {
    return "ADMIN";
  }
  return "USER";
}

export function isLikelyToken(value: string): boolean {
  if (!value) return false;
  const lower = value.toLowerCase();
  return lower !== "pending" && lower !== "denied" && value.length > 20;
}
