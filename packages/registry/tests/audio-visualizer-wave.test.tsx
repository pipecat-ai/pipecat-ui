import { render } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AudioVisualizerWave,
  AudioVisualizerWaveView,
  type DitherOptions,
} from "@/components/pipecat/audio-visualizer-wave";

const hooks = vi.hoisted(() => ({
  usePipecatClientMediaTrack: vi.fn(),
}));

vi.mock("@pipecat-ai/client-react", () => ({
  usePipecatClientMediaTrack: hooks.usePipecatClientMediaTrack,
}));

const fakeTrack = (id: string) =>
  ({ kind: "audio", id }) as unknown as MediaStreamTrack;

const getRoot = (container: HTMLElement) =>
  container.querySelector<HTMLDivElement>(
    '[data-slot="audio-visualizer-wave"]',
  )!;

// Motion drives infinite pulse animations through rAF; fake timers keep
// those loops parked so tests stay deterministic and leak-free.
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function mockWebGL() {
  const methods: Record<string, ReturnType<typeof vi.fn>> = {
    getShaderParameter: vi.fn(() => true),
    getProgramParameter: vi.fn(() => true),
    getExtension: vi.fn(() => null),
    createShader: vi.fn(() => ({})),
    createProgram: vi.fn(() => ({})),
    getUniformLocation: vi.fn((_program, name: string) => ({ name })),
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
    function (this: HTMLCanvasElement, contextId: string) {
      if (contextId === "2d") return null;
      state.canvas = this;
      return gl as WebGLRenderingContext;
    } as typeof HTMLCanvasElement.prototype.getContext,
  );

  const frames = new Map<number, FrameRequestCallback>();
  let frameId = 0;
  let time = 0;
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
    frames.delete(id);
  });

  return {
    methods,
    frame() {
      time += 16;
      const pending = [...frames.values()];
      frames.clear();
      act(() => pending.forEach((callback) => callback(time)));
    },
    uniform(name: string) {
      return methods.uniform1f?.mock.calls.findLast(
        ([location]) => location.name === name,
      )?.[1];
    },
  };
}

describe("AudioVisualizerWaveView", () => {
  it("renders a silent aura with the shader canvas inside", () => {
    const { container } = render(<AudioVisualizerWaveView />);
    const root = getRoot(container);
    expect(root).toBeInTheDocument();
    expect(root).toHaveAttribute("data-state", "silent");
    expect(root.querySelector("canvas")).toBeInTheDocument();
  });

  it("sizes itself square from the size prop, 224 by default", () => {
    const { rerender, container } = render(<AudioVisualizerWaveView />);
    let root = getRoot(container);
    expect(root.style.width).toBe("224px");
    expect(root.style.height).toBe("224px");

    rerender(<AudioVisualizerWaveView size={96} />);
    root = getRoot(container);
    expect(root.style.width).toBe("96px");
    expect(root.style.height).toBe("96px");
  });

  it("derives speaking from the track and lets overrides win in order", () => {
    const track = fakeTrack("t1");
    const { rerender, container } = render(
      <AudioVisualizerWaveView track={track} />,
    );
    expect(getRoot(container)).toHaveAttribute("data-state", "speaking");

    rerender(<AudioVisualizerWaveView track={track} isThinking />);
    expect(getRoot(container)).toHaveAttribute("data-state", "thinking");

    rerender(<AudioVisualizerWaveView track={track} isThinking isConnecting />);
    expect(getRoot(container)).toHaveAttribute("data-state", "connecting");
  });

  it("forwards className to the root", () => {
    const { container } = render(<AudioVisualizerWaveView className="viz" />);
    expect(getRoot(container)).toHaveClass("viz");
  });

  it("tolerates jsdom's null WebGL context once the shader initializes", () => {
    const { container, unmount } = render(
      <AudioVisualizerWaveView isThinking />,
    );
    // The shader defers its WebGL init to a frame; run it (getContext
    // returns null here) plus a few animation ticks.
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(getRoot(container)).toHaveAttribute("data-state", "thinking");
    expect(() => unmount()).not.toThrow();
  });

  it("survives track changes back to silence", () => {
    const { rerender, container } = render(
      <AudioVisualizerWaveView track={fakeTrack("t1")} />,
    );
    rerender(<AudioVisualizerWaveView track={fakeTrack("t2")} />);
    rerender(<AudioVisualizerWaveView track={null} />);
    expect(getRoot(container)).toHaveAttribute("data-state", "silent");
  });
});

describe("wave dithering", () => {
  it("defaults off and releases the previous program when toggled", () => {
    const gl = mockWebGL();
    const { container, rerender, unmount } = render(
      <AudioVisualizerWaveView />,
    );
    const originalCanvas = getRoot(container).querySelector("canvas");
    gl.frame();
    gl.frame();
    expect(gl.methods.createProgram).toHaveBeenCalledTimes(1);
    expect(gl.uniform("uDitherLevels")).toBeUndefined();

    rerender(<AudioVisualizerWaveView dither={false} />);
    expect(getRoot(container).querySelector("canvas")).toBe(originalCanvas);
    expect(gl.methods.deleteProgram).toBeUndefined();

    rerender(<AudioVisualizerWaveView dither />);
    const ditherCanvas = getRoot(container).querySelector("canvas");
    expect(ditherCanvas).not.toBe(originalCanvas);
    expect(gl.methods.deleteProgram).toHaveBeenCalledTimes(1);
    gl.frame();
    gl.frame();
    expect(gl.methods.createProgram).toHaveBeenCalledTimes(2);
    expect(gl.uniform("uPixelSize")).toBe(3);
    expect(gl.uniform("uDitherLevels")).toBe(4);
    expect(gl.uniform("uDitherAlphaLevels")).toBe(4);
    expect(gl.uniform("uDitherStrength")).toBe(1);

    gl.methods.uniform1f!.mockClear();
    rerender(<AudioVisualizerWaveView dither={false} />);
    expect(getRoot(container).querySelector("canvas")).not.toBe(ditherCanvas);
    gl.frame();
    gl.frame();
    expect(gl.methods.createProgram).toHaveBeenCalledTimes(3);
    expect(gl.methods.deleteProgram).toHaveBeenCalledTimes(2);
    expect(gl.uniform("uDitherLevels")).toBeUndefined();

    unmount();
    const draws = gl.methods.drawArrays!.mock.calls.length;
    gl.frame();
    expect(gl.methods.deleteProgram).toHaveBeenCalledTimes(3);
    expect(gl.methods.drawArrays).toHaveBeenCalledTimes(draws);
  });

  it("updates numeric options without replacing the canvas or program", () => {
    const gl = mockWebGL();
    const { container, rerender } = render(<AudioVisualizerWaveView dither />);
    gl.frame();
    gl.frame();
    const canvas = getRoot(container).querySelector("canvas");

    rerender(
      <AudioVisualizerWaveView
        dither={{
          method: "bayer8",
          pixelSize: 5,
          levels: 8,
          alphaLevels: 3,
          strength: 0.5,
        }}
      />,
    );
    gl.frame();
    expect(getRoot(container).querySelector("canvas")).toBe(canvas);
    expect(gl.methods.createProgram).toHaveBeenCalledTimes(1);
    expect(gl.uniform("uPixelSize")).toBe(5);
    expect(gl.uniform("uDitherLevels")).toBe(8);
    expect(gl.uniform("uDitherAlphaLevels")).toBe(3);
    expect(gl.uniform("uDitherStrength")).toBe(0.5);

    rerender(<AudioVisualizerWaveView dither={{ levels: 6 }} />);
    gl.frame();
    expect(gl.methods.createProgram).toHaveBeenCalledTimes(1);
    expect(gl.uniform("uPixelSize")).toBe(3);
    expect(gl.uniform("uDitherLevels")).toBe(6);
    expect(gl.uniform("uDitherAlphaLevels")).toBe(6);
    expect(gl.uniform("uDitherStrength")).toBe(1);
  });

  it("recompiles when the dither method changes", () => {
    const gl = mockWebGL();
    const { container, rerender } = render(<AudioVisualizerWaveView dither />);
    gl.frame();
    const canvas = getRoot(container).querySelector("canvas");

    rerender(<AudioVisualizerWaveView dither={{ method: "noise" }} />);
    gl.frame();
    gl.frame();
    expect(getRoot(container).querySelector("canvas")).not.toBe(canvas);
    expect(gl.methods.deleteProgram).toHaveBeenCalledTimes(1);
    expect(gl.methods.createProgram).toHaveBeenCalledTimes(2);
    expect(gl.methods.drawArrays).toHaveBeenCalledTimes(1);
  });

  it.each<[DitherOptions, number[]]>([
    [
      { pixelSize: NaN, levels: Infinity, alphaLevels: NaN, strength: NaN },
      [3, 4, 4, 1],
    ],
    [
      { pixelSize: 0, levels: -5, alphaLevels: 999, strength: 2 },
      [1, 2, 256, 1],
    ],
    [
      { pixelSize: 9999, levels: 5.7, alphaLevels: Infinity, strength: -1 },
      [4096, 6, 6, 0],
    ],
  ])("uploads finite bounded options for %j", (dither, expected) => {
    const gl = mockWebGL();
    render(<AudioVisualizerWaveView dither={dither} />);
    gl.frame();
    gl.frame();
    expect(
      [
        "uPixelSize",
        "uDitherLevels",
        "uDitherAlphaLevels",
        "uDitherStrength",
      ].map(gl.uniform),
    ).toEqual(expected);
  });

  it("forwards dither options through the connected component", () => {
    hooks.usePipecatClientMediaTrack.mockReturnValue(null);
    const gl = mockWebGL();
    render(
      <AudioVisualizerWave
        participantType="bot"
        dither={{ method: "ign", levels: 7 }}
      />,
    );
    gl.frame();
    gl.frame();
    expect(gl.uniform("uDitherLevels")).toBe(7);
    expect(gl.uniform("uDitherAlphaLevels")).toBe(7);
  });
});

describe("AudioVisualizerWave", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hooks.usePipecatClientMediaTrack.mockReturnValue(null);
  });

  it("visualizes the requested participant's audio track", () => {
    hooks.usePipecatClientMediaTrack.mockReturnValue(fakeTrack("bot-audio"));
    const { container } = render(<AudioVisualizerWave participantType="bot" />);
    expect(hooks.usePipecatClientMediaTrack).toHaveBeenCalledWith(
      "audio",
      "bot",
    );
    expect(getRoot(container)).toHaveAttribute("data-state", "speaking");
  });

  it("rests silent when the participant has no track", () => {
    const { container } = render(
      <AudioVisualizerWave participantType="local" />,
    );
    expect(hooks.usePipecatClientMediaTrack).toHaveBeenCalledWith(
      "audio",
      "local",
    );
    expect(getRoot(container)).toHaveAttribute("data-state", "silent");
  });

  it("forwards lifecycle overrides ahead of the live track", () => {
    hooks.usePipecatClientMediaTrack.mockReturnValue(fakeTrack("bot-audio"));
    const { container } = render(
      <AudioVisualizerWave participantType="bot" isConnecting />,
    );
    expect(getRoot(container)).toHaveAttribute("data-state", "connecting");
  });
});
