const HOST_TIMEOUT_HINTS = [
  "requestHostTools",
  "aaip-iframe-sdk",
  "requestMcpAppOpenLinkHandlerRegistration",
];

function isIgnorableHostTimeout(reason: unknown): boolean {
  const text =
    reason instanceof Error
      ? `${reason.name} ${reason.message}`
      : typeof reason === "string"
        ? reason
        : JSON.stringify(reason ?? "");
  return HOST_TIMEOUT_HINTS.some((hint) => text.includes(hint));
}

function wrapQuerySelector(proto: { querySelector: typeof Document.prototype.querySelector }): void {
  const original = proto.querySelector;
  proto.querySelector = function querySelectorPatched(this: ParentNode, selectors: string) {
    if (!selectors) return null;
    try {
      return original.call(this, selectors);
    } catch (error) {
      if (error instanceof DOMException) return null;
      throw error;
    }
  };
}

function sanitizeSideNavigation(root: ParentNode): void {
  const nodes = root.querySelectorAll?.("modus-wc-side-navigation") ?? [];
  nodes.forEach((element) => {
    const current =
      element.getAttribute("target-content-id") ??
      element.getAttribute("target-content") ??
      element.getAttribute("targetContent");
    if (!current) {
      element.setAttribute("target-content-id", "#main-content");
    }
  });
}

function installHostToolStubs(target: Window & Record<string, unknown>): void {
  const stub = async () => undefined;
  for (const name of ["requestHostTools", "requestMcpAppOpenLinkHandlerRegistration"] as const) {
    const current = target[name];
    if (typeof current === "function") {
      const original = current as (...args: unknown[]) => unknown;
      target[name] = async (...args: unknown[]) => {
        try {
          return await Promise.race([
            Promise.resolve(original.apply(target, args)),
            new Promise((resolve) => {
              window.setTimeout(() => resolve(undefined), 5000);
            }),
          ]);
        } catch (error) {
          if (!isIgnorableHostTimeout(error)) {
            console.info("[access-mirror] host tool call failed; continuing", name);
          }
          return undefined;
        }
      };
    }
  }
}

export function installIframeHostGuard(): void {
  if (typeof window === "undefined") return;
  const flagged = window as Window & { __accessMirrorHostGuard?: boolean };
  if (flagged.__accessMirrorHostGuard) return;
  flagged.__accessMirrorHostGuard = true;

  wrapQuerySelector(Document.prototype);
  wrapQuerySelector(DocumentFragment.prototype);
  wrapQuerySelector(Element.prototype);

  window.addEventListener("unhandledrejection", (event) => {
    if (isIgnorableHostTimeout(event.reason)) {
      event.preventDefault();
      console.info("[access-mirror] Host iframe SDK timed out; continuing without host tools.");
    }
  });

  window.addEventListener("error", (event) => {
    if (isIgnorableHostTimeout(event.error ?? event.message)) {
      event.preventDefault();
    }
  });

  sanitizeSideNavigation(document);
  const observer = new MutationObserver(() => sanitizeSideNavigation(document));
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["target-content-id", "target-content"],
  });

  installHostToolStubs(window as unknown as Window & Record<string, unknown>);
}

export async function withHostTimeout<T>(
  task: Promise<T>,
  fallback: T,
  timeoutMs = 5000,
): Promise<T> {
  try {
    return await Promise.race([
      task,
      new Promise<T>((resolve) => {
        window.setTimeout(() => resolve(fallback), timeoutMs);
      }),
    ]);
  } catch (error) {
    if (!isIgnorableHostTimeout(error)) {
      console.info("[access-mirror] optional host call failed; using fallback");
    }
    return fallback;
  }
}
