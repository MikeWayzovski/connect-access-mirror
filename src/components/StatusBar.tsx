import type { CSSProperties } from "react";
import type { ConnectionState, TokenStatus } from "@/lib/types";

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
      return { background: "#e5f4ec", color: "#0b6b36" };
    case "pending":
    case "connecting":
      return { background: "#fff4d6", color: "#8a5a00" };
    case "standalone":
      return { background: "#e8f1f8", color: "#004f83" };
    default:
      return { background: "#fde8e8", color: "#9b1c1c" };
  }
}

export function StatusBar(props: {
  connection: ConnectionState;
  token: TokenStatus;
  projectName?: string;
  operatorEmail?: string;
  message?: string;
}) {
  return (
    <div className="status-bar">
      <span style={{ ...pill, ...tone(props.connection) }}>{props.connection}</span>
      <span style={{ ...pill, ...tone(props.token) }}>token: {props.token}</span>
      {props.projectName ? <strong>{props.projectName}</strong> : <span>No project</span>}
      {props.operatorEmail ? <span className="muted">{props.operatorEmail}</span> : null}
      {props.message ? <span className="status-message">{props.message}</span> : null}
    </div>
  );
}
