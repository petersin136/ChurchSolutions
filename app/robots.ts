import type { MetadataRoute } from "next";

const BASE_URL = "https://www.churchup.kr";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/auth/callback",
        "/dev/",
      ],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
