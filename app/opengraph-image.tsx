import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";

export const runtime = "nodejs";
export const alt = "처치업 - 교회 관리 솔루션";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const regularData = readFileSync(
    join(process.cwd(), "public/fonts/NanumGothic-Regular.ttf"),
  );
  const boldData = readFileSync(join(process.cwd(), "public/fonts/NanumGothic-Bold.ttf"));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #1e3a8a 0%, #1e40af 48%, #312e81 100%)",
          fontFamily: "NanumGothic",
          color: "#ffffff",
          padding: "56px 64px",
        }}
      >
        <div style={{ flex: 1 }} />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 108,
              fontWeight: 700,
              letterSpacing: -2,
              lineHeight: 1.1,
            }}
          >
            처치업
          </div>
          <div
            style={{
              fontSize: 44,
              fontWeight: 400,
              marginTop: 20,
              opacity: 0.95,
              lineHeight: 1.3,
            }}
          >
            교회 관리 솔루션
          </div>
        </div>

        <div
          style={{
            fontSize: 24,
            fontWeight: 400,
            opacity: 0.82,
            textAlign: "center",
            lineHeight: 1.4,
          }}
        >
          행정은 가볍게, 시선은 목양에 · churchup.kr
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "NanumGothic",
          data: regularData,
          weight: 400,
          style: "normal",
        },
        {
          name: "NanumGothic",
          data: boldData,
          weight: 700,
          style: "normal",
        },
      ],
    },
  );
}
