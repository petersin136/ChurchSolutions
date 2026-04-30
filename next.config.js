const path = require("path");
const os = require("os");
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

  // 경로 공백("Church Solutions")로 인한 webpack filesystem cache 손상 회피
  // 캐시를 OS 임시 디렉토리로 이동
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = {
        type: "filesystem",
        cacheDirectory: path.join(os.tmpdir(), "churchsolutions-webpack-cache"),
        buildDependencies: {
          config: [__filename],
        },
      };
    }
    return config;
  },
};

module.exports = withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
})(nextConfig);
