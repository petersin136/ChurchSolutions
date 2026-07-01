import { APPLE_SPLASH_LINKS } from "@/lib/pwa-apple-splash-links";

export function AppleSplashHead() {
  return (
    <>
      {APPLE_SPLASH_LINKS.map(({ href, media }) => (
        <link key={href} rel="apple-touch-startup-image" href={href} media={media} />
      ))}
    </>
  );
}
