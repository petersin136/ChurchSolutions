import { readFileSync } from "fs";
import { join } from "path";
import { NextResponse } from "next/server";

const faviconSvg = readFileSync(join(process.cwd(), "public/favicon.svg"), "utf8");

/** /favicon.ico 요청 시 public/favicon.svg 내용 반환 */
export function GET() {
  return new NextResponse(faviconSvg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600, must-revalidate",
    },
  });
}
