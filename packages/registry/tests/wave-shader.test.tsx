import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReactShaderToy } from "@/components/pipecat/wave-shader";

const fragment = "void mainImage(out vec4 c, in vec2 p) { c = vec4(iTime); }";
let frames: Map<number, FrameRequestCallback>;
let visible: IntersectionObserverCallback;
let frameId: number;

function context({ compile = true, link = true } = {}) {
  const methods: Record<string, ReturnType<typeof vi.fn>> = {
    getShaderParameter: vi.fn(() => compile),
    getProgramParameter: vi.fn(() => link),
    getShaderInfoLog: vi.fn(() => "compile failed"),
    getProgramInfoLog: vi.fn(() => "link failed"),
    getExtension: vi.fn(() => null),
    createShader: vi.fn(() => ({})),
    createProgram: vi.fn(() => ({})),
    getUniformLocation: vi.fn(() => ({})),
    getAttribLocation: vi.fn(() => 0),
  };
  const state: { canvas?: HTMLCanvasElement } = {};
  const gl = new Proxy(
    {},
    {
      get: (_, key: string) => {
        if (key === "canvas") return state.canvas;
        if (/^[A-Z_]+$/.test(key)) return 1;
        return (methods[key] ??= vi.fn());
      },
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    function (this: HTMLCanvasElement) {
      state.canvas = this;
      return gl as WebGLRenderingContext;
    } as unknown as typeof HTMLCanvasElement.prototype.getContext,
  );
  return methods;
}

function frame() {
  const pending = [...frames.values()];
  frames.clear();
  act(() => pending.forEach((callback) => callback(100)));
}

beforeEach(() => {
  frames = new Map();
  frameId = 0;
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
    frames.delete(id);
  });
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        visible = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("shader lifecycle", () => {
  it("does not attach deleted shaders or draw after compilation fails", () => {
    const gl = context({ compile: false });
    const error = vi.fn();
    render(
      <ReactShaderToy fs={fragment} onWarning={() => {}} onError={error} />,
    );
    frame();
    frame();
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("compile failed"),
    );
    expect(gl.attachShader).toBeUndefined();
    expect(gl.drawArrays).toBeUndefined();
    expect(frames.size).toBe(0);
  });

  it("discards a failed program instead of starting a render loop", () => {
    const gl = context({ link: false });
    const error = vi.fn();
    render(<ReactShaderToy fs={fragment} onError={error} />);
    frame();
    expect(error).toHaveBeenCalledWith(expect.stringContaining("link failed"));
    expect(gl.deleteProgram).toHaveBeenCalled();
    expect(gl.drawArrays).toBeUndefined();
    expect(frames.size).toBe(0);
  });

  it("reuses uniform locations between frames", () => {
    const gl = context();
    render(<ReactShaderToy fs={fragment} animateWhenNotVisible />);
    frame();
    const lookups = gl.getUniformLocation!.mock.calls.length;
    expect(lookups).toBeGreaterThan(0);
    frame();
    frame();
    expect(gl.drawArrays).toHaveBeenCalledTimes(2);
    expect(gl.getUniformLocation).toHaveBeenCalledTimes(lookups);
  });

  it("resumes a paused offscreen loop when background animation is enabled", () => {
    const gl = context();
    const { rerender } = render(<ReactShaderToy fs={fragment} />);
    frame();
    act(() =>
      visible(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      ),
    );
    frame();
    expect(frames.size).toBe(0);
    rerender(<ReactShaderToy fs={fragment} animateWhenNotVisible />);
    frame();
    expect(gl.drawArrays).toHaveBeenCalledTimes(2);
    expect(frames.size).toBe(1);
  });
});
