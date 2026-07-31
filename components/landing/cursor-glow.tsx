"use client";

import { useRef } from "react";

export function CursorGlow({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      className={`pointer-events-none absolute inset-0 z-0 opacity-0 ${className}`}
      onMouseMove={(e) => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        el.style.opacity = "1";
        el.style.background = `radial-gradient(600px circle at ${
          e.clientX - r.left
        }px ${e.clientY - r.top}px, rgba(37, 99, 235, 0.08), transparent 60%)`;
      }}
      onMouseLeave={() => {
        const el = ref.current;
        if (!el) return;
        el.style.opacity = "0";
      }}
    />
  );
}
