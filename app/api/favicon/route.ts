import { NextResponse } from "next/server";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">⛪</text></svg>`;

/** /favicon.ico 요청 시 SVG 파비콘 반환 (404 방지) */
export function GET() {
  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
