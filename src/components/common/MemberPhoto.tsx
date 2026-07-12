"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { resolveMemberPhotoSrc } from "@/lib/member-photo";
import { surnameAvatarColors, surnameInitialFromName } from "@/components/ui/avatarUtils";

type MemberPhotoProps = {
  photo?: string | null;
  name: string;
  className?: string;
  style?: CSSProperties;
  fallback?: ReactNode;
};

export function useMemberPhotoSrc(photo: string | undefined | null): string | undefined {
  const [src, setSrc] = useState<string | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    void resolveMemberPhotoSrc(photo).then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [photo]);
  return src;
}

function SurnameInitialAvatar({
  name,
  className,
  style,
}: {
  name: string;
  className?: string;
  style?: CSSProperties;
}) {
  const label = surnameInitialFromName(name);
  const { bg, fg } = surnameAvatarColors(name);
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        background: bg,
        color: fg,
        fontWeight: 700,
        letterSpacing: "-0.02em",
        lineHeight: 1,
        userSelect: "none",
        ...style,
      }}
      aria-hidden
    >
      {label}
    </span>
  );
}

export function MemberPhoto({ photo, name, className, style, fallback }: MemberPhotoProps) {
  const src = useMemberPhotoSrc(photo);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
  }, [photo, src]);

  if (!src || broken) {
    if (fallback !== undefined) return <>{fallback}</>;
    return <SurnameInitialAvatar name={name} className={className} style={style} />;
  }

  return (
    <img
      src={src}
      alt=""
      className={className}
      style={style}
      onError={() => setBroken(true)}
    />
  );
}

export function MemberPhotoBg({
  photo,
  className,
  style,
}: {
  photo?: string | null;
  className?: string;
  style?: CSSProperties;
}) {
  const src = useMemberPhotoSrc(photo);
  if (!src) return null;
  return <div className={className} style={{ ...style, backgroundImage: `url(${src})` }} />;
}

export function MemberPhotoCircle({
  photo,
  name,
  imageClassName,
  fallbackClassName,
  getInitial,
}: {
  photo?: string | null;
  name: string;
  imageClassName: string;
  fallbackClassName: string;
  getInitial?: (name: string) => string;
}) {
  const src = useMemberPhotoSrc(photo);
  const initial = getInitial ? getInitial(name) : surnameInitialFromName(name);
  const { bg, fg } = surnameAvatarColors(name);
  if (src) {
    return <div className={imageClassName} style={{ backgroundImage: `url(${src})` }} />;
  }
  return (
    <div
      className={fallbackClassName}
      style={{ background: bg, color: fg }}
    >
      {initial}
    </div>
  );
}
