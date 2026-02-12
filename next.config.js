/** @type {import('next').NextConfig} */
const nextConfig = {
  // dev 모드에서 ./682.js 등 청크 경로 오류 방지 (Supabase 번들 분리)
  ...(process.env.NODE_ENV === "development" && {
    serverExternalPackages: ["@supabase/supabase-js"],
  }),
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/api/favicon" }];
  },
};
module.exports = nextConfig;
