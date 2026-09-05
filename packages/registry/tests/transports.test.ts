import { describe, expect, it, vi } from "vitest";
import {
  createTransport,
  loadTransport,
  registerTransport,
} from "@/lib/transports";
import { StubTransport } from "./helpers/stub-transport";

describe("app-owned transport loaders", () => {
  it("explains setup when no factory or loader exists", async () => {
    await expect(loadTransport("smallwebrtc")).rejects.toThrow(
      "pass transportFactory",
    );
  });

  it("does not invoke a loader until its transport is requested", async () => {
    const loader = vi.fn(async () => StubTransport);
    const cleanup = registerTransport("daily", loader);
    try {
      expect(loader).not.toHaveBeenCalled();
      await expect(loadTransport("moq")).rejects.toThrow(
        "No loader registered",
      );
      expect(loader).not.toHaveBeenCalled();
      await createTransport("daily");
      expect(loader).toHaveBeenCalledTimes(1);
    } finally {
      cleanup();
    }
  });

  it("loads only the registered transport", async () => {
    const cleanup = registerTransport("daily", async () => StubTransport);
    try {
      expect(await createTransport("daily")).toBeInstanceOf(StubTransport);
      await expect(loadTransport("websocket")).rejects.toThrow(
        "No loader registered",
      );
    } finally {
      cleanup();
    }
  });

  it("does not resurrect an earlier registration disposed out of order", async () => {
    const first = registerTransport("smallwebrtc", async () => StubTransport);
    const second = registerTransport("smallwebrtc", async () => StubTransport);
    first();
    expect(await loadTransport("smallwebrtc")).toBe(StubTransport);
    second();
    await expect(loadTransport("smallwebrtc")).rejects.toThrow(
      "No loader registered",
    );
  });

  it("preserves the loader failure and provides the installation hint", async () => {
    const cleanup = registerTransport("moq", async () => {
      throw new Error("module unavailable");
    });
    try {
      await expect(loadTransport("moq")).rejects.toThrow("module unavailable");
    } finally {
      cleanup();
    }
  });
});
