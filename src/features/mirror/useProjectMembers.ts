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
    if (!options.token && seedRef.current?.length) {
      setUsers(seedRef.current);
    }
  }, [options.token]);

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
        if (!merged.length) {
          setError("No project members were returned. You may lack permission to list users.");
        }
      } catch (cause) {
        if (cancelled) return;
        const status = isTrimbleHttpError(cause) ? cause.status : null;
        setErrorStatus(status);
        setError(cause instanceof Error ? cause.message : "Failed to load project members.");
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
