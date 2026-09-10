"use client";

import Image from "next/image";
import Script from "next/script";
import { useRef, type ReactNode } from "react";

type GlassWindow = Window & {
  liquidGL?: (options: Record<string, unknown>) => unknown;
  __liquidGLNoWebGL__?: boolean;
  __liquidGLRenderer__?: { canvas: HTMLCanvasElement };
};

export function LiquidDemo({ children }: { children: ReactNode }) {
  const started = useRef(false);
  const presentation = useRef<HTMLDivElement>(null);

  function reveal() {
    // Let the initialized lens paint before revealing both glass and content together.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      presentation.current?.setAttribute("data-ready", "true");
      presentation.current?.removeAttribute("inert");
    }));
  }

  async function initialize() {
    if (started.current) return;
    started.current = true;
    const canvas = document.querySelector<HTMLCanvasElement>("canvas.ascii-ocean");
    const video = document.querySelector<HTMLVideoElement>("#ocean-glass-scene video");
    if (!canvas || !video || !canvas.captureStream) return;

    try {
      video.srcObject = canvas.captureStream(30);
      await video.play();
      // CSS masks aren't in the captured pixels; wait for both sea reveals to finish.
      await Promise.all([
        ...canvas.getAnimations().map((animation) => animation.finished),
        ...video.getAnimations().map((animation) => animation.finished),
        document.fonts.load('500 14px "DM Sans"'),
        presentation.current?.querySelector("img")?.decode(),
      ]);
      const glassWindow = window as GlassWindow;
      const pending = new Set(document.querySelectorAll(".liquid-demo, .social-link"));
      glassWindow.liquidGL?.({
        target: ".liquid-demo, .social-link",
        snapshot: "#ocean-glass-scene",
        resolution: 1,
        refraction: 0.026,
        bevelDepth: 0.12,
        bevelWidth: 0.18,
        magnify: 1.08,
        shadow: false,
        reveal: "none",
        on: { init: (lens: { el: HTMLElement }) => {
          // The no-reveal path leaves liquidGL's inline transition:none in place.
          lens.el.style.removeProperty("transition");
          pending.delete(lens.el);
          if (pending.size === 0) reveal();
        } },
      });
      const renderer = glassWindow.__liquidGLRenderer__;
      if (renderer) presentation.current?.appendChild(renderer.canvas);
      if (glassWindow.__liquidGLNoWebGL__) reveal();
    } catch (error) {
      console.warn("Live glass unavailable; demo card remains hidden.", error);
    }
  }

  return (
    <>
      <div id="ocean-glass-scene" aria-hidden="true">
        <video className="ascii-ocean" muted playsInline autoPlay />
      </div>
      <div className="liquid-demo-presentation" ref={presentation} inert>
        <a className="liquid-demo" href="https://liquid.paulolo.com/">
          <span className="liquid-demo-content">
            <Image src="/liquid-card.png" alt="" width={88} height={64} priority />
            <span>Browser liquid <br />glass demo</span>
            <span className="liquid-demo-arrow" aria-hidden="true">↗</span>
          </span>
        </a>
        {children}
      </div>
      <Script src="/vendor/liquidGL.js" onReady={() => { void initialize(); }} />
    </>
  );
}
