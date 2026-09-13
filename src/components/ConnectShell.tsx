"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ConnectProject, ConnectUser, WorkspaceAPI } from "trimble-connect-workspace-api";
import { StatusBar } from "@/components/StatusBar";
import { MirrorPage } from "@/features/mirror/MirrorPage";
import { useProjectMembers } from "@/features/mirror/useProjectMembers";
import { isLikelyToken, type ConnectionState, type ConnectUserSummary, type TokenStatus } from "@/lib/types";
import {
  connectToConnect,
  isStandaloneWindow,
  OPEN_CONFIG_COMMAND,
  OPEN_MIRROR_COMMAND,
  readHostContext,
} from "@/lib/workspace";
import { installIframeHostGuard, withHostTimeout } from "@/lib/iframe-host-guard";

type View = "mirror" | "config";

export function ConnectShell() {
  const apiRef = useRef<WorkspaceAPI | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [tokenStatus, setTokenStatus] = useState<TokenStatus>("idle");
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("Connecting to Trimble Connect…");
  const [project, setProject] = useState<ConnectProject | null>(null);
  const [operator, setOperator] = useState<ConnectUser | null>(null);
  const [members, setMembers] = useState<ConnectUserSummary[]>([]);
  const [view, setView] = useState<View>("mirror");
  const projectMembers = useProjectMembers({
    token,
    projectId: project?.id,
    location: project?.location,
    operatorEmail: operator?.email,
    seed: members,
  });

  const applyToken = useCallback((value: unknown) => {
    const raw = typeof value === "string" ? value : "";
    if (!raw) return;
    if (raw.toLowerCase() === "pending") {
      setTokenStatus("pending");
      setStatusMessage("Waiting for token consent in Trimble Connect…");
      return;
    }
    if (raw.toLowerCase() === "denied") {
      setToken(null);
      setTokenStatus("denied");
      setStatusMessage("Token consent denied. Reset it under extension settings.");
      return;
    }
    if (isLikelyToken(raw)) {
      setToken(raw);
      setTokenStatus("granted");
      setStatusMessage("Access token acquired.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      installIframeHostGuard();
      if (isStandaloneWindow()) {
        setConnection("standalone");
        setStatusMessage("Opened outside Trimble Connect. iFrame APIs are unavailable.");
        return;
      }

      try {
        const api = await connectToConnect((event, args) => {
          if (event === "extension.command") {
            if (args.data === OPEN_MIRROR_COMMAND) setView("mirror");
            if (args.data === OPEN_CONFIG_COMMAND) setView("config");
          }
          if (event === "extension.accessToken") {
            applyToken(args.data);
          }
        });
        if (cancelled) return;
        apiRef.current = api;

        const context = await readHostContext(api);
        if (cancelled) return;
        setProject(context.project);
        setOperator(context.user);

        try {
          const hostMembers = await withHostTimeout(api.project.getMembers(), [], 5000);
          if (!cancelled) {
            setMembers(
              hostMembers.map((member) => ({
                id: member.id,
                email: member.email,
                firstName: member.firstName,
                lastName: member.lastName,
                role: member.role,
                status: member.status,
              })),
            );
          }
        } catch (cause) {
          console.warn(
            "[access-mirror] Workspace getMembers failed; will use Core API after token grant",
            cause instanceof Error ? cause.message : cause,
          );
        }

        setConnection("connected");
        setStatusMessage(
          context.project?.name
            ? `Connected to ${context.project.name}`
            : "Connected to Trimble Connect",
        );

        const permission = await withHostTimeout(
          api.extension.requestPermission("accesstoken"),
          "pending",
          8000,
        );
        if (!cancelled) applyToken(permission);
      } catch (cause) {
        if (cancelled) return;
        setConnection("error");
        setError(cause instanceof Error ? cause.message : "Workspace API connection failed.");
        setStatusMessage("Could not reach Trimble Connect Workspace API.");
      }
    }

    void start();
    return () => {
      cancelled = true;
    };
  }, [applyToken]);

  const listedMembers = projectMembers.users.length ? projectMembers.users : members;

  return (
    <main className="app" id="main-content">
      <StatusBar
        connection={connection}
        token={tokenStatus}
        capability={projectMembers.capability}
        memberCount={listedMembers.length}
        projectName={project?.name}
        operatorEmail={operator?.email}
        message={statusMessage}
      />

      {connection === "error" ? (
        <section className="panel">
          <h1>Connection error</h1>
          <p>{error}</p>
          <p className="muted">
            This app must run inside Trimble Connect for Browser as a project extension.
          </p>
        </section>
      ) : null}

      {connection === "standalone" ? (
        <section className="panel">
          <h1>Standalone debug</h1>
          <p>
            Local HTTP preview cannot talk to Trimble Connect. Deploy to Vercel (HTTPS) and install{" "}
            <code>/manifest.json</code> under Apps &amp; Capabilities.
          </p>
          <p className="muted">Workspace API, tokens, and mirroring stay disabled here.</p>
        </section>
      ) : null}

      {connection === "connecting" ? (
        <section className="panel">
          <h1>Connecting</h1>
          <p>Establishing a postMessage channel with Trimble Connect…</p>
        </section>
      ) : null}

      {connection === "connected" && view === "config" ? (
        <section className="panel">
          <h1>Extension settings</h1>
          <p>
            Access Mirror copies project roles (USER / ADMIN) only. Folder permissions and groups are
            out of scope for v1.
          </p>
          <button type="button" onClick={() => setView("mirror")}>
            Back to mirroring
          </button>
        </section>
      ) : null}

      {connection === "connected" && view === "mirror" ? (
        <MirrorPage
          token={token}
          members={listedMembers}
          membersLoading={projectMembers.loading}
          membersError={projectMembers.error}
          membersErrorStatus={projectMembers.errorStatus}
          capability={projectMembers.capability}
          currentProjectId={project?.id}
          currentProjectLocation={project?.location}
          operatorEmail={operator?.email}
        />
      ) : null}
    </main>
  );
}
