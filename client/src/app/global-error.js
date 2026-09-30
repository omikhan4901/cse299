"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/reportError";

/** The last resort when the whole layout fails: plain HTML, reported, with a reload link. */
export default function GlobalError({ error }) {
  useEffect(() => reportError(error), [error]);
  return (
    <html lang="en">
      <body style={{ fontFamily: "Inter, Arial, sans-serif", color: "#0f1f2a", background: "#f8fafc", display: "grid", placeItems: "center", minHeight: "90vh", margin: 0 }}>
        <div style={{ maxWidth: 420, padding: 32, textAlign: "center" }}>
          <h1 style={{ fontSize: 22 }}>ResumeX hit a problem</h1>
          <p style={{ color: "#475569" }}>We&apos;ve been told about it. Your saved work is safe.</p>
          <button type="button" onClick={() => window.location.reload()} style={{ color: "#007b7b", fontWeight: 600, background: "none", border: 0, cursor: "pointer", fontSize: 16 }}>
            Reload the page
          </button>
        </div>
      </body>
    </html>
  );
}
