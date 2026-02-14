/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next 14: dev 모드에서 Supabase 번들 분리 (청크 경로 오류 방지)
  ...(process.env.NODE_ENV === "development" && {
    experimental: {
      serverComponentsExternalPackages: ["@supabase/supabase-js"],
    },
  }),
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/api/favicon" }];
  },
};
module.exports = nextConfig;
