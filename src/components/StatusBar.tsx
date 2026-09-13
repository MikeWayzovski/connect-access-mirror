import type { CSSProperties } from "react";
import type { ConnectionState, OperatorCapability, TokenStatus } from "@/lib/types";

const pill: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "2px 8px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 600,
};

function tone(state: string): CSSProperties {
  switch (state) {
    case "connected":
    case "granted":
    case "account-admin":
    case "project-admin":
      return { background: "#e5f4ec", color: "#0b6b36" };
    case "pending":
    case "connecting":
    case "project-user":
      return { background: "#fff4d6", color: "#8a5a00" };
    case "standalone":
      return { background: "#e8f1f8", color: "#004f83" };
    default:
      return { background: "#fde8e8", color: "#9b1c1c" };
  }
}

function capabilityLabel(capability?: OperatorCapability): string {
  switch (capability) {
    case "account-admin":
      return "Account Admin";
    case "project-admin":
      return "Project Admin";
    case "project-user":
      return "Project User";
    default:
      return "role unknown";
  }
}

export function StatusBar(props: {
  connection: ConnectionState;
  token: TokenStatus;
  capability?: OperatorCapability;
  memberCount?: number;
  projectName?: string;
  operatorEmail?: string;
  message?: string;
}) {
  return (
    <div className="status-bar">
      <span style={{ ...pill, ...tone(props.connection) }}>{props.connection}</span>
      <span style={{ ...pill, ...tone(props.token) }}>token: {props.token}</span>
      {props.capability ? (
        <span style={{ ...pill, ...tone(props.capability) }}>{capabilityLabel(props.capability)}</span>
      ) : null}
      {typeof props.memberCount === "number" ? (
        <span style={{ ...pill, ...tone("standalone") }}>{props.memberCount} members</span>
      ) : null}
      {props.projectName ? <strong>{props.projectName}</strong> : <span>No project</span>}
      {props.operatorEmail ? <span className="muted">{props.operatorEmail}</span> : null}
      {props.message ? <span className="status-message">{props.message}</span> : null}
    </div>
  );
}
