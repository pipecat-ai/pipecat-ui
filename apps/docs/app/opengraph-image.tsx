import { ImageResponse } from "next/og";
import { appName } from "@/lib/shared";

export const alt = "Pipecat UI — Components for Pipecat and Voice AI";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: 80,
        background: "#111817",
        color: "#f3f7f5",
      }}
    >
      <div style={{ fontSize: 28, color: "#a7eacb" }}>ui.pipecat.ai</div>
      <div style={{ fontSize: 100, marginTop: 28 }}>{appName}</div>
      <div style={{ fontSize: 36, marginTop: 24 }}>
        Components for Pipecat and Voice AI
      </div>
      <div style={{ fontSize: 28, marginTop: 20, color: "#a7eacb" }}>
        A shadcn registry. Your theme, your code.
      </div>
    </div>,
    size,
  );
}
