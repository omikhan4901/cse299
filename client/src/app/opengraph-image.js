import { ImageResponse } from "next/og";

export const alt = "ResumeX – Free ATS resume builder with 50+ templates";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "linear-gradient(135deg, #002A3A 0%, #007B7B 100%)", color: "white" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 72, height: 72, borderRadius: 18, background: "white", color: "#007B7B", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48, fontWeight: 800 }}>R</div>
          <div style={{ fontSize: 52, fontWeight: 800 }}>ResumeX</div>
        </div>
        <div style={{ fontSize: 68, fontWeight: 800, marginTop: 48, lineHeight: 1.1, maxWidth: 900 }}>Build the resume that lands the job</div>
        <div style={{ fontSize: 30, marginTop: 28, opacity: 0.8 }}>50 free templates · Real ATS check · Live PDF preview</div>
      </div>
    ),
    size
  );
}
