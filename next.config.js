const { PHASE_DEVELOPMENT_SERVER } = require("next/constants");
const withPWA = require("@ducanh2912/next-pwa").default;

/** @type {import('next').NextConfig} */
const createNextConfig = (phase) => ({
  reactStrictMode: false,
  // next dev와 next build가 같은 .next를 공유하면 검증 빌드가 dev 청크를 덮어써 404가 난다.
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",

  // dev에서 페이지 버퍼 안정화
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },

  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/favicon.svg" }];
  },

  async headers() {
    return [
      {
        source: "/manifest.json",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
        ],
      },
      {
        // _next/static, _next/image, _next/data, api, favicon은 캐시 제어 예외
        source: "/((?!_next/static|_next/image|_next/data|api|favicon.ico|manifest.json).*)",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
        ],
      },
    ];
  },
});

module.exports = (phase) => withPWA({
  dest: "public",
  disable: phase === PHASE_DEVELOPMENT_SERVER,
})(createNextConfig(phase));
