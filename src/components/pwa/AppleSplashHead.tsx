import { APPLE_SPLASH_LINKS } from "@/lib/pwa-apple-splash-links";

export function AppleSplashHead() {
  return (
    <>
      {/* 기기별 media 미매칭 시 흰 화면+아이콘 폴백 방지 */}
      <link rel="apple-touch-startup-image" href="/splash/apple-splash-1170-2532.png?v=4" />
      <link rel="apple-touch-startup-image" href="/splash/apple-splash-1284-2778.png?v=4" />
      <link rel="apple-touch-startup-image" href="/splash/apple-splash-1290-2796.png?v=4" />
      {APPLE_SPLASH_LINKS.map(({ href, media }) => (
        <link key={href} rel="apple-touch-startup-image" href={`${href}?v=4`} media={media} />
      ))}
    </>
  );
}
