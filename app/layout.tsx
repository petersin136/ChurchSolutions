import type { Metadata, Viewport } from "next";
import Script from "next/script";
import localFont from "next/font/local";
import "./globals.css";
import "@/styles/print.css";
import { Providers } from "@/components/Providers";
import { AppleSplashHead } from "@/components/pwa/AppleSplashHead";

const pretendard = localFont({
  src: "../public/fonts/PretendardVariable.woff2",
  variable: "--pc-font-loaded",
  display: "swap",
});

const SITE_URL = "https://www.churchup.kr";
const SITE_TITLE = "처치업 - 교회 관리 솔루션";
const SITE_DESCRIPTION =
  "처치업(church up) — 행정은 가볍게, 시선은 목양에. 교인·출석·심방·재정에 더해 캘린더와 일정관리까지 한 번에 관리하는 교회 솔루션";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "처치업",
    template: "%s | 처치업",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "교회 관리 프로그램",
    "교인 관리",
    "교회 행정",
    "목양 노트",
    "교회 재정 관리",
    "교회 일정관리",
    "교회 캘린더",
    "교역자 플래너",
  ],
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "처치업",
    url: SITE_URL,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: SITE_URL,
  },
  verification: {
    google: "E4u-l8xqMIqk_aXMaikyoaqhCCBUZZktDKkgSACkHx4",
    other: {
      "naver-site-verification": "9c477ec400747b6cb9392a584016ec5bd20ca0a3",
    },
  },
  manifest: "/manifest.json?v=4",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.svg",
    apple: "/icons/apple-touch-icon.png?v=4",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "처치업",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0b0c0e" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0c0e" },
  ],
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={pretendard.variable} data-theme="orange" data-mode="light">
      <head>
        <style
          dangerouslySetInnerHTML={{
            __html: "html,body{background-color:#0b0c0e}",
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.style.backgroundColor='#0b0c0e';",
          }}
        />
        {process.env.NODE_ENV === "development" && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
(function() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.getRegistrations().then(function(regs) {
    regs.forEach(function(r) { r.unregister(); });
  });
  if (typeof caches !== "undefined" && caches.keys) {
    caches.keys().then(function(keys) {
      keys.forEach(function(k) { caches.delete(k); });
    });
  }
})();
              `.trim(),
            }}
          />
        )}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var origError = console.error;
                console.error = function() {
                  if (typeof arguments[0] === 'string' && arguments[0].includes('Hydration')) return;
                  origError.apply(console, arguments);
                };
              })();
            `,
          }}
        />
        <link rel="manifest" href="/manifest.json?v=4" />
        <meta name="application-name" content="처치업" />
        <meta name="theme-color" content="#0b0c0e" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="처치업" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png?v=4" />
        <AppleSplashHead />
      </head>
      <body className="antialiased" suppressHydrationWarning={true}>
        <Script
          src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js"
          strategy="lazyOnload"
          crossOrigin="anonymous"
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
