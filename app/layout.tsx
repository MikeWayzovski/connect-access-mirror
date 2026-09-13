import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import { IframeHostGuard } from "@/components/IframeHostGuard";
import "./globals.css";

export const metadata: Metadata = {
  title: "Access Mirror",
  description: "Trimble Connect extension for copying project membership between users.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Script id="access-mirror-iframe-guard" strategy="beforeInteractive">
          {`(function(){
  function wrap(proto){
    var orig = proto.querySelector;
    if (!orig || orig.__accessMirrorPatched) return;
    function patched(sel){
      if (!sel) return null;
      try { return orig.call(this, sel); }
      catch (e) { if (e && e.name === "DOMException") return null; throw e; }
    }
    patched.__accessMirrorPatched = true;
    proto.querySelector = patched;
  }
  wrap(Document.prototype);
  wrap(DocumentFragment.prototype);
  wrap(Element.prototype);
  window.addEventListener("unhandledrejection", function(ev){
    var msg = String((ev.reason && (ev.reason.message || ev.reason)) || "");
    if (msg.indexOf("requestHostTools") !== -1 || msg.indexOf("aaip-iframe-sdk") !== -1 || msg.indexOf("requestMcpAppOpenLinkHandlerRegistration") !== -1) {
      ev.preventDefault();
    }
  });
})();`}
        </Script>
        <IframeHostGuard />
        {children}
      </body>
    </html>
  );
}
