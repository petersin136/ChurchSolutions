"use client";

import { useEffect, useState } from "react";

function syncAppHeight() {
  const html = document.documentElement;
  const body = document.body;
  const h = `${window.innerHeight}px`;

  html.style.setProperty("--app-height", h);
  html.style.backgroundColor = "#f4f4f6";
  html.style.colorScheme = "light";
  html.style.overflow = "hidden";
  body.style.backgroundColor = "#f4f4f6";
  body.style.overflow = "hidden";
  body.style.margin = "0";
  body.style.padding = "0";
  body.style.height = h;
  body.style.maxHeight = h;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", "#f4f4f6");
}

/** 앱 셸 뒤·하단에 #0b0c0e 등이 비치지 않도록 런타임에서 배경·높이를 고정 (Chrome 100dvh 갭 대응) */
export function AppShellBackdrop() {
  const [appHeight, setAppHeight] = useState<string | undefined>(undefined);

  useEffect(() => {
    const apply = () => {
      syncAppHeight();
      setAppHeight(`${window.innerHeight}px`);
    };

    apply();
    window.addEventListener("resize", apply);
    window.visualViewport?.addEventListener("resize", apply);
    return () => {
      window.removeEventListener("resize", apply);
      window.visualViewport?.removeEventListener("resize", apply);
    };
  }, []);

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: appHeight ?? "100dvh",
        zIndex: 0,
        background: "#f4f4f6",
        pointerEvents: "none",
      }}
    />
  );
}
