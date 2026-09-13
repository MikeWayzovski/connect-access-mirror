import * as WorkspaceAPI from "trimble-connect-workspace-api";
import type { ConnectProject, ConnectUser, WorkspaceAPI as WorkspaceApi } from "trimble-connect-workspace-api";
import { withHostTimeout } from "./iframe-host-guard";

export const OPEN_MIRROR_COMMAND = "open-mirror";
export const OPEN_CONFIG_COMMAND = "open-config";

export type WorkspaceEventHandler = (
  event: string,
  args: { data?: unknown },
) => void;

export async function connectToConnect(
  onEvent: WorkspaceEventHandler,
  timeoutMs = 30_000,
): Promise<WorkspaceApi> {
  const api = await WorkspaceAPI.connect(
    window.parent,
    (event: string, args: { data?: unknown }) => {
      try {
        onEvent(event, args);
      } catch (error) {
        console.info("[access-mirror] Workspace event handler failed; ignoring", error);
      }
    },
    timeoutMs,
  );

  try {
    await withHostTimeout(
      api.ui.setMenu({
        title: "Access Mirror",
        icon: `${window.location.origin}/icon.svg`,
        command: OPEN_MIRROR_COMMAND,
      }).then(() => undefined),
      undefined,
      5000,
    );
  } catch (error) {
    console.info("[access-mirror] setMenu skipped (host did not respond)", error);
  }

  try {
    await withHostTimeout(api.ui.setActiveMenuItem(OPEN_MIRROR_COMMAND), false, 5000);
  } catch (error) {
    console.info("[access-mirror] setActiveMenuItem skipped (host did not respond)", error);
  }

  try {
    await withHostTimeout(api.extension.setStatusMessage("Access Mirror connected"), false, 5000);
  } catch (error) {
    console.info("[access-mirror] setStatusMessage skipped (host did not respond)", error);
  }

  return api;
}

export async function readHostContext(api: WorkspaceApi): Promise<{
  project: ConnectProject | null;
  user: ConnectUser | null;
}> {
  const [project, user] = await Promise.all([
    api.project.getProject().catch(() => api.project.getCurrentProject().catch(() => null)),
    api.user.getUser().catch(() => null),
  ]);
  return { project, user };
}

export function isStandaloneWindow(): boolean {
  return typeof window === "undefined" || window.parent === window;
}
