"use client";

import { useEffect } from "react";
import { installIframeHostGuard } from "@/lib/iframe-host-guard";

export function IframeHostGuard() {
  useEffect(() => {
    installIframeHostGuard();
  }, []);
  return null;
}
