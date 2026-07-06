"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

const MIN_DISPLAY_MS = 1200;
const FADE_OUT_MS = 300;
const SPLASH_THEME_COLOR = "#f4f4f6";

interface BrandSplashProps {
  fading?: boolean;
}

export function BrandSplash({ fading = false }: BrandSplashProps) {
  return (
    <div
      aria-hidden={fading}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: SPLASH_THEME_COLOR,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: fading ? 0 : 1,
        transition: `opacity ${FADE_OUT_MS}ms ease`,
        pointerEvents: fading ? "none" : "auto",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          width: "100%",
          padding: 24,
          transform: "translateY(-20px)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/img_splash_logo.svg"
          alt="church up"
          style={{ width: "100%", maxWidth: 240, height: "auto" }}
        />
      </div>
    </div>
  );
}

/** 앱 최초 진입 시 브랜드 스플래시 오버레이 (인증 로딩·최소 1.2초 중 더 긴 쪽까지 표시) */
export function BrandSplashGate() {
  const { loading } = useAuth();
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);
  const mountTimeRef = useRef(Date.now());

  useEffect(() => {
    if (!visible) return;

    const meta = document.querySelector('meta[name="theme-color"]');
    const previous = meta?.getAttribute("content") ?? null;
    meta?.setAttribute("content", SPLASH_THEME_COLOR);

    return () => {
      if (meta) meta.setAttribute("content", "#f4f4f6");
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    if (loading) return;

    const elapsed = Date.now() - mountTimeRef.current;
    const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed);

    let removeTimer: ReturnType<typeof setTimeout> | undefined;

    const fadeTimer = setTimeout(() => {
      setFading(true);
      removeTimer = setTimeout(() => setVisible(false), FADE_OUT_MS);
    }, remaining);

    return () => {
      clearTimeout(fadeTimer);
      if (removeTimer) clearTimeout(removeTimer);
    };
  }, [loading, visible]);

  if (!visible) return null;

  return <BrandSplash fading={fading} />;
}
