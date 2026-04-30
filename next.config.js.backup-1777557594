const withPWA = require("@ducanh2912/next-pwa").default;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,

  // dev 모드에서 페이지 버퍼 안정화 (HMR 시 산출물 누락 방지)
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },

  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/api/favicon" }];
  },

  async headers() {
    return [
      {
        // Next.js 빌드 산출물과 API는 제외하고, 일반 페이지만 캐시 금지
        // 이전: source: "/:path*" → _next/static, _next/data까지 no-store 걸려 dev 404 유발
        source: "/((?!_next/static|_next/image|_next/data|api|favicon.ico).*)",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
        ],
      },
    ];
  },

  // dev 런타임에서 파일시스템 캐시(.pack) 손상/경합으로
  // _next 정적 자산 404/500이 반복되어 메모리 캐시로 고정
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = { type: "memory" };
    }
    return config;
  },
};

module.exports = withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
})(nextConfig);
