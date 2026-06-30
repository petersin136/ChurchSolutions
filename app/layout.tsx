import type { Metadata, Viewport } from "next";
import Script from "next/script";
import localFont from "next/font/local";
import "./globals.css";
import "@/styles/print.css";
import { Providers } from "@/components/Providers";

const pretendard = localFont({
  src: "../public/fonts/PretendardVariable.woff2",
  variable: "--pc-font-loaded",
  display: "swap",
});

const SITE_URL = "https://www.churchup.kr";
const SITE_TITLE = "처치업 - 교회 관리 솔루션";
const SITE_DESCRIPTION =
  "처치업(church up) — 행정은 가볍게, 시선은 목양에. 교인·출석·심방·재정에 더해 캘린더와 일정관리까지 한 번에 관리하는 교회 솔루션";
const OG_IMAGE = {
  url: "/churchup-logo.png",
  width: 1200,
  height: 630,
  alt: "처치업",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
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
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE.url],
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: SITE_URL,
  },
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/icons/icon-192x192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "교회솔루션",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#3B5998",
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
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#3B5998" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
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
