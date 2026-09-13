"use client";

import { useEffect, useRef, useState } from "react";
import {
  fetchProjectMembers,
  mergeUsers,
  resolveOperatorCapability,
} from "@/lib/members";
import { isTrimbleHttpError } from "@/lib/trimble-client";
import type { ConnectUserSummary, OperatorCapability } from "@/lib/types";

export function useProjectMembers(options: {
  token: string | null;
  projectId?: string;
  location?: string;
  operatorEmail?: string;
  seed?: ConnectUserSummary[];
}) {
  const seedRef = useRef(options.seed);
  seedRef.current = options.seed;

  const [users, setUsers] = useState<ConnectUserSummary[]>(options.seed ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [capability, setCapability] = useState<OperatorCapability>("unknown");

  useEffect(() => {
    const seed = seedRef.current;
    if (seed?.length) {
      setUsers((current) => mergeUsers(seed, current));
    }
  }, [options.seed?.length]);

  useEffect(() => {
    if (!options.token || !options.projectId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setErrorStatus(null);

    void (async () => {
      try {
        const result = await fetchProjectMembers({
          token: options.token!,
          projectId: options.projectId!,
          location: options.location,
        });
        if (cancelled) return;
        const merged = mergeUsers(seedRef.current ?? [], result.users);
        setUsers(merged);

        const cap = await resolveOperatorCapability({
          token: options.token!,
          projectId: options.projectId,
          location: options.location,
          operatorEmail: options.operatorEmail,
          members: merged,
        });
        if (!cancelled) setCapability(cap);

        if (!merged.length && result.coreForbidden) {
          setError("Could not list members on this project via the Core API.");
          setErrorStatus(403);
        }
      } catch (cause) {
        if (cancelled) return;
        if (isTrimbleHttpError(cause) && cause.status === 401) {
          setErrorStatus(401);
          setError(cause.message);
        } else {
          console.info(
            "[access-mirror] Member fetch recovered from error; keeping Workspace seed if present",
            cause instanceof Error ? cause.message : cause,
          );
        }
        if (seedRef.current?.length) setUsers(seedRef.current);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [options.location, options.operatorEmail, options.projectId, options.token]);

  return { users, loading, error, errorStatus, capability };
}
