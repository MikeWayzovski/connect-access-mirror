"use client";

import { FormEvent, useMemo, useState } from "react";
import { displayName, type ConnectUserSummary, type OperatorCapability } from "@/lib/types";
import { useMirrorFlow } from "./useMirrorFlow";

export function MirrorPage(props: {
  token: string | null;
  members: ConnectUserSummary[];
  membersLoading?: boolean;
  membersError?: string | null;
  membersErrorStatus?: number | null;
  capability?: OperatorCapability;
  currentProjectId?: string;
  currentProjectLocation?: string;
  operatorEmail?: string;
}) {
  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [sourceEmail, setSourceEmail] = useState("");
  const [targetEmail, setTargetEmail] = useState("");
  const [filter, setFilter] = useState("");

  const flow = useMirrorFlow({
    token: props.token,
    currentProjectId: props.currentProjectId,
    currentProjectLocation: props.currentProjectLocation,
    operatorEmail: props.operatorEmail,
    capability: props.capability,
  });

  const filteredMembers = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return props.members;
    return props.members.filter((member) =>
      `${member.email} ${member.firstName ?? ""} ${member.lastName ?? ""}`.toLowerCase().includes(q),
    );
  }, [filter, props.members]);

  function resolveUser(selectedId: string, fallbackEmail: string): ConnectUserSummary | null {
    const fromList = props.members.find((member) => (member.id ?? member.email) === selectedId);
    if (fromList) return fromList;
    const email = fallbackEmail.trim();
    if (!email || !email.includes("@")) return null;
    return { email };
  }

  async function onPreview(event: FormEvent) {
    event.preventDefault();
    const source = resolveUser(sourceId, sourceEmail);
    const target = resolveUser(targetId, targetEmail);
    if (!source || !target) {
      return;
    }
    if (source.email.toLowerCase() === target.email.toLowerCase()) return;
    await flow.preview(source, target);
  }

  async function onApply() {
    const target = resolveUser(targetId, targetEmail);
    if (!target) return;
    await flow.apply(target);
  }

  const authFailed = props.membersErrorStatus === 401 || flow.errorStatus === 401;
  const canWorkAtProjectLevel =
    props.members.length > 0 ||
    props.capability === "project-admin" ||
    props.capability === "account-admin";
  const blockingForbidden =
    !canWorkAtProjectLevel &&
    (props.membersErrorStatus === 403 || flow.errorStatus === 403);

  return (
    <section className="panel">
      <header className="panel-header">
        <h1>User access mirroring</h1>
        <p>
          Copy project membership from a source user onto a target user. Project Admins can
          mirror within projects they administer. Account Admin APIs are used only when that
          role is available.
        </p>
      </header>

      {props.membersLoading ? <p className="muted">Loading project members from Trimble Connect…</p> : null}

      {authFailed ? (
        <p className="banner banner-error" role="alert">
          401 Unauthorized — grant or refresh the access token, then reload the extension.
        </p>
      ) : null}
      {blockingForbidden ? (
        <p className="banner banner-error" role="alert">
          403 Forbidden — you have no Project Admin rights on this project, so members cannot be
          listed and mirroring is blocked here.
        </p>
      ) : null}
      {props.membersError && !authFailed && !blockingForbidden ? (
        <p className="banner banner-error" role="alert">
          {props.membersError}
        </p>
      ) : null}
      {flow.errorStatus && flow.message && flow.errorStatus !== 401 && flow.errorStatus !== 403 ? (
        <p className="banner banner-error" role="alert">
          {flow.message}
        </p>
      ) : null}

      <p className="muted">
        {props.members.length} member{props.members.length === 1 ? "" : "s"} in this project
        {props.capability === "account-admin"
          ? " · Account Admin (can mirror across the account)"
          : props.capability === "project-admin"
            ? " · Project Admin (mirrors projects you administer)"
            : props.capability === "project-user"
              ? " · Project User (invite may be restricted)"
              : ""}
        .
      </p>

      <form className="stack" onSubmit={onPreview}>
        <label>
          Search current project members
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Name or email"
          />
        </label>

        <div className="grid-2">
          <label>
            Source user
            <select value={sourceId} onChange={(event) => setSourceId(event.target.value)}>
              <option value="">Select from this project…</option>
              {filteredMembers.map((member) => (
                <option key={member.id ?? member.email} value={member.id ?? member.email}>
                  {displayName(member)} ({member.email})
                  {member.role ? ` · ${member.role}` : ""}
                </option>
              ))}
            </select>
            <input
              value={sourceEmail}
              onChange={(event) => setSourceEmail(event.target.value)}
              placeholder="or type source email"
            />
          </label>

          <label>
            Target user
            <select value={targetId} onChange={(event) => setTargetId(event.target.value)}>
              <option value="">Select from this project…</option>
              {filteredMembers.map((member) => (
                <option key={member.id ?? member.email} value={member.id ?? member.email}>
                  {displayName(member)} ({member.email})
                  {member.role ? ` · ${member.role}` : ""}
                </option>
              ))}
            </select>
            <input
              value={targetEmail}
              onChange={(event) => setTargetEmail(event.target.value)}
              placeholder="or type target email"
            />
          </label>
        </div>

        <div className="actions">
          <button type="submit" disabled={flow.busy || !props.token}>
            {flow.busy ? "Working…" : "Preview"}
          </button>
          <button
            type="button"
            className="primary"
            disabled={flow.busy || !flow.rows.some((row) => row.action === "add")}
            onClick={onApply}
          >
            Confirm & apply
          </button>
          <button type="button" className="ghost" onClick={flow.reset} disabled={flow.busy}>
            Reset
          </button>
        </div>
      </form>

      {flow.message && !flow.errorStatus ? <p className="banner">{flow.message}</p> : null}
      {flow.mode ? (
        <p className="muted">
          Mode: {flow.mode === "account" ? "Account Admin" : "Operator-visible projects"} · add{" "}
          {flow.counts.add} · already {flow.counts["already-member"]} · forbidden {flow.counts.forbidden}
        </p>
      ) : null}

      {flow.rows.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Project</th>
                <th>Source role</th>
                <th>Action</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {flow.rows.map((row) => (
                <tr key={row.projectId}>
                  <td>{row.projectName}</td>
                  <td>{row.sourceRole}</td>
                  <td>
                    <span className={`tag tag-${row.action}`}>{row.action}</span>
                  </td>
                  <td className="muted">{row.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {flow.applyLog.length ? (
        <ul className="log">
          {flow.applyLog.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
